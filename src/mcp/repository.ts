import { prisma } from '@/lib/prisma';
import { Species } from '@prisma/client';
import { UserResult, PetResult, OperationResult } from './types';

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
}