import { prisma } from './prisma'

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