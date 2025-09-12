import { NextRequest, NextResponse } from 'next/server'
import { WhatsAppProcessor, WhatsAppMessage } from '@/lib/whatsapp-processor'
import { WhatsAppService } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Convert FormData to WhatsAppMessage object
    const message: WhatsAppMessage = {
      MessageSid: formData.get('MessageSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      Body: formData.get('Body') as string || undefined,
      MediaUrl0: formData.get('MediaUrl0') as string || undefined,
      MediaContentType0: formData.get('MediaContentType0') as string || undefined,
      NumMedia: formData.get('NumMedia') as string || '0'
    }

    // Process the incoming message
    const processedMessage = await WhatsAppProcessor.processIncomingMessage(message)
    
    if (processedMessage) {
      // Handle different message types
      switch (processedMessage.type) {
        case 'text':
          await handleTextMessage(processedMessage)
          break
        case 'audio':
          await handleAudioMessage(processedMessage)
          break
        case 'media':
          await handleMediaMessage(processedMessage)
          break
      }
    }

    return new NextResponse('OK', { status: 200 })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleTextMessage(message: any) {
  console.log(`Processing text: "${message.content}" from ${message.from}`)
  
  // Echo the message back (example)
  await WhatsAppService.sendMessage(
    message.from, 
    `You sent: "${message.content}"`
  )
}

async function handleAudioMessage(message: any) {
  console.log(`Processing audio from ${message.from}: ${message.audioBuffer.length} bytes`)
  
  // Process audio here (transcription, etc.)
  await WhatsAppService.sendMessage(
    message.from, 
    `Received your audio message (${message.audioBuffer.length} bytes)`
  )
}

async function handleMediaMessage(message: any) {
  console.log(`Processing media from ${message.from}: ${message.mediaType}`)
  
  await WhatsAppService.sendMessage(
    message.from, 
    `Received your ${message.mediaType} file`
  )
}