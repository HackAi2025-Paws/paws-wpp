import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetRepository } from '@/mcp/repository';

const GetConsultationArgs = z.object({
  id: z.number().optional().describe('Consultation ID'),
  petName: z.string().optional().describe('Pet name to filter consultations'),
  chiefComplaint: z.string().optional().describe('Search by chief complaint keywords'),
  diagnosis: z.string().optional().describe('Search by diagnosis keywords'),
  date: z.string().optional().describe('Search by date (YYYY-MM-DD or partial match)')
});

type GetConsultationInputType = z.infer<typeof GetConsultationArgs>;

export class GetConsultationTool implements ToolHandler<GetConsultationInputType> {
  name = 'get_consultation';
  schema = GetConsultationArgs;

  definition = {
    name: 'get_consultation',
    description: 'Get detailed consultation information. Can search by ID, pet name, chief complaint, diagnosis, or date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number' as const, description: 'Specific consultation ID' },
        petName: { type: 'string' as const, description: 'Pet name to filter consultations (case insensitive)' },
        chiefComplaint: { type: 'string' as const, description: 'Search consultations by chief complaint keywords' },
        diagnosis: { type: 'string' as const, description: 'Search consultations by diagnosis keywords' },
        date: { type: 'string' as const, description: 'Search by date (YYYY-MM-DD or partial date)' }
      },
      additionalProperties: false
    }
  };

  config = {
    timeout: 10000,
    retries: 2,
    retryDelay: 2000
  };

  private repository = new PetRepository();

  async execute(input: GetConsultationInputType, context: ToolContext): Promise<ToolResult> {
    try {
      // If ID is provided, get specific consultation
      if (input.id) {
        const result = await this.repository.getConsultationById(input.id);

        if (!result.success) {
          return {
            ok: false,
            error: result.error || 'Consulta no encontrada'
          };
        }

        // Verify the consultation belongs to the user
        const userPets = await this.repository.listPetsByUserPhone(context.userPhone);
        if (!userPets.success || !userPets.data) {
          return {
            ok: false,
            error: 'No se encontraron mascotas registradas'
          };
        }

        const userPetIds = userPets.data.map(pet => pet.id);
        if (!userPetIds.includes(result.data!.petId)) {
          return {
            ok: false,
            error: 'La consulta no pertenece a tus mascotas'
          };
        }

        console.log(`[${context.requestId}] Retrieved consultation ${input.id} for user`);
        return {
          ok: true,
          data: result.data
        };
      }

      // Otherwise, search consultations by other criteria
      const userPets = await this.repository.listPetsByUserPhone(context.userPhone);
      if (!userPets.success || !userPets.data || userPets.data.length === 0) {
        return {
          ok: false,
          error: 'No se encontraron mascotas registradas'
        };
      }

      // Filter pets by name if provided
      let targetPets = userPets.data;
      if (input.petName) {
        targetPets = userPets.data.filter(pet =>
          pet.name.toLowerCase().includes(input.petName!.toLowerCase())
        );

        if (targetPets.length === 0) {
          return {
            ok: false,
            error: `No se encontró ninguna mascota con el nombre "${input.petName}"`
          };
        }
      }

      // Get all consultations for target pets
      const allConsultations = [];
      for (const pet of targetPets) {
        const consultationsResult = await this.repository.listConsultationsMinimal(pet.id);

        if (consultationsResult.success && consultationsResult.data) {
          // Get detailed information for each consultation
          for (const consultation of consultationsResult.data) {
            const detailedResult = await this.repository.getConsultationById(consultation.id);
            if (detailedResult.success && detailedResult.data) {
              allConsultations.push({
                ...detailedResult.data,
                petName: pet.name,
                petSpecies: pet.species
              });
            }
          }
        }
      }

      // Apply filters
      let filteredConsultations = allConsultations;

      // Filter by chief complaint
      if (input.chiefComplaint) {
        const searchTerm = input.chiefComplaint.toLowerCase();
        filteredConsultations = filteredConsultations.filter(consultation =>
          consultation.chiefComplaint?.toLowerCase().includes(searchTerm)
        );
      }

      // Filter by diagnosis
      if (input.diagnosis) {
        const searchTerm = input.diagnosis.toLowerCase();
        filteredConsultations = filteredConsultations.filter(consultation =>
          consultation.diagnosis?.toLowerCase().includes(searchTerm)
        );
      }

      // Filter by date
      if (input.date) {
        const searchDate = input.date;
        filteredConsultations = filteredConsultations.filter(consultation => {
          const consultationDate = new Date(consultation.date).toISOString().split('T')[0];
          return consultationDate.includes(searchDate);
        });
      }

      if (filteredConsultations.length === 0) {
        return {
          ok: false,
          error: 'No se encontraron consultas que coincidan con los criterios de búsqueda'
        };
      }

      // Sort by date descending
      filteredConsultations.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      console.log(`[${context.requestId}] Found ${filteredConsultations.length} consultations matching search criteria`);

      // Return single consultation if only one found, otherwise return array
      if (filteredConsultations.length === 1) {
        return {
          ok: true,
          data: filteredConsultations[0]
        };
      } else {
        return {
          ok: true,
          data: {
            consultations: filteredConsultations,
            totalCount: filteredConsultations.length,
            message: `Se encontraron ${filteredConsultations.length} consultas`
          }
        };
      }

    } catch (error) {
      console.error(`[${context.requestId}] Get consultation failed:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido al obtener consulta'
      };
    }
  }
}