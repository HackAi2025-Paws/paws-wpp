import twilio from 'twilio'
import { WhatsAppResponseCleaner } from './whatsapp-response-cleaner'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

if (!accountSid || !authToken || !whatsappNumber) {
  throw new Error('Missing required Twilio environment variables')
}

export const twilioClient = twilio(accountSid, authToken)

export class WhatsAppService {
  static async sendMessage(to: string, message: string) {
    try {
      // Clean the response before sending
      const cleanedMessage = WhatsAppResponseCleaner.cleanResponse(message)
      
      const result = await twilioClient.messages.create({
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: cleanedMessage
      })
      console.log(`WhatsApp message sent: ${result.sid}`)
      return result
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error)
      throw error
    }
  }

  static async sendMediaMessage(to: string, message: string, mediaUrl: string) {
    try {
      // Clean the response before sending
      const cleanedMessage = WhatsAppResponseCleaner.cleanResponse(message)
      
      const result = await twilioClient.messages.create({
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: cleanedMessage,
        mediaUrl: [mediaUrl]
      })
      console.log(`WhatsApp media message sent: ${result.sid}`)
      return result
    } catch (error) {
      console.error('Failed to send WhatsApp media message:', error)
      throw error
    }
  }
}