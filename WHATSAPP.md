# WhatsApp Integration

## Environment Variables
Add these to your `.env.local`:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_WHATSAPP_NUMBER=your_whatsapp_number
WEBHOOK_BASE_URL=your_ngrok_or_domain_url
```

## Webhook Configuration
Set Twilio webhook URL to: `{WEBHOOK_BASE_URL}/api/webhook/whatsapp`

## Usage

### Sending Messages
```typescript
import { WhatsAppService } from '@/lib/twilio'

// Send text
await WhatsAppService.sendMessage('+1234567890', 'Hello!')

// Send media
await WhatsAppService.sendMediaMessage('+1234567890', 'Check this out!', 'https://example.com/image.jpg')
```

### Message Processing
The webhook automatically processes:
- **Text messages**: Available as `processedMessage.content`
- **Audio messages**: Downloaded as `processedMessage.audioBuffer` (Buffer)
- **Media messages**: URL and type available

### Customizing Handlers
Edit handlers in `src/app/api/webhook/whatsapp/route.ts`:
- `handleTextMessage()` - Process text
- `handleAudioMessage()` - Process audio (add transcription here)
- `handleMediaMessage()` - Process other media

### Message Object Structure
```typescript
{
  type: 'text' | 'audio' | 'media',
  from: string, // Phone number
  content?: string, // Text content
  audioBuffer?: Buffer, // Audio data
  mediaUrl?: string, // Media URL
  mediaType?: string, // MIME type
  sid: string // Twilio message ID
}
```