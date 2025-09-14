import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { InputNormalizer } from '../input-normalizer';
import { PetRepository } from '@/mcp/repository';
import { RegisterUserSchema, RegisterUserInput } from '@/mcp/types';

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

  private repository = new PetRepository();

  async execute(input: RegisterUserArgsType, context: ToolContext): Promise<ToolResult> {
    try {
      // Inject trusted phone number from context
      const argsWithPhone = {
        name: input.name,
        phone: context.userPhone
      };

      // Normalize and validate
      const normalizedName = InputNormalizer.normalizeName(argsWithPhone.name);
      const validatedArgs = RegisterUserSchema.parse({
        name: normalizedName,
        phone: argsWithPhone.phone
      }) as RegisterUserInput;

      // Execute upsert operation (idempotent by nature)
      const result = await this.repository.upsertUserByPhone(
        validatedArgs.name,
        validatedArgs.phone
      );

      if (result.success) {
        console.log(`[${context.requestId}] User registered/updated:`, result.data);
        return { ok: true, data: result.data };
      } else {
        return { ok: false, error: result.error };
      }

    } catch (error) {
      console.error(`[${context.requestId}] Register user failed:`, error);

      if (error instanceof Error && error.message.includes('validation')) {
        return { ok: false, error: 'Nombre de usuario no válido. Proporciona un nombre completo.' };
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al registrar usuario'
      };
    }
  }
}