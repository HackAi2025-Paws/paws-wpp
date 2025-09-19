import { WhatsAppService } from './twilio'
import { getAgentLoop } from './agent-loop'
import { getSessionStore } from './session-store'
import { getAudioTranscriptionService } from './audio-transcription-service'
import { ToolRegistry } from './tools/registry'
import { ToolRunner } from './tools/runner'

export interface ProcessedMessage {
  type: 'text' | 'audio' | 'media'
  from: string
  content?: string
  audioBuffer?: Buffer
  mediaType?: string
  mediaUrl?: string
  messageId?: string
}

export class WhatsAppMessageHandler {
  static async initialize(): Promise<void> {
    // Initialize session store connection
    const sessionStore = getSessionStore();
    await sessionStore.connect();
  }

  static async handleMessage(message: ProcessedMessage): Promise<void> {
    switch (message.type) {
      case 'text':
        await this.handleTextMessage(message)
        break
      case 'audio':
        await this.handleAudioMessage(message)
        break
      case 'media':
        await this.handleMediaMessage(message)
        break
    }
  }

  private static async handleTextMessage(message: ProcessedMessage): Promise<void> {
    console.log(`Processing text: "${message.content}" from ${message.from}`)

    if (!message.content) {
      await WhatsAppService.sendMessage(message.from, 'Lo siento, no pude entender tu mensaje.')
      return
    }

    try {
      // Use AgentLoop to process the message with session management
      const agentLoop = getAgentLoop()
      const response = await agentLoop.execute(message.from, message.content, message.messageId)
      await WhatsAppService.sendMessage(message.from, response)
    } catch (error) {
      console.error('Error processing text message:', error)
      await WhatsAppService.sendMessage(
        message.from,
        'Lo siento, ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.'
      )
    }
  }

  private static async handleAudioMessage(message: ProcessedMessage): Promise<void> {
    console.log(`Processing audio from ${message.from}: ${message.audioBuffer?.length} bytes`)

    if (!message.audioBuffer) {
      await WhatsAppService.sendMessage(message.from, 'Lo siento, no pude procesar tu mensaje de audio.')
      return
    }

    try {
      const transcriptionService = getAudioTranscriptionService()
      const transcriptionResult = await transcriptionService.transcribeBuffer(
        message.audioBuffer,
        message.mediaType
      )

      if (!transcriptionResult.transcript || transcriptionResult.transcript.trim().length === 0) {
        await WhatsAppService.sendMessage(
          message.from,
          'No pude entender lo que dijiste en el audio. Por favor intenta de nuevo o escríbeme un mensaje de texto.'
        )
        return
      }

      console.log(`Audio transcribed from ${message.from}: "${transcriptionResult.transcript}" (confidence: ${transcriptionResult.confidence})`)

      const agentLoop = getAgentLoop()
      const response = await agentLoop.execute(message.from, transcriptionResult.transcript, message.messageId)
      await WhatsAppService.sendMessage(message.from, response)

    } catch (error) {
      console.error('Error transcribing audio message:', error)
      await WhatsAppService.sendMessage(
        message.from,
        'Lo siento, ocurrió un error procesando tu mensaje de audio. Por favor intenta enviar un mensaje de texto.'
      )
    }
  }

  private static async handleMediaMessage(message: ProcessedMessage): Promise<void> {
    console.log(`Processing media from ${message.from}: ${message.mediaType}`)

    // Check if it's an image and the user might be uploading a profile picture
    if (message.mediaType && message.mediaType.startsWith('image/') && message.mediaUrl) {
      try {
        // Download the image
        console.log(`Downloading image from: ${message.mediaUrl}`)
        const response = await fetch(message.mediaUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`)
        }

        const imageBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(imageBuffer)
        const base64Image = buffer.toString('base64')

        console.log(`Downloaded image: ${buffer.length} bytes, type: ${message.mediaType}`)

        // Check if user has a recent session that indicates they're uploading a profile picture
        const sessionStore = getSessionStore()
        const session = await sessionStore.load(message.from)

        if (session && session.messages.length > 0) {
          // Look for recent assistant messages about profile pictures
          const recentMessages = session.messages.slice(-10) // Last 10 messages
          const profilePictureContext = recentMessages.some((msg: any) =>
            msg.role === 'assistant' &&
            Array.isArray(msg.content) &&
            msg.content.some((block: any) =>
              block.type === 'text' &&
              (block.text.includes('foto de perfil') ||
              block.text.includes('profile picture') ||
              block.text.includes('Ahora envía la imagen'))
            )
          )

          if (profilePictureContext) {
            console.log(`User ${message.from} appears to be uploading a profile picture`)

            // Extract pet ID from recent messages
            let petId: number | null = null
            for (const msg of recentMessages.reverse()) {
              if ((msg as any).role === 'assistant' && Array.isArray((msg as any).content)) {
                for (const block of (msg as any).content) {
                  if ((block as any).type === 'text') {
                    // Look for pet confirmation message that contains "ID: X"
                    const idMatch = (block as any).text.match(/ID:\s*(\d+)/i)
                    if (idMatch && (block as any).text.includes('Has seleccionado')) {
                      petId = parseInt(idMatch[1])
                      break
                    }
                  }
                }
                if (petId) break
              }
            }

            if (petId) {
              console.log(`Detected pet ID ${petId} for profile picture upload`)

              // Call the tool directly
              const toolRegistry = new ToolRegistry()
              const toolRunner = new ToolRunner()
              const tool = toolRegistry.getTool('add_pet_profile_picture')

              if (tool) {
                try {
                  const result = await toolRunner.execute(
                    tool,
                    {
                      action: 'upload_image',
                      petId: petId,
                      imageData: {
                        buffer: base64Image,
                        filename: `pet_${petId}_profile.${message.mediaType?.split('/')[1] || 'jpg'}`,
                        contentType: message.mediaType
                      }
                    },
                    {
                      requestId: `img-${Date.now()}`,
                      userPhone: message.from,
                      messageId: message.messageId
                    }
                  )

                  if (result.ok) {
                    await WhatsAppService.sendMessage(message.from, result.data as string)
                  } else {
                    await WhatsAppService.sendMessage(message.from, `Error: ${result.error}`)
                  }
                  return
                } catch (error) {
                  console.error('Error calling pet profile picture tool:', error)
                  await WhatsAppService.sendMessage(
                    message.from,
                    'Ocurrió un error procesando la imagen. Por favor intenta de nuevo.'
                  )
                  return
                }
              }
            }

            // Store the image data temporarily and let AI handle pet selection
            const sessionStore = getSessionStore()
            await sessionStore.connect()

            // Store image data with a temporary key
            const tempImageKey = `temp_image:${message.from}:${Date.now()}`
            const imageData = {
              buffer: base64Image,
              filename: `temp_profile.${message.mediaType?.split('/')[1] || 'jpg'}`,
              contentType: message.mediaType,
              timestamp: Date.now()
            }

            try {
              // Store for 10 minutes (600 seconds)
              await sessionStore.redisClient.setEx(tempImageKey, 600, JSON.stringify(imageData))
              console.log(`Stored temporary image data: ${tempImageKey}`)
            } catch (error) {
              console.error('Error storing temporary image:', error)
            }

            const agentLoop = getAgentLoop()
            const imageText = `El usuario ha enviado una imagen para foto de perfil pero no pude detectar qué mascota. Pregúntale cuál mascota quería actualizar. IMAGEN_TEMP_KEY: ${tempImageKey}`
            const response = await agentLoop.execute(message.from, imageText, message.messageId)
            await WhatsAppService.sendMessage(message.from, response)
            return
          }
        }

        // If not in profile picture context, just acknowledge
        await WhatsAppService.sendMessage(
          message.from,
          `📸 Recibí tu imagen de ${message.mediaType}. Si quieres usarla como foto de perfil de una mascota, dime "quiero ponerle foto de perfil a [nombre de mascota]" primero.`
        )
        return

      } catch (error) {
        console.error('Error processing image message:', error)
        await WhatsAppService.sendMessage(
          message.from,
          'Ocurrió un error procesando tu imagen. Por favor intenta de nuevo.'
        )
        return
      }
    }

    await WhatsAppService.sendMessage(
      message.from,
      `Recibí tu archivo de ${message.mediaType}`
    )
  }
}