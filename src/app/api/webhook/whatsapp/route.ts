import { NextRequest, NextResponse } from 'next/server'
import { WhatsAppProcessor, WhatsAppMessage } from '@/lib/whatsapp-processor'
import { WhatsAppMessageHandler } from '@/lib/whatsapp-message-handler'

// Initialize session store on first import
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await WhatsAppMessageHandler.initialize();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure session store is initialized
    await ensureInitialized();

    const formData = await request.formData()

    const message: WhatsAppMessage = {
      MessageSid: formData.get('MessageSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      Body: formData.get('Body') as string || undefined,
      MediaUrl0: formData.get('MediaUrl0') as string || undefined,
      MediaContentType0: formData.get('MediaContentType0') as string || undefined,
      NumMedia: formData.get('NumMedia') as string || '0'
    }

    const processedMessage = await WhatsAppProcessor.processIncomingMessage(message)

    if (processedMessage) {
      await WhatsAppMessageHandler.handleMessage(processedMessage)
    }

    return new NextResponse('', { status: 200 })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

