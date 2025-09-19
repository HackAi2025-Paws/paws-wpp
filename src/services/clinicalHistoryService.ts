import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface ClinicalSummary {
  basic_information: string
  history: string
  last_consultation: string
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

      // Prepare structured data for AI processing
      const petData = {
        basic_info: {
          id: pet.id,
          name: pet.name,
          species: pet.species === 'DOG' ? 'Perro' : 'Gato',
          sex: pet.sex === 'MALE' ? 'Macho' : pet.sex === 'FEMALE' ? 'Hembra' : 'No especificado',
          weight: pet.weight ? `${pet.weight} kg` : 'No registrado',
          breed: pet.breed || 'No especificado',
          dateOfBirth: pet.dateOfBirth.toLocaleDateString('es-ES'),
          age: this.calculateAge(pet.dateOfBirth)
        },
        vaccines: pet.vaccines.map(vaccine => ({
          name: vaccine.catalog.name,
          date: vaccine.applicationDate.toLocaleDateString('es-ES'),
          expiration: vaccine.expirationDate?.toLocaleDateString('es-ES'),
          batch: vaccine.batchNumber,
          notes: vaccine.notes
        })),
        treatments: pet.treatment.map(treatment => ({
          name: treatment.name,
          startDate: treatment.startDate.toLocaleDateString('es-ES'),
          endDate: treatment.endDate?.toLocaleDateString('es-ES'),
          notes: treatment.notes
        })),
        lastConsultation: pet.consultations.length > 0 ? {
          date: pet.consultations[0].date.toLocaleDateString('es-ES'),
          complaint: pet.consultations[0].chiefComplaint,
          type: pet.consultations[0].consultationType,
          findings: pet.consultations[0].findings,
          diagnosis: pet.consultations[0].diagnosis,
          nextSteps: pet.consultations[0].nextSteps,
          notes: pet.consultations[0].additionalNotes,
          nextConsultation: pet.consultations[0].nextConsultation?.toLocaleDateString('es-ES')
        } : null
      }

      // Generate AI-powered summary
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `Eres un veterinario profesional. Genera un resumen clínico profesional en español basado en los siguientes datos de la mascota.

IMPORTANTE: Tu respuesta debe ser ÚNICAMENTE un JSON válido con exactamente este formato:

{
  "basic_information": "párrafo con información básica del paciente",
  "history": "párrafo con historial de vacunas y tratamientos",
  "last_consultation": "párrafo sobre la última consulta o 'Sin consultas previas' si no hay"
}

Datos de la mascota:
${JSON.stringify(petData, null, 2)}

RESPONDE SOLO EL JSON, SIN MARKDOWN, SIN TEXTO ADICIONAL, SIN EXPLICACIONES.`
        }]
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Respuesta inesperada de la IA')
      }

      let summaryText = content.text.trim()

      // Remove any markdown code blocks if present
      if (summaryText.startsWith('```json')) {
        summaryText = summaryText.replace(/```json\s*/, '').replace(/\s*```$/, '')
      } else if (summaryText.startsWith('```')) {
        summaryText = summaryText.replace(/```\s*/, '').replace(/\s*```$/, '')
      }

      summaryText = summaryText.trim()

      let clinicalSummary: ClinicalSummary

      try {
        clinicalSummary = JSON.parse(summaryText)
      } catch (parseError) {
        console.error('AI response:', summaryText)
        console.error('Parse error:', parseError)
        throw new Error(`La IA no generó un JSON válido: ${parseError}`)
      }

      // Validate the response has the required fields
      if (!clinicalSummary.basic_information || !clinicalSummary.history || !clinicalSummary.last_consultation) {
        console.error('Invalid AI response structure:', clinicalSummary)
        throw new Error('La respuesta de la IA no contiene todas las secciones requeridas')
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