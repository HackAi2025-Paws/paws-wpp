import { WhatsAppService } from './twilio'
import { getAgentLoop } from './agent-loop'
import { getSessionStore } from './session-store'

export interface ProcessedMessage {
  type: 'text' | 'audio' | 'media'
  from: string
  content?: string
  audioBuffer?: Buffer
  mediaType?: string
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

    await WhatsAppService.sendMessage(
      message.from,
      `Recibí tu mensaje de audio (${message.audioBuffer?.length} bytes)`
    )
  }

  private static async handleMediaMessage(message: ProcessedMessage): Promise<void> {
    console.log(`Processing media from ${message.from}: ${message.mediaType}`)

    await WhatsAppService.sendMessage(
      message.from,
      `Recibí tu archivo de ${message.mediaType}`
    )
  }
}