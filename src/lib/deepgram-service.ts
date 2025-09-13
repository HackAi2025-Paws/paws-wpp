import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface TranscriptionEvent {
  transcript: string;
  isFinal: boolean;
}

export interface ConnectionEvent {
  state: ConnectionState;
  error?: string;
}

interface DeepgramConnection {
  on(event: string, callback: (...args: unknown[]) => void): void;
  getReadyState(): number;
  send(data: Blob): void;
  finish(): void;
}

export class DeepgramService {
  private connection: DeepgramConnection | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  private onTranscriptionCallback?: (event: TranscriptionEvent) => void;
  private onConnectionCallback?: (event: ConnectionEvent) => void;

  onTranscription(callback: (event: TranscriptionEvent) => void) {
    this.onTranscriptionCallback = callback;
  }

  onConnection(callback: (event: ConnectionEvent) => void) {
    this.onConnectionCallback = callback;
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch('/api/transcription/auth', { method: 'POST' });
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Failed to get access token');
    }

    return data.accessToken;
  }

  private async getMicrophone(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      return stream;
    } catch (error) {
      throw new Error('Microphone access denied');
    }
  }

  private async createConnection(): Promise<DeepgramConnection> {
    const accessToken = await this.getAccessToken();
    const deepgram = createClient({ accessToken });

    const connection = deepgram.listen.live({
      model: 'nova-3',
      language: 'es',
      smart_format: true,
      interim_results: true,
    });

    return connection as DeepgramConnection;
  }

  private setupEvents(connection: DeepgramConnection) {
    connection.on(LiveTranscriptionEvents.Open, () => {
      this.state = ConnectionState.CONNECTED;
      this.onConnectionCallback?.({ state: ConnectionState.CONNECTED });

      if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
        this.mediaRecorder.start(100);
      }
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data: unknown) => {
      const transcriptData = data as {
        channel?: { alternatives?: { transcript?: string }[] };
        is_final: boolean;
      };

      const transcript = transcriptData?.channel?.alternatives?.[0]?.transcript;
      if (transcript) {
        this.onTranscriptionCallback?.({
          transcript,
          isFinal: transcriptData.is_final
        });
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error: unknown) => {
      this.state = ConnectionState.ERROR;
      const errorMessage = error instanceof Error ? error.message : 'Transcription error';
      this.onConnectionCallback?.({
        state: ConnectionState.ERROR,
        error: errorMessage
      });
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      this.state = ConnectionState.DISCONNECTED;
      this.onConnectionCallback?.({ state: ConnectionState.DISCONNECTED });
    });
  }

  private setupRecorder(stream: MediaStream) {
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav'];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.connection?.getReadyState() === 1) {
        this.connection.send(event.data);
      }
    };

    return recorder;
  }

  async startListening(): Promise<void> {
    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
      return;
    }

    try {
      this.state = ConnectionState.CONNECTING;
      this.onConnectionCallback?.({ state: ConnectionState.CONNECTING });

      const stream = await this.getMicrophone();
      this.connection = await this.createConnection();
      this.setupRecorder(stream);
      this.setupEvents(this.connection);

    } catch (error) {
      this.state = ConnectionState.ERROR;
      const message = error instanceof Error ? error.message : 'Failed to start listening';
      this.onConnectionCallback?.({
        state: ConnectionState.ERROR,
        error: message
      });
      this.cleanup();
    }
  }

  stopListening(): void {
    this.cleanup();
    this.state = ConnectionState.DISCONNECTED;
    this.onConnectionCallback?.({ state: ConnectionState.DISCONNECTED });
  }

  private cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.connection) {
      this.connection.finish();
      this.connection = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
  }

  getConnectionState(): ConnectionState {
    return this.state;
  }

  isListening(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  isConnecting(): boolean {
    return this.state === ConnectionState.CONNECTING;
  }

  hasError(): boolean {
    return this.state === ConnectionState.ERROR;
  }

  destroy(): void {
    this.cleanup();
    this.onTranscriptionCallback = undefined;
    this.onConnectionCallback = undefined;
  }
}

let deepgramService: DeepgramService | null = null;

export const getDeepgramService = (): DeepgramService => {
  if (!deepgramService) {
    deepgramService = new DeepgramService();
  }
  return deepgramService;
};
