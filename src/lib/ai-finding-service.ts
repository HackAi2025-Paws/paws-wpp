import { prisma } from './prisma'

export interface AiFinding {
  id: number
  petId: number
  summary: string
  message: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateAiFindingInput {
  petId: number
  summary: string
  message: string
}

export interface UpdateAiFindingInput {
  summary?: string
  message?: string
}

export interface AiFindingResult {
  success: boolean
  data?: AiFinding
  error?: string
}

export interface AiFindingListResult {
  success: boolean
  data?: AiFinding[]
  error?: string
}

export class AiFindingService {
  static async createAiFinding(input: CreateAiFindingInput): Promise<AiFindingResult> {
    try {
      // Validate that the pet exists
      const pet = await prisma.pet.findUnique({
        where: { id: input.petId }
      })

      if (!pet) {
        return {
          success: false,
          error: 'Pet not found'
        }
      }

      const aiFinding = await prisma.aiFinding.create({
        data: {
          petId: input.petId,
          summary: input.summary,
          message: input.message
        }
      })

      return {
        success: true,
        data: {
          id: aiFinding.id,
          petId: aiFinding.petId,
          summary: aiFinding.summary,
          message: aiFinding.message,
          createdAt: aiFinding.createdAt,
          updatedAt: aiFinding.updatedAt
        }
      }
    } catch (error) {
      console.error('Error creating AI finding:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static async getAiFindingById(id: number): Promise<AiFindingResult> {
    try {
      const aiFinding = await prisma.aiFinding.findUnique({
        where: { id }
      })

      if (!aiFinding) {
        return {
          success: false,
          error: 'AI finding not found'
        }
      }

      return {
        success: true,
        data: {
          id: aiFinding.id,
          petId: aiFinding.petId,
          summary: aiFinding.summary,
          message: aiFinding.message,
          createdAt: aiFinding.createdAt,
          updatedAt: aiFinding.updatedAt
        }
      }
    } catch (error) {
      console.error('Error getting AI finding by id:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static async getAiFindingsByPetId(petId: number): Promise<AiFindingListResult> {
    try {
      const aiFindings = await prisma.aiFinding.findMany({
        where: { petId },
        orderBy: { createdAt: 'desc' }
      })

      return {
        success: true,
        data: aiFindings.map(finding => ({
          id: finding.id,
          petId: finding.petId,
          summary: finding.summary,
          message: finding.message,
          createdAt: finding.createdAt,
          updatedAt: finding.updatedAt
        }))
      }
    } catch (error) {
      console.error('Error getting AI findings by pet id:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static async updateAiFinding(id: number, input: UpdateAiFindingInput): Promise<AiFindingResult> {
    try {
      // Check if the AI finding exists
      const existingFinding = await prisma.aiFinding.findUnique({
        where: { id }
      })

      if (!existingFinding) {
        return {
          success: false,
          error: 'AI finding not found'
        }
      }

      const updatedFinding = await prisma.aiFinding.update({
        where: { id },
        data: {
          ...(input.summary !== undefined && { summary: input.summary }),
          ...(input.message !== undefined && { message: input.message })
        }
      })

      return {
        success: true,
        data: {
          id: updatedFinding.id,
          petId: updatedFinding.petId,
          summary: updatedFinding.summary,
          message: updatedFinding.message,
          createdAt: updatedFinding.createdAt,
          updatedAt: updatedFinding.updatedAt
        }
      }
    } catch (error) {
      console.error('Error updating AI finding:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static async deleteAiFinding(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if the AI finding exists
      const existingFinding = await prisma.aiFinding.findUnique({
        where: { id }
      })

      if (!existingFinding) {
        return {
          success: false,
          error: 'AI finding not found'
        }
      }

      await prisma.aiFinding.delete({
        where: { id }
      })

      return {
        success: true
      }
    } catch (error) {
      console.error('Error deleting AI finding:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static async getAllAiFindings(limit?: number): Promise<AiFindingListResult> {
    try {
      const aiFindings = await prisma.aiFinding.findMany({
        include: {
          pet: {
            select: {
              id: true,
              name: true,
              species: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        ...(limit && { take: limit })
      })

      return {
        success: true,
        data: aiFindings.map(finding => ({
          id: finding.id,
          petId: finding.petId,
          summary: finding.summary,
          message: finding.message,
          createdAt: finding.createdAt,
          updatedAt: finding.updatedAt
        }))
      }
    } catch (error) {
      console.error('Error getting all AI findings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  static formatAiFindingForDisplay(finding: AiFinding, petName?: string): string {
    const date = finding.createdAt.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    let display = `🤖 **Hallazgo de IA** (${date})\n`
    if (petName) {
      display += `🐾 **Mascota:** ${petName}\n`
    }
    display += `📋 **Resumen:** ${finding.summary}\n`
    display += `💬 **Mensaje:** ${finding.message}`

    return display
  }
}