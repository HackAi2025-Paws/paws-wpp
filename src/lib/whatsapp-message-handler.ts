import { WhatsAppService } from './twilio'
import { UserService } from './user-service'

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

    const user = await UserService.findUserByPhone(message.from)

    if (user && user.pets && user.pets.length > 0) {
      const petsMessage = UserService.formatPetsMessage(user.pets)
      await WhatsAppService.sendMessage(message.from, petsMessage)
    } else if (user && user.pets && user.pets.length === 0) {
      await WhatsAppService.sendMessage(
        message.from,
        "Aún no tienes mascotas registradas. ¿Te gustaría registrar una mascota? 🐾"
      )
    } else {
      const registrationPrompt = UserService.formatRegistrationPrompt()
      await WhatsAppService.sendMessage(message.from, registrationPrompt)
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