import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetRepository } from '@/mcp/repository';

const ListConsultationsArgs = z.object({
  petName: z.string().optional().describe('Optional pet name to filter consultations')
});

type ListConsultationsInputType = z.infer<typeof ListConsultationsArgs>;

export class ListConsultationsTool implements ToolHandler<ListConsultationsInputType> {
  name = 'list_consultations';
  schema = ListConsultationsArgs;

  definition = {
    name: 'list_consultations',
    description: 'List consultations for user pets, optionally filtered by pet name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        petName: { type: 'string' as const, description: 'Optional pet name to filter consultations (case insensitive)' }
      },
      additionalProperties: false
    }
  };

  config = {
    timeout: 8000,
    retries: 2,
    retryDelay: 1500
  };

  private repository = new PetRepository();

  async execute(input: ListConsultationsInputType, context: ToolContext): Promise<ToolResult> {
    try {
      // First get user's pets
      const petsResult = await this.repository.listPetsByUserPhone(context.userPhone);

      if (!petsResult.success || !petsResult.data) {
        return {
          ok: false,
          error: 'No se encontraron mascotas registradas para este usuario'
        };
      }

      const pets = petsResult.data;

      // Filter pets by name if provided
      let targetPets = pets;
      if (input.petName) {
        targetPets = pets.filter(pet =>
          pet.name.toLowerCase().includes(input.petName!.toLowerCase())
        );

        if (targetPets.length === 0) {
          return {
            ok: false,
            error: `No se encontró ninguna mascota con el nombre "${input.petName}"`
          };
        }
      }

      // Get consultations for each target pet
      const allConsultations = [];
      for (const pet of targetPets) {
        const consultationsResult = await this.repository.listConsultationsMinimal(pet.id);

        if (consultationsResult.success && consultationsResult.data) {
          allConsultations.push(...consultationsResult.data.map(consultation => ({
            ...consultation,
            petName: pet.name,
            petSpecies: pet.species
          })));
        }
      }

      // Sort by date descending
      allConsultations.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      console.log(`[${context.requestId}] Listed ${allConsultations.length} consultations for ${targetPets.length} pets`);

      return {
        ok: true,
        data: {
          consultations: allConsultations,
          totalCount: allConsultations.length,
          petsIncluded: targetPets.map(pet => ({
            id: pet.id,
            name: pet.name,
            species: pet.species
          }))
        }
      };

    } catch (error) {
      console.error(`[${context.requestId}] List consultations failed:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al listar consultas'
      };
    }
  }
}