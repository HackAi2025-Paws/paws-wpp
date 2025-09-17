import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { UserService } from '../user-service';

const RegisterUserArgs = z.object({
  name: z.string().min(1, 'Name is required')
});

type RegisterUserArgsType = z.infer<typeof RegisterUserArgs>;

export class RegisterUserTool implements ToolHandler<RegisterUserArgsType> {
  name = 'register_user';
  schema = RegisterUserArgs;

  definition = {
    name: 'register_user',
    description: 'Register or update a user when they provide their name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const, description: 'User full name' }
      },
      required: ['name'],
      additionalProperties: false
    }
  };

  config = {
    timeout: 5000,
    retries: 2,
    retryDelay: 1000
  };

  async execute(input: RegisterUserArgsType, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await UserService.registerUser(input.name, context.userPhone);

      if (result.success) {
        console.log(`[${context.requestId}] User registered/updated:`, result.data);
        return { ok: true, data: result.data };
      } else {
        return { ok: false, error: result.error };
      }

    } catch (error) {
      console.error(`[${context.requestId}] Register user failed:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al registrar usuario'
      };
    }
  }
}