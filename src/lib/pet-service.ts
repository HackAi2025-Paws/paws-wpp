import { prisma } from './prisma'
import { InputNormalizer } from './input-normalizer'
import { Species } from '@prisma/client'

export interface PetRegistrationResult {
  success: boolean
  data?: {
    id: number
    name: string
    dateOfBirth: string
    species: Species
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
    owners: Array<{
      id: number
      name: string
      phone: string
    }>
  }>
  error?: string
}

export class PetService {
  static async registerPet(
    name: string,
    dateOfBirth: string,
    species: string,
    ownerPhone: string
  ): Promise<PetRegistrationResult> {
    try {
      // Normalize inputs
      const normalizedName = InputNormalizer.normalizeName(name)
      const normalizedSpecies = InputNormalizer.normalizeSpecies(species)
      const normalizedDate = InputNormalizer.normalizeDate(dateOfBirth)

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
}