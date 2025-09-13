import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const RegisterUserArgs = z.object({
  name: z.string().min(1),
  phone: z.string().min(6)
});

const ListPetsArgs = z.object({
  phone: z.string().min(6)
});

const RegisterPetArgs = z.object({
  name: z.string().min(1),
  dateOfBirth: z.string().min(1), // Any format - will be normalized in app layer
  species: z.enum(['CAT', 'DOG']),
  ownerPhone: z.string().min(6),
});

const AskUserArgs = z.object({
  message: z.string().min(1)
});

type ToolName = 'register_user' | 'list_pets' | 'register_pet' | 'ask_user';

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

const SYSTEM = `You are a WhatsApp assistant for a pet management system.
- Interpret Spanish messages and call appropriate tools
- If required info is missing or unclear, call ask_user with a helpful Spanish question
- For register_pet: Only call if you have clear name, species (CAT/DOG), and birth date
- If user gives unclear dates like "2 años", use ask_user to request specific birth date
- User's phone will be injected from trusted context - don't include in tool calls`;

export interface AgentToolCall {
  name: ToolName;
  arguments: Record<string, unknown>;
}

export class ClaudeService {
  static async processMessage(userPhone: string, messageBody: string): Promise<AgentToolCall> {
    // Retry logic with exponential backoff
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          system: SYSTEM,
          temperature: 0,
          top_p: 1,
          max_tokens: 1000,
          tools,
          tool_choice: { type: 'any' },
          messages: [
            {
              role: 'user',
              content: `User phone: ${userPhone}\nMessage: ${messageBody}`
            },
          ],
        });

        // Find the first tool_use block Claude emits
        const toolUse = response.content.find(
          (content): content is Anthropic.ToolUseBlock =>
            content.type === 'tool_use'
        );

        if (!toolUse) {
          // Fallback if no tool was called
          return {
            name: 'ask_user',
            arguments: { message: 'No entendí tu solicitud. ¿Podrías reformularla?' }
          };
        }

        // Validate and inject trusted context by tool name
        const toolName = toolUse.name as ToolName;

        switch (toolName) {
          case 'register_user':
            return {
              name: toolName,
              arguments: RegisterUserArgs.parse({
                ...(toolUse.input as Record<string, unknown>),
                phone: userPhone, // Always inject trusted phone
              })
            };

          case 'list_pets':
            return {
              name: toolName,
              arguments: ListPetsArgs.parse({ phone: userPhone })
            };

          case 'register_pet':
            return {
              name: toolName,
              arguments: RegisterPetArgs.parse({
                ...(toolUse.input as Record<string, unknown>),
                ownerPhone: userPhone, // Always inject trusted phone
              })
            };

          case 'ask_user':
            return {
              name: toolName,
              arguments: AskUserArgs.parse(toolUse.input)
            };

          default:
            return {
              name: 'ask_user',
              arguments: { message: 'No pude procesar tu solicitud. ¿Podrías intentar de nuevo?' }
            };
        }

      } catch (error) {
        console.error(`Claude API attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          // Final fallback
          return {
            name: 'ask_user',
            arguments: {
              message: 'Lo siento, hay un problema técnico. ¿Podrías intentar de nuevo en un momento?'
            }
          };
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }

    // This should never be reached due to the fallback above
    return {
      name: 'ask_user',
      arguments: {
        message: 'Error del sistema. Por favor intenta más tarde.'
      }
    };
  }
}