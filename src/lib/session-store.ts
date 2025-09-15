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

export type SessionMessage = UserMessage | AssistantMessage;

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

      const session = JSON.parse(data as string) as Session;
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
          // Check if this is a special tool results message
          if (msg.content.startsWith('__TOOL_RESULTS__')) {
            const toolResultsJson = msg.content.substring('__TOOL_RESULTS__'.length);
            try {
              const toolResults = JSON.parse(toolResultsJson) as Anthropic.ToolResultBlockParam[];
              
              // Validate that we have a previous assistant message with tool_use blocks
              if (result.length === 0) {
                console.error('Tool results message found but no previous assistant message');
                continue;
              }
              
              const prevMessage = result[result.length - 1];
              if (prevMessage.role !== 'assistant') {
                console.error('Tool results message found but previous message is not from assistant');
                continue;
              }
              
              // Check if the previous assistant message has tool_use blocks
              const assistantContent = prevMessage.content;
              if (!Array.isArray(assistantContent)) {
                console.error('Previous assistant message content is not an array');
                continue;
              }
              
              const toolUseBlocks = assistantContent.filter(
                (block: any) => block.type === 'tool_use'
              );
              
              if (toolUseBlocks.length === 0) {
                console.error('Previous assistant message has no tool_use blocks');
                continue;
              }
              
              // Validate that tool_use_ids match
              const toolUseIds = new Set(toolUseBlocks.map((block: any) => block.id));
              const toolResultIds = new Set(toolResults.map(result => result.tool_use_id));
              
              console.log('Tool use IDs:', Array.from(toolUseIds));
              console.log('Tool result IDs:', Array.from(toolResultIds));
              
              const hasMatchingIds = Array.from(toolResultIds).every(id => toolUseIds.has(id));
              if (!hasMatchingIds) {
                console.error('Tool result IDs do not match tool use IDs');
                console.error('Missing IDs:', Array.from(toolResultIds).filter(id => !toolUseIds.has(id)));
                continue;
              }
              
              result.push({
                role: 'user',
                content: toolResults
              });
            } catch (error) {
              console.error('Failed to parse tool results:', error);
              // Skip this message if it's malformed
              continue;
            }
            break;
          }

          // Ensure user message has non-empty content
          if (!msg.content.trim()) {
            console.warn('Skipping empty user message');
            continue;
          }

          // Regular user message with text content
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

        default:
          console.warn(`Unknown message role: ${(msg as SessionMessage).role}`);
          continue;
      }
    }

    // Return the result directly since agent loop ensures proper alternation
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