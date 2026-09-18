'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  FormEvent,
} from 'react';
import Link from 'next/link';
import { EstimatePreview } from './EstimatePreview';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages: { role: string; content: string }[];
  initialEstimate: Record<string, unknown> | null;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-8 h-8 rounded-full bg-[#4DA8DA] flex items-center justify-center shrink-0 text-white text-xs font-bold">
        CC
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  // Check if this is a JSON estimate message (find JSON anywhere in the response)
  let estimateData: Record<string, unknown> | null = null;
  if (!isUser) {
    const start = message.content.indexOf('{');
    const end = message.content.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(message.content.slice(start, end + 1));
        if (parsed && Array.isArray(parsed.line_items)) {
          estimateData = parsed;
        }
      } catch {
        estimateData = null;
      }
    }
  }

  if (estimateData) {
    return (
      <div className="mb-4 w-full">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#4DA8DA] flex items-center justify-center text-white text-xs font-bold">
            CC
          </div>
          <span className="text-xs text-gray-500">Estimate ready</span>
        </div>
        <EstimatePreview estimate={estimateData as Parameters<typeof EstimatePreview>[0]['estimate']} />
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#4DA8DA] flex items-center justify-center shrink-0 text-white text-xs font-bold">
          CC
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[#4DA8DA] text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export function ChatInterface({
  conversationId,
  initialMessages,
  initialEstimate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    (initialMessages as ChatMessage[]) || [],
  );
  const [currentEstimate, setCurrentEstimate] = useState<Record<string, unknown> | null>(
    initialEstimate,
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSpeechAvailable(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Show initial estimate if exists and not already in messages
  useEffect(() => {
    if (
      initialEstimate &&
      messages.length > 0 &&
      messages[messages.length - 1].role === 'assistant' &&
      messages[messages.length - 1].content.trim().startsWith('{')
    ) {
      setCurrentEstimate(initialEstimate);
    }
  }, [initialEstimate, messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: text.trim(),
          }),
        });

        if (!res.ok) {
          throw new Error('Request failed');
        }

        const data = await res.json();
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.message,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (data.estimate) {
          setCurrentEstimate(data.estimate);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [conversationId, loading],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function toggleListening() {
    if (!speechAvailable) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Crystal Clear" className="h-10 w-auto" />
          <div>
            <div className="font-semibold text-gray-900 text-sm leading-tight">Crystal Clear Estimator</div>
            <div className="text-xs text-gray-400 leading-tight">AI-powered estimate builder</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/references"
            className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block"
          >
            References
          </Link>
          <Link
            href="/history"
            className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block"
          >
            History
          </Link>
          <Link
            href="/approvals"
            className="text-gray-500 hover:text-gray-700 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block"
          >
            Approvals
          </Link>
          <Link
            href="/chat"
            className="bg-[#4DA8DA] hover:bg-[#3d96c8] text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            New Estimate
          </Link>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="flex sm:hidden border-b border-gray-100 px-4 py-1.5 gap-4 bg-gray-50 text-xs">
        <Link href="/references" className="text-gray-500 hover:text-[#4DA8DA]">References</Link>
        <Link href="/history" className="text-gray-500 hover:text-[#4DA8DA]">History</Link>
        <Link href="/approvals" className="text-gray-500 hover:text-[#4DA8DA]">Approvals</Link>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#4DA8DA]/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#4DA8DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Let&apos;s build an estimate
            </h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Tell me about the job &mdash; what type of work, the client&apos;s name, and any details you have.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-sm">
              {[
                "Stamped concrete patio for a new client",
                "Deck build, pressure treated, 16x20",
                "Bathroom shower remodel labor only",
                "Composite deck with stairs",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="text-left text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Current estimate preview if any and not in messages */}
      {currentEstimate && messages.length > 0 && !messages.some(
        (m) => m.role === 'assistant' && m.content.includes('{') && m.content.includes('line_items')
      ) && (
        <div className="px-4 pb-2 border-t border-gray-100">
          <div className="py-3">
            <EstimatePreview estimate={currentEstimate as Parameters<typeof EstimatePreview>[0]['estimate']} />
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the job or ask a question..."
              rows={1}
              className="w-full resize-none border border-gray-300 rounded-2xl px-4 py-3 pr-12 text-base focus:outline-none focus:ring-2 focus:ring-[#4DA8DA] focus:border-transparent max-h-32 overflow-y-auto"
              style={{ minHeight: '48px' }}
              disabled={loading}
            />
            {speechAvailable && (
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute right-3 bottom-3 p-1 rounded-full transition-colors ${
                  listening
                    ? 'text-red-500 bg-red-50'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                aria-label={listening ? 'Stop recording' : 'Start voice input'}
              >
                <svg className="w-5 h-5" fill={listening ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-[#4DA8DA] hover:bg-[#3d96c8] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-colors shrink-0"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
