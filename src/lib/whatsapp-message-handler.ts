import { WhatsAppService } from './twilio'
import { AgentService } from './agent-service'

export interface ProcessedMessage {
  type: 'text' | 'audio' | 'media'
  from: string
  content?: string
  audioBuffer?: Buffer
  mediaType?: string
}

export class WhatsAppMessageHandler {
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

    // Use Claude agent to process the message
    const response = await AgentService.processUserMessage(message.from, message.content)
    await WhatsAppService.sendMessage(message.from, response)
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