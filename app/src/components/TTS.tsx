import { useEffect, useRef, useState } from "react";
import type { Message } from "../types/tts";

interface TTSProps {
  apiUrl?: string;
}

const TTS = ({ apiUrl = "/api/voice" }: TTSProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageMaxLength = 150;

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleGenerate = async () => {
    let text = textInputRef.current?.value.trim();
    if (text && text.length > messageMaxLength) {
      text = text.slice(0, messageMaxLength);
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
      textInput.value = "";
      textInput.style.height = "auto";
    }

    // Show loading state
    setIsLoading(true);
    setError(null);
    setStatus("Generating audio...");

    try {
      // Call TTS API
      const params = { ...DEFAULT_PARAMS, text };
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      const response = await fetch(`${apiUrl}?${searchParams.toString()}`, {
        method: "GET",
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
            console.error("Autoplay blocked by browser:", err);
          });
        }
      }, 100); // A small delay ensures the element exists in the DOM
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setIsLoading(false);
      setStatus("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col sm:h-[calc(100vh-60px)] h-[calc(100vh-80px)]">
      <header className="text-center py-4 border-b border-stone-200 dark:border-slate-700 mb-4 transition-[border-color] duration-300">
        <h1 className="m-0 text-xl text-stone-800 dark:text-slate-100 transition-colors duration-300">
          Text to Speech
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-fade-in ${msg.audioUrl ? "" : "flex-row-reverse"}`}
          >
            <div
              className={`max-w-[70%] sm:max-w-[70%] p-3 rounded-2xl leading-relaxed ${
                msg.audioUrl
                  ? "bg-gray-100 dark:bg-slate-700 text-stone-700 dark:text-slate-300"
                  : "bg-emerald-600 text-white"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
              {msg.audioUrl && (
                <div className="mt-2">
                  <audio
                    id={`audio-${msg.id}`}
                    controls
                    className="min-w-[200px] w-full h-10"
                    src={msg.audioUrl}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {status && (
        <div className="text-center text-stone-500 dark:text-slate-400 text-sm mt-2 transition-colors duration-300">
          {status}
        </div>
      )}

      <div className="py-4 border-t border-stone-200 dark:border-slate-700 transition-[border-color] duration-300">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <textarea
            ref={textInputRef}
            className="flex-1 p-3 border border-stone-200 dark:border-slate-700 rounded-md text-base resize-none font-inherit bg-white dark:bg-slate-800 text-stone-700 dark:text-slate-300 focus:outline-none focus:border-green-700 dark:focus:border-green-400 disabled:bg-gray-100 disabled:dark:bg-slate-700 disabled:cursor-not-allowed transition-[border-color,background-color,color] duration-200"
            style={{ minHeight: "60px", maxHeight: "150px" }}
            placeholder="Enter text to synthesize..."
            rows={1}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            type="button"
            className={`py-3 px-6 text-white border-none rounded-md text-base font-medium cursor-pointer whitespace-nowrap transition-colors duration-200 ${
              isLoading
                ? "relative text-transparent bg-slate-300 dark:bg-slate-600 cursor-not-allowed loading-spinner"
                : "bg-green-700 dark:bg-green-400 hover:bg-green-800 dark:hover:bg-green-500"
            }`}
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? "" : "Generate"}
          </button>
        </div>
        {error && <div className="text-red-500 text-sm mt-2 text-center">{error}</div>}
      </div>
    </div>
  );
};

export default TTS;
