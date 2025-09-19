import { prisma } from '@/lib/prisma'

export interface ClinicalSummary {
  basic_information: {
    id: number
    name: string
    species: string
    sex?: string | null
    weight?: number | null
    breed?: string | null
    dateOfBirth: string
    age: string
  }
  history: {
    vaccines: Array<{
      id: number
      vaccineName: string
      applicationDate: string
      expirationDate?: string | null
      batchNumber?: string | null
      notes?: string | null
    }>
    treatments: Array<{
      id: number
      name: string
      startDate: string
      endDate?: string | null
      notes?: string | null
    }>
    known_allergies: string[]
    medications: string[]
  }
  last_consultation: {
    id: number
    date: string
    chiefComplaint: string
    consultationType: string
    findings?: string | null
    diagnosis?: string | null
    nextSteps?: string | null
    additionalNotes?: string | null
    nextConsultation?: string | null
  } | null
}

export interface ClinicalSummaryResult {
  success: boolean
  data?: ClinicalSummary
  error?: string
}

export class ClinicalHistoryService {
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

  static async getClinicalSummary(petId: number): Promise<ClinicalSummaryResult> {
    try {
      const pet = await prisma.pet.findUnique({
        where: { id: petId },
        include: {
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
          },
          consultations: {
            orderBy: {
              date: 'desc'
            },
            take: 1
          }
        }
      })

      if (!pet) {
        return {
          success: false,
          error: 'Mascota no encontrada'
        }
      }

      const speciesText = pet.species === 'DOG' ? 'Perro' : 'Gato'
      const sexText = pet.sex === 'MALE' ? 'Macho' : pet.sex === 'FEMALE' ? 'Hembra' : null

      const clinicalSummary: ClinicalSummary = {
        basic_information: {
          id: pet.id,
          name: pet.name,
          species: speciesText,
          sex: sexText,
          weight: pet.weight,
          breed: pet.breed,
          dateOfBirth: pet.dateOfBirth.toISOString(),
          age: this.calculateAge(pet.dateOfBirth),
        },
        history: {
          vaccines: pet.vaccines.map(vaccine => ({
            id: vaccine.id,
            vaccineName: vaccine.catalog.name,
            applicationDate: vaccine.applicationDate.toISOString(),
            expirationDate: vaccine.expirationDate?.toISOString() || null,
            batchNumber: vaccine.batchNumber,
            notes: vaccine.notes
          })),
          treatments: pet.treatment.map(treatment => ({
            id: treatment.id,
            name: treatment.name,
            startDate: treatment.startDate.toISOString(),
            endDate: treatment.endDate?.toISOString() || null,
            notes: treatment.notes
          })),
          known_allergies: [],
          medications: []
        },
        last_consultation: pet.consultations.length > 0 ? {
          id: pet.consultations[0].id,
          date: pet.consultations[0].date.toISOString(),
          chiefComplaint: pet.consultations[0].chiefComplaint,
          consultationType: pet.consultations[0].consultationType,
          findings: pet.consultations[0].findings,
          diagnosis: pet.consultations[0].diagnosis,
          nextSteps: pet.consultations[0].nextSteps,
          additionalNotes: pet.consultations[0].additionalNotes,
          nextConsultation: pet.consultations[0].nextConsultation?.toISOString() || null
        } : null
      }

      return {
        success: true,
        data: clinicalSummary
      }
    } catch (error) {
      console.error('Error getting clinical summary:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al obtener el resumen clínico'
      }
    }
  }
}