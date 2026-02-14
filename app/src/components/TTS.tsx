import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  audioUrl?: string;
  timestamp: Date;
}

interface TTSProps {
  apiUrl?: string;
}

const TTS = ({ apiUrl = "/api/voice" }: TTSProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageMaxLength = 75;

  const DEFAULT_PARAMS = {
    model_id: 6,
    speaker_id: 0,
    sdp_ratio: 0.2,
    noise: 0.6,
    noise_w: 0.8,
    length: 1,
    language: "JP",
    style: "Neutral",
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleGenerate = async () => {
    const text = textInputRef.current?.value.trim();
    if (text && text.length > messageMaxLength) {
      text.slice(0, messageMaxLength);
    }
    if (!text) {
      console.warn("Exit: No text found");
      return;
    }
    if (isLoading) {
      console.warn("Exit: Already loading");
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Clear input
    const textInput = textInputRef.current;
    if (textInput) {
      textInput.value = '';
      textInput.style.height = 'auto';
    }

    // Show loading state
    setIsLoading(true);
    setError(null);
    setStatus('Generating audio...');

    try {
      // Call TTS API
      const params = { ...DEFAULT_PARAMS, text };
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      const response = await fetch(`${apiUrl}?${searchParams.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Add AI message with audio
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text,
        audioUrl,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Auto-play audio
      // Wait for React to render the new message into the DOM
      setTimeout(() => {
        const audioElement = document.getElementById(`audio-${aiMessage.id}`) as HTMLAudioElement;
        if (audioElement) {
          audioElement.play().catch((err) => {
            console.error('Autoplay blocked by browser:', err);
          });
        }
      }, 100); // A small delay ensures the element exists in the DOM
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };


  return (
    <div className="tts-container">
      <header className="tts-header">
        <h1>Text to Speech</h1>
      </header>

      <div className="tts-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.audioUrl ? 'ai' : 'user'}`}>
            <div className="message-content">
              <div className="message-text">{msg.text}</div>
              {msg.audioUrl && (
                <div className="message-audio">
                  <audio id={`audio-${msg.id}`} controls className="audio-player" src={msg.audioUrl} />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {status && <div className="tts-status">{status}</div>}

      <div className="tts-input-area">
        <div className="input-wrapper">
          <textarea
            ref={textInputRef}
            className="tts-textarea"
            placeholder="Enter text to synthesize..."
            rows={1}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className={`tts-button ${isLoading ? 'loading' : ''}`}
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? '' : 'Generate'}
          </button>
        </div>
        {error && <div className="tts-error">{error}</div>}
      </div>
    </div>
  );
};

export default TTS;
