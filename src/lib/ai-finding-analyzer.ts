import { getSessionStore, SessionMessage } from './session-store'
import { AiFindingService } from './ai-finding-service'
import { PetService } from './pet-service'
import Anthropic from '@anthropic-ai/sdk'

export interface PetContext {
  petId?: number
  petName?: string
  confidence: 'high' | 'medium' | 'low'
}

export interface AnalysisResult {
  shouldStore: boolean
  summary?: string
  message?: string
  confidence: number
}

export class AiFindingAnalyzer {
  private anthropic: Anthropic

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }

  async analyzeMessage(userPhone: string, messageContent: string, _messageId?: string): Promise<void> {
    try {
      console.log(`Analyzing message from ${userPhone}: "${messageContent}"`)

      // Extract pet context from conversation
      const petContext = await this.extractPetContext(userPhone, messageContent)

      if (!petContext.petId) {
        console.log('No pet context found in message, skipping AI finding analysis')
        return
      }

      console.log(`Pet context identified: ID ${petContext.petId}, confidence: ${petContext.confidence}`)

      // Get existing AI findings for this pet
      let existingFindings
      try {
        existingFindings = await AiFindingService.getAiFindingsByPetId(petContext.petId)
      } catch (error) {
        console.error('Error getting AI findings by pet id:', error)
        console.log('Skipping AI finding analysis due to database error')
        return
      }

      if (!existingFindings.success) {
        console.error('Failed to retrieve existing AI findings:', existingFindings.error)
        return
      }

      // Get conversation history
      const sessionStore = getSessionStore()
      const session = await sessionStore.load(userPhone)

      if (!session || session.messages.length === 0) {
        console.log('No conversation history found, skipping analysis')
        return
      }

      // Analyze with Claude
      const analysisResult = await this.analyzeWithClaude(
        messageContent,
        session.messages,
        existingFindings.data || [],
        petContext
      )

      // Store finding if Claude determines it's worth storing
      if (analysisResult.shouldStore && analysisResult.summary && analysisResult.message) {
        console.log(`Storing AI finding with confidence ${analysisResult.confidence}`)

        const createResult = await AiFindingService.createAiFinding({
          petId: petContext.petId,
          summary: analysisResult.summary,
          message: analysisResult.message
        })

        if (createResult.success) {
          console.log(`AI finding stored successfully: ${createResult.data?.id}`)
        } else {
          console.error('Failed to store AI finding:', createResult.error)
        }
      } else {
        console.log('Claude determined finding not worth storing')
      }

    } catch (error) {
      console.error('Error in AI finding analysis:', error)
    }
  }

  public async extractPetContext(userPhone: string, messageContent: string): Promise<PetContext> {
    try {
      const sessionStore = getSessionStore()
      const session = await sessionStore.load(userPhone)

      if (!session) {
        return { confidence: 'low' }
      }

      // Look for recent pet mentions in conversation
      const recentMessages = session.messages.slice(-20) // Last 20 messages

      // Check for explicit pet selection or mention
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const message = recentMessages[i]

        if (message.role === 'assistant' && Array.isArray(message.content)) {
          for (const block of message.content) {
            if (block.type === 'text') {
              // Look for pet confirmation messages
              const idMatch = block.text.match(/(?:ID|id):\s*(\d+)/i)
              const nameMatch = block.text.match(/Has seleccionado.*?([A-Za-zÀ-ÿ\u00f1\u00d1]+)/i)

              if (idMatch && (block.text.includes('seleccionado') || block.text.includes('selected'))) {
                const petId = parseInt(idMatch[1])
                const petName = nameMatch ? nameMatch[1] : undefined

                return {
                  petId,
                  petName,
                  confidence: 'high'
                }
              }
            }
          }
        }
      }

      // Look for pet names mentioned in current message or recent user messages
      const userMessages = recentMessages
        .filter(msg => msg.role === 'user')
        .slice(-5) // Last 5 user messages
        .map(msg => msg.content)
        .join(' ')

      const allText = (userMessages + ' ' + messageContent).toLowerCase()

      // Try to find pets by checking against user's pets
      const userPets = await this.getUserPets(userPhone)

      for (const pet of userPets) {
        const petNameLower = pet.name.toLowerCase()
        if (allText.includes(petNameLower)) {
          return {
            petId: pet.id,
            petName: pet.name,
            confidence: 'medium'
          }
        }
      }

      // If only one pet, assume it's about that pet
      if (userPets.length === 1) {
        return {
          petId: userPets[0].id,
          petName: userPets[0].name,
          confidence: 'low'
        }
      }

      return { confidence: 'low' }

    } catch (error) {
      console.error('Error extracting pet context:', error)
      return { confidence: 'low' }
    }
  }

  private async getUserPets(userPhone: string) {
    try {
      const result = await PetService.listPetsByOwnerPhone(userPhone)
      return result.success ? result.data || [] : []
    } catch (error) {
      console.error('Error getting user pets:', error)
      return []
    }
  }

  private async analyzeWithClaude(
    messageContent: string,
    conversationHistory: SessionMessage[],
    existingFindings: any[],
    petContext: PetContext
  ): Promise<AnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(messageContent, conversationHistory, existingFindings, petContext)

      const response = await this.anthropic.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude')
      }

      // Parse Claude's response
      const result = this.parseClaudeResponse(content.text)
      return result

    } catch (error) {
      console.error('Error calling Claude API:', error)
      return {
        shouldStore: false,
        confidence: 0
      }
    }
  }

  private buildAnalysisPrompt(
    messageContent: string,
    conversationHistory: SessionMessage[],
    existingFindings: any[],
    petContext: PetContext
  ): string {
    const historyText = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map(msg => {
        if (msg.role === 'user') {
          return `Usuario: ${msg.content}`
        } else {
          // Extract text from assistant content blocks
          const textBlocks = msg.content
            .filter(block => block.type === 'text')
            .map(block => (block as any).text)
          return `Asistente: ${textBlocks.join(' ')}`
        }
      })
      .join('\n')

    const findingsText = existingFindings
      .map(f => `- ${f.summary}: ${f.message}`)
      .join('\n')

    return `Eres un veterinario asistente de IA especializado en identificar hallazgos clínicos importantes en conversaciones con dueños de mascotas.

CONTEXTO DE LA MASCOTA:
- ID: ${petContext.petId}
- Nombre: ${petContext.petName || 'No especificado'}
- Confianza del contexto: ${petContext.confidence}

MENSAJE ACTUAL:
"${messageContent}"

HISTORIAL DE CONVERSACIÓN RECIENTE:
${historyText}

HALLAZGOS DE IA EXISTENTES PARA ESTA MASCOTA:
${findingsText || 'Ninguno registrado'}

TAREA:
Analiza si el mensaje actual contiene información veterinaria valiosa que debería almacenarse como un "hallazgo de IA". Considera:

1. ¿Contiene síntomas, comportamientos o observaciones clínicamente relevantes?
2. ¿Es información nueva que no está ya capturada en los hallazgos existentes?
3. ¿Podría ser útil para futuros veterinarios o consultas?
4. ¿Es específico y descriptivo (no solo conversación general)?

EJEMPLOS DE HALLAZGOS VALIOSOS:
- Síntomas específicos: "Mi perro ha estado vomitando amarillo por 3 días"
- Cambios de comportamiento: "Desde ayer está muy decaído y no quiere comer"
- Observaciones físicas: "Tiene una bolita en el cuello que antes no tenía"
- Información médica: "Le doy medicina X dos veces al día desde hace una semana"

NO almacenar para:
- Saludos o conversación general
- Preguntas sin información clínica
- Información ya registrada en hallazgos existentes
- Respuestas vagas o imprecisas

RESPONDE EN FORMATO JSON:
{
  "shouldStore": boolean,
  "summary": "Resumen muy breve del hallazgo (máx 50 caracteres)" o null,
  "message": "Descripción detallada del hallazgo" o null,
  "confidence": número entre 0 y 1,
  "reasoning": "Explicación breve de tu decisión"
}`
  }

  private parseClaudeResponse(responseText: string): AnalysisResult {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON found in Claude response')
        return { shouldStore: false, confidence: 0 }
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        shouldStore: Boolean(parsed.shouldStore),
        summary: parsed.summary || undefined,
        message: parsed.message || undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0
      }

    } catch (error) {
      console.error('Error parsing Claude response:', error)
      console.error('Raw response:', responseText)
      return { shouldStore: false, confidence: 0 }
    }
  }
}

let analyzer: AiFindingAnalyzer | null = null

export function getAiFindingAnalyzer(): AiFindingAnalyzer {
  if (!analyzer) {
    analyzer = new AiFindingAnalyzer()
  }
  return analyzer
}