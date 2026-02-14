// TTS API types for Style-BERT-VITS2

export interface TTSRequest {
  text: string;
  model_id?: number;
  speaker_id?: number;
  sdp_ratio?: number;
  noise?: number;
  noise_w?: number;
  length?: number;
  language?: string;
  style?: string;
}

export interface TTSResponse {
  audio: Blob;
}

export interface Message {
  id: string;
  text: string;
  audioUrl?: string;
  timestamp: Date;
}

export interface TTSState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}
