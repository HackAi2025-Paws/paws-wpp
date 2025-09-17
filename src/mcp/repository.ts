import { prisma } from '@/lib/prisma';
import { Species } from '@prisma/client';
import { UserResult, PetResult, OperationResult, ConsultationResult, ConsultationListResult, CreateConsultationInput, CreateConsultationMcpInput } from './types';

export class PetRepository {
  async upsertUserByPhone(name: string, phone: string): Promise<OperationResult<UserResult>> {
    try {
      const user = await prisma.user.upsert({
        where: { phone },
        update: { name },
        create: { name, phone },
      });

      return {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          phone: user.phone,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to upsert user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async fetchUserByPhone(phone: string): Promise<OperationResult<UserResult>> {
    try {
      const user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          phone: user.phone,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async listPetsByUserPhone(phone: string): Promise<OperationResult<PetResult[]>> {
    try {
      const user = await prisma.user.findUnique({
        where: { phone },
        include: {
          pets: {
            include: {
              owners: true,
            },
          },
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const pets: PetResult[] = user.pets.map(pet => ({
        id: pet.id,
        name: pet.name,
        dateOfBirth: pet.dateOfBirth.toISOString(),
        species: pet.species,
        owners: pet.owners.map(owner => ({
          id: owner.id,
          name: owner.name,
          phone: owner.phone,
        })),
      }));

      return {
        success: true,
        data: pets,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list pets: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async createPetForUser(
    name: string,
    dateOfBirth: Date,
    species: Species,
    ownerPhone: string
  ): Promise<OperationResult<PetResult>> {
    try {
      const user = await prisma.user.findUnique({
        where: { phone: ownerPhone },
      });

      if (!user) {
        return {
          success: false,
          error: 'Owner not found. Please register the user first.',
        };
      }

      const pet = await prisma.pet.create({
        data: {
          name,
          dateOfBirth,
          species,
          owners: {
            connect: { id: user.id },
          },
        },
        include: {
          owners: true,
        },
      });

      return {
        success: true,
        data: {
          id: pet.id,
          name: pet.name,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          species: pet.species,
          owners: pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create pet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async createConsultation(input: CreateConsultationInput): Promise<OperationResult<ConsultationResult>> {
    try {
      const consultation = await prisma.consultation.create({
        data: {
          petId: input.petId,
          userId: input.userId,
          date: new Date(input.date),
          chiefComplaint: input.chiefComplaint,
          findings: input.findings,
          diagnosis: input.diagnosis,
          treatment: input.treatment,
          nextSteps: input.nextSteps,
          additionalNotes: input.additionalNotes,
        },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
        },
      });

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          treatment: consultation.treatment,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          createdAt: consultation.createdAt.toISOString(),
          pet: {
            id: consultation.pet.id,
            name: consultation.pet.name,
            dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
            species: consultation.pet.species,
            owners: consultation.pet.owners.map(owner => ({
              id: owner.id,
              name: owner.name,
              phone: owner.phone,
            })),
          },
          user: {
            id: consultation.user.id,
            name: consultation.user.name,
            phone: consultation.user.phone,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getConsultationById(id: number): Promise<OperationResult<ConsultationResult>> {
    try {
      const consultation = await prisma.consultation.findUnique({
        where: { id },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
        },
      });

      if (!consultation) {
        return {
          success: false,
          error: 'Consultation not found',
        };
      }

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          treatment: consultation.treatment,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          createdAt: consultation.createdAt.toISOString(),
          pet: {
            id: consultation.pet.id,
            name: consultation.pet.name,
            dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
            species: consultation.pet.species,
            owners: consultation.pet.owners.map(owner => ({
              id: owner.id,
              name: owner.name,
              phone: owner.phone,
            })),
          },
          user: {
            id: consultation.user.id,
            name: consultation.user.name,
            phone: consultation.user.phone,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getConsultationsByPetId(petId: number): Promise<OperationResult<ConsultationResult[]>> {
    try {
      const consultations = await prisma.consultation.findMany({
        where: { petId },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults: ConsultationResult[] = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        treatment: consultation.treatment,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        createdAt: consultation.createdAt.toISOString(),
        pet: {
          id: consultation.pet.id,
          name: consultation.pet.name,
          dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
          species: consultation.pet.species,
          owners: consultation.pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
          })),
        },
        user: {
          id: consultation.user.id,
          name: consultation.user.name,
          phone: consultation.user.phone,
        },
      }));

      return {
        success: true,
        data: consultationResults,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get consultations by pet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getConsultationsByUserId(userId: number): Promise<OperationResult<ConsultationResult[]>> {
    try {
      const consultations = await prisma.consultation.findMany({
        where: { userId },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults: ConsultationResult[] = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        treatment: consultation.treatment,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        createdAt: consultation.createdAt.toISOString(),
        pet: {
          id: consultation.pet.id,
          name: consultation.pet.name,
          dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
          species: consultation.pet.species,
          owners: consultation.pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
          })),
        },
        user: {
          id: consultation.user.id,
          name: consultation.user.name,
          phone: consultation.user.phone,
        },
      }));

      return {
        success: true,
        data: consultationResults,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get consultations by user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async updateConsultation(
    id: number,
    updates: Partial<Omit<CreateConsultationInput, 'petId' | 'userId'>>
  ): Promise<OperationResult<ConsultationResult>> {
    try {
      const consultation = await prisma.consultation.update({
        where: { id },
        data: {
          ...(updates.date && { date: new Date(updates.date) }),
          ...(updates.chiefComplaint && { chiefComplaint: updates.chiefComplaint }),
          ...(updates.findings !== undefined && { findings: updates.findings }),
          ...(updates.diagnosis !== undefined && { diagnosis: updates.diagnosis }),
          ...(updates.treatment !== undefined && { treatment: updates.treatment }),
          ...(updates.nextSteps !== undefined && { nextSteps: updates.nextSteps }),
          ...(updates.additionalNotes !== undefined && { additionalNotes: updates.additionalNotes }),
        },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
        },
      });

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          treatment: consultation.treatment,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          createdAt: consultation.createdAt.toISOString(),
          pet: {
            id: consultation.pet.id,
            name: consultation.pet.name,
            dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
            species: consultation.pet.species,
            owners: consultation.pet.owners.map(owner => ({
              id: owner.id,
              name: owner.name,
              phone: owner.phone,
            })),
          },
          user: {
            id: consultation.user.id,
            name: consultation.user.name,
            phone: consultation.user.phone,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async deleteConsultation(id: number): Promise<OperationResult<boolean>> {
    try {
      await prisma.consultation.delete({
        where: { id },
      });

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async listConsultationsMinimal(petId?: number, userId?: number): Promise<OperationResult<ConsultationListResult[]>> {
    try {
      const whereClause: any = {};
      if (petId) whereClause.petId = petId;
      if (userId) whereClause.userId = userId;

      const consultations = await prisma.consultation.findMany({
        where: whereClause,
        select: {
          id: true,
          petId: true,
          userId: true,
          date: true,
          chiefComplaint: true,
          diagnosis: true,
          pet: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults: ConsultationListResult[] = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        diagnosis: consultation.diagnosis,
        petName: consultation.pet.name,
        userName: consultation.user.name,
      }));

      return {
        success: true,
        data: consultationResults,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list consultations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async createConsultationByPhone(input: CreateConsultationMcpInput): Promise<OperationResult<ConsultationResult>> {
    try {
      const user = await prisma.user.findUnique({
        where: { phone: input.ownerPhone },
        include: {
          pets: true,
        },
      });

      if (!user) {
        return {
          success: false,
          error: `No user found with phone number ${input.ownerPhone}. Please register the user first.`,
        };
      }

      const matchingPets = user.pets.filter(pet =>
        pet.name.toLowerCase() === input.petName.toLowerCase()
      );

      if (matchingPets.length === 0) {
        return {
          success: false,
          error: `No pet named "${input.petName}" found for user ${user.name}. Available pets: ${user.pets.map(p => p.name).join(', ')}.`,
        };
      }

      if (matchingPets.length > 1) {
        const petDetails = matchingPets.map(pet =>
          `${pet.name} (ID: ${pet.id}, ${pet.species}, born: ${pet.dateOfBirth.toISOString().split('T')[0]})`
        ).join(', ');

        return {
          success: false,
          error: `Multiple pets named "${input.petName}" found for user ${user.name}. Please specify which pet: ${petDetails}. Use the create_consultation_with_pet_id tool instead.`,
        };
      }

      const pet = matchingPets[0];

      const consultation = await prisma.consultation.create({
        data: {
          petId: pet.id,
          userId: user.id,
          date: new Date(input.date),
          chiefComplaint: input.chiefComplaint,
          findings: input.findings,
          diagnosis: input.diagnosis,
          treatment: input.treatment,
          nextSteps: input.nextSteps,
          additionalNotes: input.additionalNotes,
        },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
        },
      });

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          treatment: consultation.treatment,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          createdAt: consultation.createdAt.toISOString(),
          pet: {
            id: consultation.pet.id,
            name: consultation.pet.name,
            dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
            species: consultation.pet.species,
            owners: consultation.pet.owners.map(owner => ({
              id: owner.id,
              name: owner.name,
              phone: owner.phone,
            })),
          },
          user: {
            id: consultation.user.id,
            name: consultation.user.name,
            phone: consultation.user.phone,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create consultation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}