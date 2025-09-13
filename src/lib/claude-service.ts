import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AgentToolCall {
  name: 'register_user' | 'list_pets' | 'register_pet' | 'ask_user';
  input: Record<string, unknown>;
}

export class ClaudeService {
  static async processMessage(userPhone: string, messageBody: string): Promise<AgentToolCall[]> {
    const systemPrompt = `You are a WhatsApp assistant for a pet management system. Interpret natural language messages and decide which tools to call.

CRITICAL RULES:
1. User's phone is ${userPhone} - you don't need to include phone numbers in tool parameters, they will be injected
2. For register_pet: Only call if you have clear name and species. If dateOfBirth is unclear, use ask_user
3. Species must be exactly "CAT" or "DOG" - if unclear, use ask_user
4. Use ask_user when information is missing or ambiguous
5. You can make multiple tool calls if needed

Available tools will be defined in the tool schema.`;

    const tools: Anthropic.Tool[] = [
      {
        name: 'register_user',
        description: 'Register or update a user when they provide their name',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User full name'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'list_pets',
        description: 'List all pets owned by a user when they ask about their pets',
        input_schema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'register_pet',
        description: 'Register a new pet. Only call if you have clear name, species, and birth info',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Pet name'
            },
            dateOfBirth: {
              type: 'string',
              description: 'Pet date of birth in any clear format (will be normalized)'
            },
            species: {
              type: 'string',
              enum: ['CAT', 'DOG'],
              description: 'Pet species - must be exactly CAT or DOG'
            }
          },
          required: ['name', 'dateOfBirth', 'species']
        }
      },
      {
        name: 'ask_user',
        description: 'Ask for clarification when information is missing or unclear',
        input_schema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Clarification question in Spanish'
            }
          },
          required: ['message']
        }
      }
    ];

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          temperature: 0,
          top_p: 1,
          system: systemPrompt,
          tools,
          tool_choice: { type: 'any' },
          messages: [
            {
              role: 'user',
              content: messageBody,
            },
          ],
        });

        // Extract tool calls from response
        const toolCalls: AgentToolCall[] = [];

        for (const content of response.content) {
          if (content.type === 'tool_use') {
            // Inject trusted context values
            const input: Record<string, unknown> = { ...(content.input as Record<string, unknown>) };

            if (content.name === 'register_user' || content.name === 'list_pets') {
              input.phone = userPhone;
            }
            if (content.name === 'register_pet') {
              input.ownerPhone = userPhone;
            }

            toolCalls.push({
              name: content.name as AgentToolCall['name'],
              input
            });
          }
        }

        if (toolCalls.length === 0) {
          // Fallback: if no tools were called, ask for clarification
          toolCalls.push({
            name: 'ask_user',
            input: {
              message: 'No entendí tu solicitud. ¿Podrías reformularla? Por ejemplo: "registrarme", "ver mis mascotas", o "registrar mi perro/gato".'
            }
          });
        }

        return toolCalls;

      } catch (error) {
        console.error(`Claude API attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          // Final fallback
          return [{
            name: 'ask_user',
            input: {
              message: 'Lo siento, hay un problema técnico. ¿Podrías intentar de nuevo en un momento?'
            }
          }];
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }

    // This should never be reached due to the fallback above
    return [{
      name: 'ask_user',
      input: {
        message: 'Lo siento, hay un problema técnico. ¿Podrías intentar de nuevo?'
      }
    }];
  }
}