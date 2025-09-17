import { prisma } from './prisma'
import { InputNormalizer } from './input-normalizer'

export interface UserRegistrationResult {
  success: boolean
  data?: {
    id: number
    name: string
    phone: string
  }
  error?: string
}

export class UserService {
  static async findUserByPhone(phoneNumber: string) {
    // Clean the phone number (remove whatsapp: prefix and normalize)
    const cleanPhone = phoneNumber.replace('whatsapp:', '').replace('+', '')

    try {
      const user = await prisma.user.findFirst({
        where: {
          phone: {
            contains: cleanPhone
          }
        },
        include: {
          pets: true
        }
      })

      return user
    } catch (error) {
      console.error('Error finding user by phone:', error)
      return null
    }
  }

  static async registerUser(name: string, phone: string): Promise<UserRegistrationResult> {
    try {
      // Normalize the name input
      const normalizedName = InputNormalizer.normalizeName(name)

      if (!normalizedName || normalizedName.trim().length === 0) {
        return {
          success: false,
          error: 'Nombre de usuario no válido. Proporciona un nombre completo.'
        }
      }

      // Upsert user (create or update if exists)
      const user = await prisma.user.upsert({
        where: { phone },
        update: { name: normalizedName },
        create: { name: normalizedName, phone }
      })

      return {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          phone: user.phone
        }
      }
    } catch (error) {
      console.error('Error registering user:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al registrar usuario'
      }
    }
  }

  static async fetchUserByPhone(phone: string): Promise<UserRegistrationResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { phone }
      })

      if (!user) {
        return {
          success: false,
          error: 'Usuario no encontrado'
        }
      }

      return {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          phone: user.phone
        }
      }
    } catch (error) {
      console.error('Error fetching user by phone:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al buscar usuario'
      }
    }
  }

  static async getUserPets(phoneNumber: string) {
    const user = await this.findUserByPhone(phoneNumber)
    return user ? user.pets : []
  }

  static formatPetsMessage(pets: { name: string; species: string; dateOfBirth: Date }[]) {
    if (pets.length === 0) {
      return "Aún no tienes mascotas registradas. ¿Te gustaría registrar una mascota? 🐾"
    }

    let message = `Aquí están tus mascotas registradas:\n\n`
    pets.forEach((pet, index) => {
      const age = this.calculateAge(pet.dateOfBirth)
      const emoji = pet.species === 'DOG' ? '🐕' : '🐱'
      const speciesText = pet.species.toLowerCase() === 'dog' ? 'perro' : 'gato'
      message += `${index + 1}. ${emoji} ${pet.name}\n   Especie: ${speciesText}\n   Edad: ${age}\n\n`
    })

    return message.trim()
  }

  static formatRegistrationPrompt() {
    return `¡Bienvenido! 🐾 Parece que todavía no estás registrado.

Para comenzar y registrar a tu mascota, por favor proporcioná:
• Tu nombre
• El nombre de tu mascota
• La especie de tu mascota (perro o gato)
• La fecha de nacimiento de tu mascota

También podés visitar nuestro sitio web para registrarte: [Enlace de registro]`
  }

  private static calculateAge(dateOfBirth: Date): string {
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
}