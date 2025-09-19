import { prisma } from './prisma'
import { InputNormalizer } from './input-normalizer'
import { Species, Sex } from '@prisma/client'

export interface PetRegistrationResult {
  success: boolean
  data?: {
    id: number
    name: string
    dateOfBirth: string
    species: Species
    sex?: Sex | null
    weight?: number | null
    breed?: string | null
    owners: Array<{
      id: number
      name: string
      phone: string
    }>
    message?: string
  }
  error?: string
}

export interface PetListResult {
  success: boolean
  data?: Array<{
    id: number
    name: string
    dateOfBirth: string
    species: Species
    sex?: Sex | null
    weight?: number | null
    breed?: string | null
    owners: Array<{
      id: number
      name: string
      phone: string
    }>
  }>
  error?: string
}

export interface PetDetailResult {
  success: boolean
  data?: {
    id: number
    name: string
    dateOfBirth: string
    age: string
    species: Species
    sex?: Sex | null
    weight?: number | null
    breed?: string | null
    owners: Array<{
      id: number
      name: string
      phone: string
    }>
    consultations: Array<{
      id: number
      date: string
      chiefComplaint: string
      consultationType: string
      findings?: string | null
      diagnosis?: string | null
      nextSteps?: string | null
      additionalNotes?: string | null
      nextConsultation: string | null
      user: {
        id: number
        name: string
        phone: string
        role: string
      }
    }>
    vaccines: Array<{
      id: number
      applicationDate: string
      expirationDate?: string | null
      batchNumber?: string | null
      notes?: string | null
      vaccine: {
        name: string
        description?: string | null
      }
    }>
    treatments: Array<{
      id: number
      name: string
      startDate: string
      endDate?: string | null
      notes?: string | null
    }>
    clinicalSummary?: string
  }
  error?: string
}

export class PetService {
  static async registerPet(
    name: string,
    dateOfBirth: string,
    species: string,
    sex: string,
    weight: number,
    breed: string,
    ownerPhone: string
  ): Promise<PetRegistrationResult> {
    try {
      // Normalize inputs
      const normalizedName = InputNormalizer.normalizeName(name)
      const normalizedSpecies = InputNormalizer.normalizeSpecies(species)
      const normalizedDate = InputNormalizer.normalizeDate(dateOfBirth)

      // Validate sex
      const validSex = sex.toUpperCase()
      if (validSex !== 'MALE' && validSex !== 'FEMALE') {
        return {
          success: false,
          error: 'Sexo no válido. Debe ser "MALE" o "FEMALE".'
        }
      }

      // Validate weight
      if (!weight || weight <= 0) {
        return {
          success: false,
          error: 'Peso no válido. Debe ser un número positivo.'
        }
      }

      // Validate breed
      if (!breed || breed.trim().length === 0) {
        return {
          success: false,
          error: 'Raza es requerida.'
        }
      }

      if (!normalizedName || normalizedName.trim().length === 0) {
        return {
          success: false,
          error: 'Nombre de mascota no válido. Proporciona un nombre válido.'
        }
      }

      if (!normalizedSpecies) {
        return {
          success: false,
          error: 'Especie de mascota no reconocida. Debe ser "perro" o "gato".'
        }
      }

      if (!normalizedDate) {
        return {
          success: false,
          error: 'Fecha no válida. Proporciona una fecha específica como "15 de enero de 2022".'
        }
      }

      // Find the owner user
      const user = await prisma.user.findUnique({
        where: { phone: ownerPhone }
      })

      if (!user) {
        return {
          success: false,
          error: 'Propietario no encontrado. Por favor registra al usuario primero.'
        }
      }

      // Check for duplicate pets (idempotency check)
      const existingPets = await this.listPetsByOwnerPhone(ownerPhone)
      if (existingPets.success && existingPets.data) {
        const duplicate = existingPets.data.find(pet =>
          pet.name.toLowerCase() === normalizedName.toLowerCase() &&
          pet.species === normalizedSpecies
        )

        if (duplicate) {
          return {
            success: true,
            data: {
              ...duplicate,
              message: 'Esta mascota ya estaba registrada'
            }
          }
        }
      }

      // Create new pet
      const pet = await prisma.pet.create({
        data: {
          name: normalizedName,
          dateOfBirth: new Date(normalizedDate),
          species: normalizedSpecies,
          sex: validSex as Sex,
          weight: weight,
          breed: breed.trim(),
          owners: {
            connect: { id: user.id }
          }
        },
        include: {
          owners: true
        }
      })

      return {
        success: true,
        data: {
          id: pet.id,
          name: pet.name,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          species: pet.species,
          sex: pet.sex,
          weight: pet.weight,
          breed: pet.breed,
          owners: pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone
          }))
        }
      }
    } catch (error) {
      console.error('Error registering pet:', error)

      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid species')) {
          return {
            success: false,
            error: 'Especie de mascota no reconocida. Debe ser "perro" o "gato".'
          }
        }
        if (error.message.includes('Invalid date')) {
          return {
            success: false,
            error: 'Fecha no válida. Proporciona una fecha específica como "15 de enero de 2022".'
          }
        }
        if (error.message.includes('validation')) {
          return {
            success: false,
            error: 'Datos de mascota no válidos. Verifica el nombre, fecha de nacimiento y especie.'
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al registrar mascota'
      }
    }
  }

  static async listPetsByOwnerPhone(ownerPhone: string): Promise<PetListResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { phone: ownerPhone },
        include: {
          pets: {
            include: {
              owners: true
            }
          }
        }
      })

      if (!user) {
        return {
          success: false,
          error: 'Usuario no encontrado'
        }
      }

      const pets = user.pets.map(pet => ({
        id: pet.id,
        name: pet.name,
        dateOfBirth: pet.dateOfBirth.toISOString(),
        species: pet.species,
        sex: pet.sex,
        weight: pet.weight,
        breed: pet.breed,
        owners: pet.owners.map(owner => ({
          id: owner.id,
          name: owner.name,
          phone: owner.phone
        }))
      }))

      return {
        success: true,
        data: pets
      }
    } catch (error) {
      console.error('Error listing pets by owner phone:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al listar mascotas'
      }
    }
  }

  static async getPetById(petId: number): Promise<PetRegistrationResult> {
    try {
      const pet = await prisma.pet.findUnique({
        where: { id: petId },
        include: {
          owners: true
        }
      })

      if (!pet) {
        return {
          success: false,
          error: 'Mascota no encontrada'
        }
      }

      return {
        success: true,
        data: {
          id: pet.id,
          name: pet.name,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          species: pet.species,
          sex: pet.sex,
          weight: pet.weight,
          breed: pet.breed,
          owners: pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone
          }))
        }
      }
    } catch (error) {
      console.error('Error getting pet by id:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al buscar mascota'
      }
    }
  }

  static async getPetDetails(petId: number): Promise<PetDetailResult> {
    try {
      const pet = await prisma.pet.findUnique({
        where: { id: petId },
        include: {
          owners: true,
          consultations: {
            include: {
              user: true
            },
            orderBy: {
              date: 'desc'
            }
          },
          vaccines: {
            include: {
              catalog: true
            },
            orderBy: {
              applicationDate: 'desc'
            }
          },
          treatment: {
            orderBy: {
              startDate: 'desc'
            }
          }
        }
      });

      if (!pet) {
        return {
          success: false,
          error: 'Mascota no encontrada'
        };
      }

      const age = this.calculateAge(pet.dateOfBirth);

      return {
        success: true,
        data: {
          id: pet.id,
          name: pet.name,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          age,
          species: pet.species,
          sex: pet.sex,
          weight: pet.weight,
          breed: pet.breed,
          owners: pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone
          })),
          consultations: pet.consultations.map(consultation => ({
            id: consultation.id,
            date: consultation.date.toISOString(),
            chiefComplaint: consultation.chiefComplaint,
            consultationType: consultation.consultationType,
            findings: consultation.findings,
            diagnosis: consultation.diagnosis,
            nextSteps: consultation.nextSteps,
            additionalNotes: consultation.additionalNotes,
            nextConsultation: consultation.nextConsultation ? consultation.nextConsultation.toISOString() : null,
            user: {
              id: consultation.user.id,
              name: consultation.user.name,
              phone: consultation.user.phone,
              role: consultation.user.role
            }
          })),
          vaccines: pet.vaccines.map(vaccine => ({
            id: vaccine.id,
            applicationDate: vaccine.applicationDate.toISOString(),
            expirationDate: vaccine.expirationDate ? vaccine.expirationDate.toISOString() : null,
            batchNumber: vaccine.batchNumber,
            notes: vaccine.notes,
            vaccine: {
              name: vaccine.catalog.name,
              description: vaccine.catalog.description
            }
          })),
          treatments: pet.treatment.map(treatment => ({
            id: treatment.id,
            name: treatment.name,
            startDate: treatment.startDate.toISOString(),
            endDate: treatment.endDate ? treatment.endDate.toISOString() : null,
            notes: treatment.notes
          })),
        }
      };
    } catch (error) {
      console.error('Error getting pet details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al obtener detalles de la mascota'
      };
    }
  }


  static calculateAge(dateOfBirth: Date): string {
    const today = new Date()
    const birth = new Date(dateOfBirth)
    const ageInMs = today.getTime() - birth.getTime()
    const ageInYears = Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365))
    const ageInMonths = Math.floor((ageInMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30))

    if (ageInYears > 0) {
      return `${ageInYears} año${ageInYears > 1 ? 's' : ''}`
    } else if (ageInMonths > 0) {
      return `${ageInMonths} mes${ageInMonths > 1 ? 'es' : ''}`
    } else {
      return 'Menos de un mes'
    }
  }

  static formatPetsMessage(pets: Array<{ name: string; species: string; dateOfBirth: string }>): string {
    if (pets.length === 0) {
      return "Aún no tienes mascotas registradas. ¿Te gustaría registrar una mascota? 🐾"
    }

    let message = `Aquí están tus mascotas registradas:\n\n`
    pets.forEach((pet, index) => {
      const age = this.calculateAge(new Date(pet.dateOfBirth))
      const emoji = pet.species === 'DOG' ? '🐕' : '🐱'
      const speciesText = pet.species.toLowerCase() === 'dog' ? 'perro' : 'gato'
      message += `${index + 1}. ${emoji} ${pet.name}\n   Especie: ${speciesText}\n   Edad: ${age}\n\n`
    })

    return message.trim()
  }

  static async searchPets(
    searchParams: { name?: string, breed?: string, ownerName?: string },
    paginationParams: { page?: number, limit?: number } = {}
  ): Promise<PetListResult & { pagination?: { total: number, page: number, limit: number, pages: number } }> {
    try {
      const page = paginationParams.page || 1;
      const limit = paginationParams.limit || 10;
      const skip = (page - 1) * limit;

      const whereConditions: any = {
        AND: []
      };

      if (searchParams.name) {
        whereConditions.AND.push({
          name: {
            contains: searchParams.name,
            mode: 'insensitive'
          }
        });
      }

      if (searchParams.breed) {
        whereConditions.AND.push({
          breed: {
            contains: searchParams.breed,
            mode: 'insensitive'
          }
        });
      }

      if (searchParams.ownerName) {
        whereConditions.AND.push({
          owners: {
            some: {
              name: {
                contains: searchParams.ownerName,
                mode: 'insensitive'
              }
            }
          }
        });
      }

      const finalWhereConditions = whereConditions.AND.length > 0 ? whereConditions : {};

      // Obtener el total de registros para la paginación
      const totalCount = await prisma.pet.count({
        where: finalWhereConditions
      });

      // Obtener los registros paginados
      const pets = await prisma.pet.findMany({
        where: finalWhereConditions,
        include: {
          owners: true
        },
        skip,
        take: limit,
        orderBy: { id: 'asc' }
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: pets.map(pet => ({
          id: pet.id,
          name: pet.name,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          species: pet.species,
          sex: pet.sex,
          weight: pet.weight,
          breed: pet.breed,
          owners: pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone
          }))
        })),
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: totalPages
        }
      };
    } catch (error) {
      console.error('Error searching pets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al buscar mascotas'
      };
    }
  }

  static async getPetsByOwnerId(
    ownerId: number,
    paginationParams: { page?: number, limit?: number } = {}
  ): Promise<PetListResult & { pagination?: { total: number, page: number, limit: number, pages: number } }> {
    try {
      const page = paginationParams.page || 1;
      const limit = paginationParams.limit || 10;
      const skip = (page - 1) * limit;

      // Verificar que el propietario existe
      const owner = await prisma.user.findUnique({
        where: { id: ownerId }
      });

      if (!owner) {
        return {
          success: false,
          error: 'Propietario no encontrado'
        };
      }

      // Obtener el total de mascotas para la paginación
      const totalCount = await prisma.pet.count({
        where: {
          owners: {
            some: { id: ownerId }
          }
        }
      });

      // Obtener las mascotas paginadas
      const pets = await prisma.pet.findMany({
        where: {
          owners: {
            some: { id: ownerId }
          }
        },
        include: {
          owners: true,
          vaccines: {
            include: {
              catalog: true
            },
            orderBy: {
              applicationDate: 'desc'
            }
          }
        },
        skip,
        take: limit,
        orderBy: { id: 'asc' }
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: pets.map(pet => ({
          id: pet.id,
          name: pet.name,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          species: pet.species,
          sex: pet.sex,
          weight: pet.weight,
          breed: pet.breed,
          owners: pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone
          }))
        })),
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: totalPages
        }
      };
    } catch (error) {
      console.error('Error getting pets by owner ID:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al obtener mascotas por ID de propietario'
      };
    }
  }
}