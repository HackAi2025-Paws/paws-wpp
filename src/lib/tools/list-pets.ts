import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetRepository } from '@/mcp/repository';
import { ListPetsSchema, ListPetsInput } from '@/mcp/types';

const ListPetsArgs = z.object({});

type ListPetsInputType = z.infer<typeof ListPetsArgs>;

export class ListPetsTool implements ToolHandler<ListPetsInputType> {
  name = 'list_pets';
  schema = ListPetsArgs;

  definition = {
    name: 'list_pets',
    description: 'List all pets owned by a user when they ask about their pets.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false
    }
  };

  config = {
    timeout: 5000,
    retries: 2,
    retryDelay: 1000
  };

  private repository = new PetRepository();

  async execute(_input: ListPetsInputType, context: ToolContext): Promise<ToolResult> {
    try {
      // Use phone from context
      const validatedArgs = ListPetsSchema.parse({
        phone: context.userPhone
      }) as ListPetsInput;

      const result = await this.repository.listPetsByUserPhone(validatedArgs.phone);

      if (result.success) {
        const petCount = result.data?.length || 0;
        console.log(`[${context.requestId}] Listed ${petCount} pets for user ${context.userPhone}`);
        return { ok: true, data: result.data };
      } else {
        return { ok: false, error: result.error };
      }

    } catch (error) {
      console.error(`[${context.requestId}] List pets failed:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al listar mascotas'
      };
    }
  }
}