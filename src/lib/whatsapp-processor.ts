
export interface WhatsAppMessage {
  MessageSid: string
  From: string
  To: string
  Body?: string
  MediaUrl0?: string
  MediaContentType0?: string
  NumMedia: string
}

export class WhatsAppProcessor {
  static async processIncomingMessage(message: WhatsAppMessage) {
    const from = message.From.replace('whatsapp:', '')
    const mediaCount = parseInt(message.NumMedia)
    
    console.log(`WhatsApp message from ${from}: ${mediaCount > 0 ? 'media' : 'text'}`)

    if (mediaCount > 0 && message.MediaUrl0) {
      return await this.processMediaMessage(message)
    } else if (message.Body) {
      return await this.processTextMessage(message)
    }
    
    return null
  }

  static async processTextMessage(message: WhatsAppMessage) {
    const from = message.From.replace('whatsapp:', '')
    const text = message.Body || ''

    console.log(`Text message from ${from}: ${text}`)

    return {
      type: 'text' as const,
      from,
      content: text,
      messageId: message.MessageSid
    }
  }

  static async processMediaMessage(message: WhatsAppMessage) {
    const from = message.From.replace('whatsapp:', '')
    const mediaUrl = message.MediaUrl0!
    const mediaType = message.MediaContentType0!
    
    console.log(`Media message from ${from}: ${mediaType}`)

    if (mediaType.startsWith('audio/')) {
      return await this.processAudioMessage(message, mediaUrl)
    }
    
    return {
      type: 'media' as const,
      from,
      mediaUrl,
      mediaType,
      messageId: message.MessageSid
    }
  }

  static async processAudioMessage(message: WhatsAppMessage, mediaUrl: string) {
    const from = message.From.replace('whatsapp:', '')
    
    try {
      // Fetch audio content
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`)
      }
      
      const audioBuffer = await response.arrayBuffer()
      console.log(`Audio message from ${from}: ${audioBuffer.byteLength} bytes`)
      
      return {
        type: 'audio' as const,
        from,
        audioBuffer: Buffer.from(audioBuffer),
        mediaType: message.MediaContentType0!,
        messageId: message.MessageSid
      }
    } catch (error) {
      console.error('Failed to process audio message:', error)
      throw error
    }
  }
}