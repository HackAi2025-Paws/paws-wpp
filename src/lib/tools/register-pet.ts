import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetService } from '../pet-service';

const RegisterPetArgs = z.object({
  name: z.string().min(1, 'Pet name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  species: z.enum(['CAT', 'DOG'], { errorMap: () => ({ message: 'Species must be CAT or DOG' }) }),
  sex: z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: 'Sex must be MALE or FEMALE' }) }),
  weight: z.number().positive('Weight must be a positive number'),
  breed: z.string().min(1, 'Breed is required')
});

type RegisterPetInputType = z.infer<typeof RegisterPetArgs>;

export class RegisterPetTool implements ToolHandler<RegisterPetInputType> {
  name = 'register_pet';
  schema = RegisterPetArgs;

  definition = {
    name: 'register_pet',
    description: 'Register a new pet. Only call if you have clear name, species, sex, weight, and breed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const, description: 'Pet name' },
        dateOfBirth: { type: 'string' as const, description: 'Pet birth date in any clear format' },
        species: { type: 'string' as const, enum: ['CAT', 'DOG'], description: 'Must be exactly CAT or DOG' },
        sex: { type: 'string' as const, enum: ['MALE', 'FEMALE'], description: 'Must be exactly MALE or FEMALE' },
        weight: { type: 'number' as const, description: 'Pet weight as a positive number' },
        breed: { type: 'string' as const, description: 'Pet breed' }
      },
      required: ['name', 'dateOfBirth', 'species', 'sex', 'weight', 'breed'],
      additionalProperties: false
    }
  };

  config = {
    timeout: 8000, // Longer timeout for database operations
    retries: 2,
    retryDelay: 1500
  };

  async execute(input: RegisterPetInputType, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await PetService.registerPet(
        input.name,
        input.dateOfBirth,
        input.species,
        input.sex,
        input.weight,
        input.breed,
        context.userPhone
      );

      if (result.success) {
        console.log(`[${context.requestId}] Pet registered:`, result.data);
        return { ok: true, data: result.data };
      } else {
        return { ok: false, error: result.error };
      }

    } catch (error) {
      console.error(`[${context.requestId}] Register pet failed:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al registrar mascota'
      };
    }
  }
}