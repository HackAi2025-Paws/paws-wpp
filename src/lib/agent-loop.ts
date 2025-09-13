import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { SessionStore, getSessionStore, UserMessage, AssistantMessage, ToolMessage } from './session-store';
import { InputNormalizer } from './input-normalizer';
import { PetRepository } from '@/mcp/repository';
import {
  RegisterUserSchema,
  ListPetsSchema,
  RegisterPetSchema,
  RegisterUserInput,
  ListPetsInput,
  RegisterPetInput,
} from '@/mcp/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const repository = new PetRepository();

// Tool argument schemas
const RegisterUserArgs = z.object({
  name: z.string().min(1),
  phone: z.string().min(6)
});

const ListPetsArgs = z.object({
  phone: z.string().min(6)
});

const RegisterPetArgs = z.object({
  name: z.string().min(1),
  dateOfBirth: z.string().min(1),
  species: z.enum(['CAT', 'DOG']),
  ownerPhone: z.string().min(6),
});

const AskUserArgs = z.object({
  message: z.string().min(1)
});

// Tool definitions
const tools: Anthropic.Tool[] = [
  {
    name: 'register_user',
    description: 'Register or update a user when they provide their name.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'User full name' }
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'list_pets',
    description: 'List all pets owned by a user when they ask about their pets.',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'register_pet',
    description: 'Register a new pet. Only call if you have clear name and species.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Pet name' },
        dateOfBirth: { type: 'string', description: 'Pet birth date in any clear format' },
        species: { type: 'string', enum: ['CAT', 'DOG'], description: 'Must be exactly CAT or DOG' }
      },
      required: ['name', 'dateOfBirth', 'species'],
      additionalProperties: false
    }
  },
  {
    name: 'ask_user',
    description: 'Ask the user for missing information or clarification.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Clarification question in Spanish' }
      },
      required: ['message'],
      additionalProperties: false
    }
  },
];

const SYSTEM_PROMPT = `You are a WhatsApp assistant for a pet management system.
- Interpret Spanish messages and call appropriate tools
- For register_pet: Only call if you have clear name, species (CAT/DOG), and birth date
- If user gives unclear dates like "2 años", use ask_user to request specific birth date
- Keep responses concise and WhatsApp-friendly
- User's phone will be injected from trusted context
- End sessions if user says "FIN", "SALIR", "ADIOS", or similar goodbye words`;

interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

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

      for (let round = 0; round < this.maxRounds; round++) {
        console.log(`[${requestId}] Starting round ${round + 1}`);

        const messages = this.sessionStore.transformToAnthropicMessages(session.messages);

        // Debug log the messages being sent to Claude
        console.log(`[${requestId}] Sending ${messages.length} messages to Claude`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[${requestId}] Messages:`, JSON.stringify(messages, null, 2));
        }

        // Validate and potentially fix messages before sending
        const validatedMessages = this.validateAndFixMessages(messages, requestId);

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          system: SYSTEM_PROMPT,
          temperature: 0.3,
          max_tokens: 1500,
          tools,
          messages: validatedMessages,
        });

        console.log(`[${requestId}] Claude response: ${response.usage?.input_tokens || 0} input, ${response.usage?.output_tokens || 0} output tokens`);

        // Process Claude's response
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        // Save assistant response to session
        const assistantMessage: AssistantMessage = {
          role: 'assistant',
          content: response.content
        };
        session = await this.sessionStore.append(phone, assistantMessage);

        if (toolUseBlocks.length === 0) {
          // No tools used, extract text response
          const textBlocks = response.content.filter(
            (block): block is Anthropic.TextBlock => block.type === 'text'
          );

          const reply = textBlocks.map(block => block.text).join('\n').trim();

          if (!reply) {
            return 'Lo siento, no pude generar una respuesta.';
          }

          console.log(`[${requestId}] Completed in ${Date.now() - startTime}ms with text response`);
          return reply;
        }

        // Execute tools
        console.log(`[${requestId}] Executing ${toolUseBlocks.length} tools`);

        for (const toolBlock of toolUseBlocks) {
          const toolResult = await this.executeTool(toolBlock, phone, requestId);

          // Ensure tool result content is valid JSON string
          let toolContent: string;
          try {
            toolContent = JSON.stringify(toolResult);
            // Ensure the JSON is not empty
            if (toolContent === '{}' || toolContent === 'null' || toolContent === 'undefined') {
              toolContent = JSON.stringify({ ok: false, error: 'Empty tool result' });
            }
          } catch (error) {
            console.error(`[${requestId}] Failed to serialize tool result:`, error);
            toolContent = JSON.stringify({ ok: false, error: 'Failed to serialize tool result' });
          }

          const toolMessage: ToolMessage = {
            role: 'tool',
            tool_name: toolBlock.name,
            tool_use_id: toolBlock.id,
            content: toolContent
          };

          session = await this.sessionStore.append(phone, toolMessage);
        }

        // Continue to next round to let Claude process tool results
      }

      // Safety breaker hit
      console.log(`[${requestId}] Hit safety breaker after ${this.maxRounds} rounds`);
      return 'He procesado tu solicitud, pero necesito más claridad. ¿Puedes reformular tu pregunta?';

    } catch (error) {
      console.error(`[${requestId}] Agent loop failed:`, error);
      return 'Lo siento, ocurrió un error técnico. Por favor intenta de nuevo.';
    }
  }

  private async executeTool(toolBlock: Anthropic.ToolUseBlock, phone: string, requestId: string): Promise<ToolResult> {
    const toolName = toolBlock.name;
    const toolInput = toolBlock.input;

    console.log(`[${requestId}] Executing tool: ${toolName}`, { input: toolInput });

    try {
      switch (toolName) {
        case 'register_user': {
          // Inject trusted phone and validate
          const args = RegisterUserArgs.parse({
            ...(toolInput as Record<string, unknown>),
            phone: phone
          });

          const normalizedName = InputNormalizer.normalizeName(args.name);
          const validatedArgs = RegisterUserSchema.parse({
            name: normalizedName,
            phone: args.phone
          }) as RegisterUserInput;

          const result = await repository.upsertUserByPhone(validatedArgs.name, validatedArgs.phone);

          if (result.success) {
            console.log(`[${requestId}] User registered:`, result.data);
            return { ok: true, data: result.data };
          } else {
            return { ok: false, error: result.error };
          }
        }

        case 'list_pets': {
          const args = ListPetsArgs.parse({ phone: phone });
          const validatedArgs = ListPetsSchema.parse(args) as ListPetsInput;

          const result = await repository.listPetsByUserPhone(validatedArgs.phone);

          if (result.success) {
            console.log(`[${requestId}] Listed ${result.data?.length || 0} pets`);
            return { ok: true, data: result.data };
          } else {
            return { ok: false, error: result.error };
          }
        }

        case 'register_pet': {
          const input = toolInput as Record<string, unknown>;
          // Normalize inputs and inject trusted phone
          const normalizedInput = {
            name: InputNormalizer.normalizeName(input.name as string),
            species: InputNormalizer.normalizeSpecies(input.species as string),
            dateOfBirth: InputNormalizer.normalizeDate(input.dateOfBirth as string),
            ownerPhone: phone
          };

          const args = RegisterPetArgs.parse(normalizedInput);
          const validatedArgs = RegisterPetSchema.parse(args) as RegisterPetInput;

          const result = await repository.createPetForUser(
            validatedArgs.name,
            new Date(validatedArgs.dateOfBirth),
            validatedArgs.species,
            validatedArgs.ownerPhone
          );

          if (result.success) {
            console.log(`[${requestId}] Pet registered:`, result.data);
            return { ok: true, data: result.data };
          } else {
            return { ok: false, error: result.error };
          }
        }

        case 'ask_user': {
          const args = AskUserArgs.parse(toolInput);
          console.log(`[${requestId}] Asking user: ${args.message}`);
          return { ok: true, data: { message: args.message } };
        }

        default:
          console.error(`[${requestId}] Unknown tool: ${toolName}`);
          return { ok: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`[${requestId}] Tool execution failed:`, error);

      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid species')) {
          return { ok: false, error: 'Especie de mascota no reconocida. Debe ser "perro" o "gato".' };
        }
        if (error.message.includes('Invalid date')) {
          return { ok: false, error: 'Fecha no válida. Proporciona una fecha específica como "15 de enero de 2022".' };
        }
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido en la herramienta'
      };
    }
  }

  private validateAndFixMessages(messages: Anthropic.MessageParam[], requestId: string): Anthropic.MessageParam[] {
    const fixedMessages: Anthropic.MessageParam[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Skip messages with no content
      if (!message.content) {
        console.warn(`[${requestId}] Skipping message ${i} with no content`);
        continue;
      }

      // Handle array content
      if (Array.isArray(message.content)) {
        // Skip empty arrays
        if (message.content.length === 0) {
          console.warn(`[${requestId}] Skipping message ${i} with empty content array`);
          continue;
        }

        // Separate tool_result blocks from other content
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        const otherContent: Anthropic.ContentBlockParam[] = [];

        for (const block of message.content) {
          if (typeof block === 'object' && 'type' in block) {
            if (block.type === 'tool_result') {
              toolResults.push(block as Anthropic.ToolResultBlockParam);
            } else if (block.type === 'text' && block.text?.trim()) {
              otherContent.push(block);
            }
          }
        }

        // If we have tool results, they should be in separate messages
        if (toolResults.length > 0 && otherContent.length > 0) {
          console.warn(`[${requestId}] Separating tool results from text content in message ${i}`);

          // Add text content first
          fixedMessages.push({
            role: message.role,
            content: otherContent
          });

          // Add each tool result in its own message
          for (const toolResult of toolResults) {
            fixedMessages.push({
              role: 'user', // Tool results are always user messages
              content: [toolResult]
            });
          }
        } else if (toolResults.length > 0) {
          // Only tool results
          fixedMessages.push({
            role: 'user',
            content: toolResults
          });
        } else if (otherContent.length > 0) {
          // Only other content
          fixedMessages.push({
            role: message.role,
            content: otherContent
          });
        }
      } else {
        fixedMessages.push(message);
      }
    }

    this.validateMessages(fixedMessages, requestId);
    return fixedMessages;
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