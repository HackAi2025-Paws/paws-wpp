import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { SessionStore, getSessionStore, UserMessage, AssistantMessage } from './session-store';
import { ToolRegistry } from '@/lib/tools';
import { ToolRunner } from '@/lib/tools';
import { ToolContext, ToolResult } from '@/lib/tools';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const toolRegistry = new ToolRegistry();
const toolRunner = new ToolRunner();

const getToolDefinitions = (): Anthropic.Tool[] => {
  return toolRegistry.getToolDefinitions(toolRegistry.hasWebSearch(), toolRegistry.hasMapSearch());
};

const createSystemPrompt = (): string => {
  let prompt = `
  You are a WhatsApp assistant for a pet management system.

GOALS
- Interpret Spanish messages and call appropriate tools.
- If the user gives unclear dates (e.g., “2 años”), ask for a specific birth date (DD/MM/YYYY) using ask_user.
- Keep all replies concise, WhatsApp-friendly, and actionable.

STYLE & FORMATTING (WhatsApp)
- Use brief lines and bullets; 1–4 lines max per reply, unless the user requested otherwise (max 10 lines still)
- Prefer *bold* for key words (one * each side); emojis for clarity (examples: 🐾, ✅, ⚠️, ℹ️).
- Dates: DD/MM/YYYY only.
- One clear Call To Action per message (question or button).
- If you need more info, ask one question at a time.
- End the session if the user says “FIN”, “SALIR”, “ADIOS” or equivalent.
- Never reveal internal tool names or system details.

SAFETY & TONE
- Friendly, professional, no medical diagnosis.
- Redirect to a vet for emergencies.

TRIGGERS TO END SESSION
- If user sends a goodbye word (FIN, SALIR, ADIOS, CHAU, HASTA LUEGO), reply briefly and stop.`;

  if (toolRegistry.hasWebSearch()) {
    prompt += `
WEB SEARCH GUIDELINES:
- Use web_search ONLY for fresh, niche, or uncertain information:
  * Vaccination schedules and requirements
  * Recent medication or food recalls
  * Current symptoms or disease outbreaks
  * Specific drug availability or pricing
  * New veterinary treatments or procedures
- DO NOT use web_search for out of scope knowledge, as in not related to pets or their care
- When you get search results, cite sources with title, domain, and date
- Always synthesize multiple sources when available`;
  }

  return prompt;
};

export class AgentLoop {
  private sessionStore: SessionStore;
  private maxRounds = 3; // Safety breaker for infinite loops

  constructor(sessionStore?: SessionStore) {
    this.sessionStore = sessionStore || getSessionStore();
  }

  async execute(phone: string, userText: string, messageId?: string): Promise<string> {
    const requestId = randomUUID();
    const startTime = Date.now();

    console.log(`[${requestId}] Starting agent loop for ${phone}`, {
      userText: userText.substring(0, 100) + (userText.length > 100 ? '...' : ''),
      messageId
    });

    try {
      // Check if message already seen (idempotency)
      if (messageId && await this.sessionStore.isMessageSeen(messageId)) {
        console.log(`[${requestId}] Message already seen: ${messageId}`);
        return 'Mensaje ya procesado.';
      }

      // Mark message as seen
      if (messageId) {
        await this.sessionStore.markMessageSeen(messageId);
      }

      // Check for session end keywords
      const endKeywords = ['FIN', 'SALIR', 'ADIOS', 'CHAU', 'TERMINAR'];
      if (endKeywords.some(keyword => userText.toUpperCase().includes(keyword))) {
        await this.sessionStore.end(phone);
        return '👋 Sesión terminada. ¡Hasta luego!';
      }

      // Append user message to session
      const userMessage: UserMessage = {
        role: 'user',
        content: userText
      };

      let session = await this.sessionStore.append(phone, userMessage);
      console.log(`[${requestId}] Session loaded with ${session.messages.length} messages`);

      // Main conversation loop with safety breaker
      let round = 0;
      while (round < this.maxRounds) {
        round++;
        console.log(`[${requestId}] Calling Claude with ${session.messages.length} session messages`);

        const messages = this.sessionStore.transformToAnthropicMessages(session.messages);

        // Debug log the messages being sent to Claude
        console.log(`[${requestId}] Sending ${messages.length} messages to Claude`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[${requestId}] Messages:`, JSON.stringify(messages, null, 2));
        }

        // Validate messages before sending
        this.validateMessages(messages, requestId);

        const tools = getToolDefinitions();
        const systemPrompt = createSystemPrompt();

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          system: systemPrompt,
          temperature: 0.3,
          max_tokens: 1500,
          tools,
          messages,
        });

        console.log(`[${requestId}] Claude response: ${response.usage?.input_tokens || 0} input, ${response.usage?.output_tokens || 0} output tokens`);

        // Check for tool_use blocks
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // No tools used - this is the final response
          const assistantMessage: AssistantMessage = {
            role: 'assistant',
            content: response.content
          };
          session = await this.sessionStore.append(phone, assistantMessage);

          // Extract text response
          const textBlocks = response.content.filter(
            (block): block is Anthropic.TextBlock => block.type === 'text'
          );

          const reply = textBlocks.map(block => block.text).join('\n').trim();

          if (!reply) {
            return 'Lo siento, no pude generar una respuesta.';
          }

          console.log(`[${requestId}] Completed in ${Date.now() - startTime}ms with final response`);
          return reply;
        }

        // Tools were used - append assistant turn to history
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: response.content
        };
        session = await this.sessionStore.append(phone, assistantMessage);

        console.log(`[${requestId}] Executing ${toolUseBlocks.length} tools`);

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolBlock of toolUseBlocks) {
          // Validate that tool_use_id matches the one from assistant response
          if (!this.validateToolUseId(toolBlock.id, toolUseBlocks, requestId)) {
            throw new Error(`Invalid tool_use_id: ${toolBlock.id}`);
          }

          const toolResult = await this.executeTool(toolBlock, phone, requestId, messageId);

          // Ensure tool result content is valid JSON string
          let toolContent: string;
          try {
            toolContent = JSON.stringify(toolResult);
            if (toolContent === '{}' || toolContent === 'null' || toolContent === 'undefined') {
              toolContent = JSON.stringify({ ok: false, error: 'Empty tool result' });
            }
          } catch (error) {
            console.error(`[${requestId}] Failed to serialize tool result:`, error);
            toolContent = JSON.stringify({ ok: false, error: 'Failed to serialize tool result' });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: toolContent
          });
        }

        // Validate tool results before adding to session
        if (toolResults.length === 0) {
          console.error(`[${requestId}] No tool results to add to session`);
          throw new Error('No tool results generated');
        }

        // Validate that all tool results have valid tool_use_ids
        for (const toolResult of toolResults) {
          if (!toolResult.tool_use_id) {
            console.error(`[${requestId}] Tool result missing tool_use_id:`, toolResult);
            throw new Error('Tool result missing tool_use_id');
          }
        }

        // Create user message with tool results
        // Use a special format that the session store will recognize
        const toolResultsMessage: UserMessage = {
          role: 'user',
          content: `__TOOL_RESULTS__${JSON.stringify(toolResults)}`
        };
        
        console.log(`[${requestId}] Adding tool results to session:`, toolResults.map(r => ({ tool_use_id: r.tool_use_id, type: r.type })));
        session = await this.sessionStore.append(phone, toolResultsMessage);

        // Continue loop to call Claude again with the tool results
      }

      // Safety breaker hit
      console.log(`[${requestId}] Hit safety breaker after ${this.maxRounds} rounds`);
      return 'He procesado tu solicitud, pero necesito más claridad. ¿Puedes reformular tu pregunta?';

    } catch (error) {
      console.error(`[${requestId}] Agent loop failed:`, error);
      return 'Lo siento, ocurrió un error técnico. Por favor intenta de nuevo.';
    }
  }

  private async executeTool(
    toolBlock: Anthropic.ToolUseBlock,
    phone: string,
    requestId: string,
    messageId?: string
  ): Promise<ToolResult> {
    const toolName = toolBlock.name;
    const toolInput = toolBlock.input;

    console.log(`[${requestId}] Executing tool: ${toolName}`, { input: toolInput });

    // Get tool handler from registry
    const toolHandler = toolRegistry.getTool(toolName);
    if (!toolHandler) {
      return {
        ok: false,
        error: `Unknown tool: ${toolName}`
      };
    }

    // Create tool context
    const context: ToolContext = {
      requestId,
      userPhone: phone,
      messageId
    };

    // Execute tool using the tool runner (with timeout, retries, and idempotency)
    return await toolRunner.execute(toolHandler, toolInput, context);
  }

  private validateToolUseId(toolUseId: string, toolUseBlocks: Anthropic.ToolUseBlock[], requestId: string): boolean {
    const found = toolUseBlocks.some(block => block.id === toolUseId);
    if (!found) {
      console.error(`[${requestId}] Invalid tool_use_id: ${toolUseId} not found in assistant response`);
    }
    return found;
  }

  private validateMessages(messages: Anthropic.MessageParam[], requestId: string): void {
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Check for empty content
      if (!message.content) {
        console.error(`[${requestId}] Message ${i} has no content:`, message);
        throw new Error(`Message ${i} has empty content`);
      }

      // Check array content
      if (Array.isArray(message.content)) {
        if (message.content.length === 0) {
          console.error(`[${requestId}] Message ${i} has empty content array:`, message);
          throw new Error(`Message ${i} has empty content array`);
        }

        // Check each content block
        for (let j = 0; j < message.content.length; j++) {
          const block = message.content[j];
          if (block.type === 'text' && (!block.text || !block.text.trim())) {
            console.error(`[${requestId}] Message ${i}, block ${j} has empty text:`, block);
            throw new Error(`Message ${i}, block ${j} has empty text`);
          }
        }
      }

      // Check role alternation
      if (i > 0) {
        const prevMessage = messages[i - 1];
        if (prevMessage.role === message.role) {
          console.warn(`[${requestId}] Messages ${i-1} and ${i} have same role: ${message.role}`);
        }
      }
    }

    console.log(`[${requestId}] Message validation passed for ${messages.length} messages`);
  }
}

let agentLoop: AgentLoop | null = null;

export function getAgentLoop(): AgentLoop {
  if (!agentLoop) {
    agentLoop = new AgentLoop();
  }
  return agentLoop;
}