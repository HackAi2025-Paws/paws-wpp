import { createClient, RedisClientType } from 'redis';
import Anthropic from '@anthropic-ai/sdk';

// Standardized internal message format
export interface UserMessage {
  role: 'user';
  content: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: Anthropic.ContentBlock[];
}

export interface ToolMessage {
  role: 'tool';
  tool_name: string;
  tool_use_id: string;
  content: string; // Serialized JSON result
}

export type SessionMessage = UserMessage | AssistantMessage | ToolMessage;

export interface Session {
  status: 'active';
  messages: SessionMessage[];
  updatedAt: number;
}

export class SessionStore {
  private client: RedisClientType;
  private isConnected = false;

  constructor(redisUrl?: string) {
    this.client = createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('Redis client connected');
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      console.log('Redis client disconnected');
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  private getSessionKey(phone: string): string {
    // Normalize phone number and create key
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    return `wh:session:${normalizedPhone}`;
  }

  async load(phone: string): Promise<Session | null> {
    try {
      const key = this.getSessionKey(phone);
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const session = JSON.parse(data) as Session;
      return session;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  async save(phone: string, session: Session): Promise<void> {
    try {
      const key = this.getSessionKey(phone);
      const ttlSeconds = 6 * 60 * 60; // 6 hours

      session.updatedAt = Date.now();

      await this.client.setEx(
        key,
        ttlSeconds,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async touch(phone: string): Promise<void> {
    try {
      const key = this.getSessionKey(phone);
      const ttlSeconds = 6 * 60 * 60; // 6 hours
      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      console.error('Failed to touch session:', error);
      throw error;
    }
  }

  async append(phone: string, message: SessionMessage): Promise<Session> {
    const session = await this.load(phone) || {
      status: 'active' as const,
      messages: [],
      updatedAt: Date.now()
    };

    // Add the new message
    session.messages.push(message);

    // Trim to keep only the last N turns (user/assistant pairs)
    session.messages = this.trimMessages(session.messages, 12);

    // Save with updated TTL
    await this.save(phone, session);

    return session;
  }

  async end(phone: string): Promise<void> {
    try {
      const key = this.getSessionKey(phone);
      await this.client.del(key);
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }

  private trimMessages(messages: SessionMessage[], maxTurns: number): SessionMessage[] {
    // Keep system messages (if any) and trim user/assistant pairs
    // A "turn" is considered a user message followed by assistant response(s)

    if (messages.length <= maxTurns * 2) {
      return messages;
    }

    // Find complete turns by looking for user messages
    const turns: SessionMessage[][] = [];
    let currentTurn: SessionMessage[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        // Start new turn
        if (currentTurn.length > 0) {
          turns.push(currentTurn);
        }
        currentTurn = [message];
      } else {
        // Add to current turn (assistant or tool messages)
        currentTurn.push(message);
      }
    }

    // Add the last turn if it exists
    if (currentTurn.length > 0) {
      turns.push(currentTurn);
    }

    // Keep only the last maxTurns turns
    const keepTurns = turns.slice(-maxTurns);
    return keepTurns.flat();
  }

  // Transform session messages to Anthropic wire format
  transformToAnthropicMessages(messages: SessionMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      switch (msg.role) {
        case 'user':
          // Ensure user message has non-empty content
          if (!msg.content.trim()) {
            console.warn('Skipping empty user message');
            continue;
          }

          result.push({
            role: 'user',
            content: [{ type: 'text', text: msg.content }]
          });
          break;

        case 'assistant':
          // Ensure assistant message has content
          if (!msg.content || msg.content.length === 0) {
            console.warn('Skipping empty assistant message');
            continue;
          }

          result.push({
            role: 'assistant',
            content: msg.content
          });
          break;

        case 'tool':
          // Tool results must be in their own user message
          // Never mix tool results with other content types
          result.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: msg.tool_use_id,
              content: msg.content || '{}'
            }]
          });
          break;

        default:
          console.warn(`Unknown message role: ${(msg as SessionMessage).role}`);
          continue;
      }
    }

    // Ensure we don't end with consecutive messages of the same role
    const cleanedResult = this.ensureAlternatingRoles(result);

    // Ensure no empty messages
    return cleanedResult.filter(msg => {
      if (Array.isArray(msg.content)) {
        return msg.content.length > 0 && msg.content.some(c =>
          (c.type === 'text' && c.text.trim()) || c.type === 'tool_result'
        );
      }
      return msg.content && msg.content.length > 0;
    });
  }

  private ensureAlternatingRoles(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const message of messages) {
      if (message.role === lastRole) {
        // Merge consecutive messages of the same role
        const lastMessage = result[result.length - 1];
        if (lastMessage) {
          // Don't merge if either message contains tool_result blocks
          const hasToolResult = (content: Anthropic.ContentBlockParam[] | string) => {
            return Array.isArray(content) && content.some(block =>
              typeof block === 'object' && 'type' in block && block.type === 'tool_result'
            );
          };

          if (hasToolResult(lastMessage.content) || hasToolResult(message.content)) {
            // Don't merge messages with tool results
            result.push(message);
          } else {
            // Safe to merge text-only messages
            const lastContent = Array.isArray(lastMessage.content)
              ? lastMessage.content
              : [{ type: 'text', text: lastMessage.content as string } as Anthropic.TextBlockParam];

            const currentContent = Array.isArray(message.content)
              ? message.content
              : [{ type: 'text', text: message.content as string } as Anthropic.TextBlockParam];

            lastMessage.content = [...lastContent, ...currentContent];
          }
        }
      } else {
        result.push(message);
        lastRole = message.role;
      }
    }

    return result;
  }

  // Check if message ID has been seen (for idempotency)
  async isMessageSeen(messageId: string): Promise<boolean> {
    try {
      const key = `wh:seen:${messageId}`;
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch {
      return false;
    }
  }

  // Mark message ID as seen
  async markMessageSeen(messageId: string): Promise<void> {
    try {
      const key = `wh:seen:${messageId}`;
      // Keep seen messages for 1 hour
      await this.client.setEx(key, 3600, '1');
    } catch (error) {
      console.error('Failed to mark message as seen:', error);
    }
  }
}

// Singleton instance
let sessionStore: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (!sessionStore) {
    sessionStore = new SessionStore();
  }
  return sessionStore;
}