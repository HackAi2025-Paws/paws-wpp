import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { InputNormalizer } from '../input-normalizer';
import { PetRepository } from '@/mcp/repository';
import { RegisterPetSchema, RegisterPetInput } from '@/mcp/types';

const RegisterPetArgs = z.object({
  name: z.string().min(1, 'Pet name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  species: z.enum(['CAT', 'DOG'], { errorMap: () => ({ message: 'Species must be CAT or DOG' }) })
});

type RegisterPetInputType = z.infer<typeof RegisterPetArgs>;

export class RegisterPetTool implements ToolHandler<RegisterPetInputType> {
  name = 'register_pet';
  schema = RegisterPetArgs;

  definition = {
    name: 'register_pet',
    description: 'Register a new pet. Only call if you have clear name and species.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const, description: 'Pet name' },
        dateOfBirth: { type: 'string' as const, description: 'Pet birth date in any clear format' },
        species: { type: 'string' as const, enum: ['CAT', 'DOG'], description: 'Must be exactly CAT or DOG' }
      },
      required: ['name', 'dateOfBirth', 'species'],
      additionalProperties: false
    }
  };

  config = {
    timeout: 8000, // Longer timeout for database operations
    retries: 2,
    retryDelay: 1500
  };

  private repository = new PetRepository();

  async execute(input: RegisterPetInputType, context: ToolContext): Promise<ToolResult> {
    try {
      // Normalize inputs and inject trusted phone
      const normalizedInput = {
        name: InputNormalizer.normalizeName(input.name),
        species: InputNormalizer.normalizeSpecies(input.species),
        dateOfBirth: InputNormalizer.normalizeDate(input.dateOfBirth),
        ownerPhone: context.userPhone // Always use trusted phone from context
      };

      // Validate normalized inputs
      const validatedArgs = RegisterPetSchema.parse(normalizedInput) as RegisterPetInput;

      // Check for duplicate pets (idempotency check)
      const existingPets = await this.repository.listPetsByUserPhone(context.userPhone);
      if (existingPets.success && existingPets.data) {
        const duplicate = existingPets.data.find(pet =>
          pet.name.toLowerCase() === validatedArgs.name.toLowerCase() &&
          pet.species === validatedArgs.species
        );

        if (duplicate) {
          console.log(`[${context.requestId}] Pet already exists:`, duplicate);
          return {
            ok: true,
            data: {
              ...duplicate,
              message: 'Esta mascota ya estaba registrada'
            }
          };
        }
      }

      // Create new pet
      const result = await this.repository.createPetForUser(
        validatedArgs.name,
        new Date(validatedArgs.dateOfBirth),
        validatedArgs.species,
        validatedArgs.ownerPhone
      );

      if (result.success) {
        console.log(`[${context.requestId}] Pet registered:`, result.data);
        return { ok: true, data: result.data };
      } else {
        return { ok: false, error: result.error };
      }

    } catch (error) {
      console.error(`[${context.requestId}] Register pet failed:`, error);

      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid species')) {
          return { ok: false, error: 'Especie de mascota no reconocida. Debe ser "perro" o "gato".' };
        }
        if (error.message.includes('Invalid date')) {
          return { ok: false, error: 'Fecha no válida. Proporciona una fecha específica como "15 de enero de 2022".' };
        }
        if (error.message.includes('validation')) {
          return { ok: false, error: 'Datos de mascota no válidos. Verifica el nombre, fecha de nacimiento y especie.' };
        }
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al registrar mascota'
      };
    }
  }
}