import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetRepository } from '../../mcp/repository';

const GetUserInfoArgs = z.object({});

type GetUserInfoArgsType = z.infer<typeof GetUserInfoArgs>;

export class GetUserInfoTool implements ToolHandler<GetUserInfoArgsType> {
  name = 'get_user_info';
  schema = GetUserInfoArgs;

  definition = {
    name: 'get_user_info',
    description: 'Get user information including their name and basic details when they ask questions about themselves.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
      additionalProperties: false
    }
  };

  config = {
    timeout: 5000,
    retries: 2,
    retryDelay: 1000
  };

  private repository = new PetRepository();

  async execute(input: GetUserInfoArgsType, context: ToolContext): Promise<ToolResult> {
    try {
      // Fetch user information using trusted phone number from context
      const userResult = await this.repository.fetchUserByPhone(context.userPhone);
      const petsResult = await this.repository.listPetsByUserPhone(context.userPhone);

      if (!userResult.success) {
        return {
          ok: false,
          error: 'Usuario no encontrado. ¿Te gustaría registrarte primero?'
        };
      }

      const userData = {
        user: userResult.data,
        pets: petsResult.success ? petsResult.data : []
      };

      console.log(`[${context.requestId}] User info retrieved:`, userData);
      return { ok: true, data: userData };

    } catch (error) {
      console.error(`[${context.requestId}] Get user info failed:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al obtener información del usuario'
      };
    }
  }
}