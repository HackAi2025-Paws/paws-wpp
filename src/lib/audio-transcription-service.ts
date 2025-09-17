import { createClient } from '@deepgram/sdk'

export interface TranscriptionResult {
  transcript: string
  confidence: number
  language: string
}

export class AudioTranscriptionService {
  private client: ReturnType<typeof createClient>

  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required')
    }

    this.client = createClient({ apiKey })
  }

  async transcribeBuffer(audioBuffer: Buffer, mimeType?: string): Promise<TranscriptionResult> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'es',
          smart_format: true,
          punctuate: true,
          paragraphs: false,
          utterances: false
        }
      )

      if (error) {
        throw new Error(`Deepgram transcription error: ${error.message}`)
      }

      if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error('No transcription result received from Deepgram')
      }

      const alternative = result.results.channels[0].alternatives[0]

      return {
        transcript: alternative.transcript || '',
        confidence: alternative.confidence || 0,
        language: result.results.language || 'es'
      }
    } catch (error) {
      console.error('Audio transcription failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Transcription failed')
    }
  }

  async transcribeUrl(audioUrl: string, authHeaders?: Record<string, string>): Promise<TranscriptionResult> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        {
          model: 'nova-2',
          language: 'es',
          smart_format: true,
          punctuate: true,
          paragraphs: false,
          utterances: false
        }
      )

      if (error) {
        throw new Error(`Deepgram transcription error: ${error.message}`)
      }

      if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error('No transcription result received from Deepgram')
      }

      const alternative = result.results.channels[0].alternatives[0]

      return {
        transcript: alternative.transcript || '',
        confidence: alternative.confidence || 0,
        language: result.results.language || 'es'
      }
    } catch (error) {
      console.error('Audio transcription failed:', error)
      throw new Error(error instanceof Error ? error.message : 'Transcription failed')
    }
  }
}

let audioTranscriptionService: AudioTranscriptionService | null = null

export const getAudioTranscriptionService = (): AudioTranscriptionService => {
  if (!audioTranscriptionService) {
    audioTranscriptionService = new AudioTranscriptionService()
  }
  return audioTranscriptionService
}