import twilio from 'twilio'

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
      const result = await twilioClient.messages.create({
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: message
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
      const result = await twilioClient.messages.create({
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: message,
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