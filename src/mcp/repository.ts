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
          consultationType: input.consultationType,  // Campo obligatorio
          chiefComplaint: input.chiefComplaint,
          findings: input.findings || null,
          diagnosis: input.diagnosis || null,
          nextSteps: input.nextSteps || null,
          additionalNotes: input.additionalNotes || null,
          nextConsultation: input.nextConsultation ? new Date(input.nextConsultation) : null,
          treatment: input.treatment ? {
            create: input.treatment.map(t => ({
              name: t.name,
              startDate: new Date(t.startDate),
              endDate: t.endDate ? new Date(t.endDate) : null,
              notes: t.notes || null,
              petId: input.petId,
              authorId: input.userId
            }))
          } : undefined,
          // Crear vacunas relacionadas si se proporcionan
          vaccines: input.vaccines ? {
            create: input.vaccines.map(v => ({
              catalogId: v.catalogId,
              applicationDate: new Date(v.applicationDate),
              expirationDate: v.expirationDate ? new Date(v.expirationDate) : null,
              batchNumber: v.batchNumber || null,
              notes: v.notes || null,
              petId: input.petId,
              authorId: input.userId
            }))
          } : undefined,
        },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
          treatment: true,
          vaccines: {
            include: {
              catalog: true
            }
          }
        },
      });

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          date: consultation.date.toISOString(),
          consultationType: consultation.consultationType,
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          nextConsultation: consultation.nextConsultation?.toISOString() || null,
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
          // Mapear tratamientos
          treatment: consultation.treatment.map(t => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate.toISOString(),
            endDate: t.endDate?.toISOString() || null,
            notes: t.notes,
            petId: t.petId,
            authorId: t.authorId,
          })),
          // Mapear vacunas
          vaccines: consultation.vaccines.map(v => ({
            id: v.id,
            catalogId: v.catalogId,
            applicationDate: v.applicationDate.toISOString(),
            expirationDate: v.expirationDate?.toISOString() || null,
            batchNumber: v.batchNumber,
            notes: v.notes,
            petId: v.petId,
            authorId: v.authorId,
            catalog: v.catalog ? {
              name: v.catalog.name,
              description: v.catalog.description
            } : undefined,
          })),
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
          treatment: true, // Incluir la relación treatment
          vaccines: {      // También incluir vaccines para ser consistente
            include: {
              catalog: true,
            },
          },
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
          consultationType: consultation.consultationType,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          nextConsultation: consultation.nextConsultation?.toISOString() || null,
          createdAt: consultation.createdAt.toISOString(),
          treatment: consultation.treatment.map(t => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate.toISOString(),
            endDate: t.endDate?.toISOString() || null,
            notes: t.notes,
            petId: t.petId,
            authorId: t.authorId,
          })),
          vaccines: consultation.vaccines.map(v => ({
            id: v.id,
            catalogId: v.catalogId,
            applicationDate: v.applicationDate.toISOString(),
            expirationDate: v.expirationDate?.toISOString() || null,
            batchNumber: v.batchNumber,
            notes: v.notes,
            petId: v.petId,
            authorId: v.authorId,
            catalog: v.catalog ? {
              name: v.catalog.name,
              description: v.catalog.description
            } : undefined,
          })),
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
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults: ConsultationResult[] = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        consultationType: consultation.consultationType,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        nextConsultation: consultation.nextConsultation?.toISOString() || null,
        createdAt: consultation.createdAt.toISOString(),
        treatment: consultation.treatment.map(t => ({
          id: t.id,
          name: t.name,
          startDate: t.startDate.toISOString(),
          endDate: t.endDate?.toISOString() || null,
          notes: t.notes,
          petId: t.petId,
          authorId: t.authorId,
        })),
        vaccines: consultation.vaccines.map(v => ({
          id: v.id,
          catalogId: v.catalogId,
          applicationDate: v.applicationDate.toISOString(),
          expirationDate: v.expirationDate?.toISOString() || null,
          batchNumber: v.batchNumber,
          notes: v.notes,
          petId: v.petId,
          authorId: v.authorId,
          catalog: v.catalog ? {
            name: v.catalog.name,
            description: v.catalog.description
          } : undefined,
        })),
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
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults: ConsultationResult[] = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        consultationType: consultation.consultationType,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        nextConsultation: consultation.nextConsultation?.toISOString() || null,
        createdAt: consultation.createdAt.toISOString(),
        treatment: consultation.treatment.map(t => ({
          id: t.id,
          name: t.name,
          startDate: t.startDate.toISOString(),
          endDate: t.endDate?.toISOString() || null,
          notes: t.notes,
          petId: t.petId,
          authorId: t.authorId,
        })),
        vaccines: consultation.vaccines.map(v => ({
          id: v.id,
          catalogId: v.catalogId,
          applicationDate: v.applicationDate.toISOString(),
          expirationDate: v.expirationDate?.toISOString() || null,
          batchNumber: v.batchNumber,
          notes: v.notes,
          petId: v.petId,
          authorId: v.authorId,
          catalog: v.catalog ? {
            name: v.catalog.name,
            description: v.catalog.description
          } : undefined,
        })),
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

      const existingConsultation = await prisma.consultation.findUnique({
        where: { id },
        include: {
          treatment: true,
          vaccines: true,
        },
      });

      if (!existingConsultation) {
        return {
          success: false,
          error: 'Consultation not found',
        };
      }

      const updateData: any = {
        ...(updates.date && { date: new Date(updates.date) }),
        ...(updates.chiefComplaint && { chiefComplaint: updates.chiefComplaint }),
        ...(updates.findings !== undefined && { findings: updates.findings }),
        ...(updates.diagnosis !== undefined && { diagnosis: updates.diagnosis }),
        ...(updates.nextSteps !== undefined && { nextSteps: updates.nextSteps }),
        ...(updates.additionalNotes !== undefined && { additionalNotes: updates.additionalNotes }),
        ...(updates.consultationType && { consultationType: updates.consultationType }),
        ...(updates.nextConsultation !== undefined && {
          nextConsultation: updates.nextConsultation ? new Date(updates.nextConsultation) : null
        }),
      };

      if (updates.treatment) {
        updateData.treatment = {
          deleteMany: {},
          create: updates.treatment.map(t => ({
            name: t.name,
            startDate: new Date(t.startDate),
            endDate: t.endDate ? new Date(t.endDate) : null,
            notes: t.notes || null,
            petId: existingConsultation.petId,
            authorId: existingConsultation.userId,
          })),
        };
      }

      if (updates.vaccines) {
        updateData.vaccines = {
          deleteMany: {},
          create: updates.vaccines.map(v => ({
            catalogId: v.catalogId,
            applicationDate: new Date(v.applicationDate),
            expirationDate: v.expirationDate ? new Date(v.expirationDate) : null,
            batchNumber: v.batchNumber || null,
            notes: v.notes || null,
            petId: existingConsultation.petId,
            authorId: existingConsultation.userId,
          })),
        };
      }

      const consultation = await prisma.consultation.update({
        where: { id },
        data: updateData,
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
      });

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          consultationType: consultation.consultationType,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          nextConsultation: consultation.nextConsultation?.toISOString() || null,
          createdAt: consultation.createdAt.toISOString(),
          treatment: consultation.treatment.map(t => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate.toISOString(),
            endDate: t.endDate?.toISOString() || null,
            notes: t.notes,
            petId: t.petId,
            authorId: t.authorId,
          })),
          vaccines: consultation.vaccines.map(v => ({
            id: v.id,
            catalogId: v.catalogId,
            applicationDate: v.applicationDate.toISOString(),
            expirationDate: v.expirationDate?.toISOString() || null,
            batchNumber: v.batchNumber,
            notes: v.notes,
            petId: v.petId,
            authorId: v.authorId,
            catalog: v.catalog ? {
              name: v.catalog.name,
              description: v.catalog.description
            } : undefined,
          })),
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

      let treatmentData = undefined;
      if (input.treatment) {
        treatmentData = {
          create: [{
            name: input.treatment,
            startDate: new Date(input.date),
            notes: null,
            petId: pet.id,
            authorId: user.id
          }]
        };
      }

      const consultation = await prisma.consultation.create({
        data: {
          petId: pet.id,
          userId: user.id,
          consultationType: 'GENERAL_CONSULTATION',
          date: new Date(input.date),
          chiefComplaint: input.chiefComplaint,
          findings: input.findings || null,
          diagnosis: input.diagnosis || null,
          nextSteps: input.nextSteps || null,
          additionalNotes: input.additionalNotes || null,
          treatment: treatmentData,
        },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
      });

      return {
        success: true,
        data: {
          id: consultation.id,
          petId: consultation.petId,
          userId: consultation.userId,
          consultationType: consultation.consultationType,
          date: consultation.date.toISOString(),
          chiefComplaint: consultation.chiefComplaint,
          findings: consultation.findings,
          diagnosis: consultation.diagnosis,
          nextSteps: consultation.nextSteps,
          additionalNotes: consultation.additionalNotes,
          nextConsultation: consultation.nextConsultation?.toISOString() || null,
          createdAt: consultation.createdAt.toISOString(),
          treatment: consultation.treatment.map(t => ({
            id: t.id,
            name: t.name,
            startDate: t.startDate.toISOString(),
            endDate: t.endDate?.toISOString() || null,
            notes: t.notes,
            petId: t.petId,
            authorId: t.authorId,
          })),
          vaccines: consultation.vaccines.map(v => ({
            id: v.id,
            catalogId: v.catalogId,
            applicationDate: v.applicationDate.toISOString(),
            expirationDate: v.expirationDate?.toISOString() || null,
            batchNumber: v.batchNumber,
            notes: v.notes,
            petId: v.petId,
            authorId: v.authorId,
            catalog: v.catalog ? {
              name: v.catalog.name,
              description: v.catalog.description
            } : undefined,
          })),
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