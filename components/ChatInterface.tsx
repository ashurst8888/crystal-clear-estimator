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

interface SavedClient {
  id: string;
  name: string;
  address?: string | null;
  cityStateZip?: string | null;
  phone?: string | null;
}

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
  const [speechError, setSpeechError] = useState('');
  const [savedClients, setSavedClients] = useState<SavedClient[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechAvailable(!!SR);
  }, []);

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((data) => { if (data.clients) setSavedClients(data.clients); })
      .catch(() => {});
  }, []);

  function handleSelectClient(client: SavedClient) {
    const parts: string[] = [`Create an estimate for ${client.name}`];
    if (client.address) parts.push(`at ${client.address}`);
    if (client.cityStateZip) parts.push(client.cityStateZip);
    if (client.phone) parts.push(`phone ${client.phone}`);
    setShowClientDropdown(false);
    sendMessage(parts.join(', '));
  }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setListening(false);
      if (event.error === 'not-allowed') {
        setSpeechError('Microphone access denied. Allow mic access in your browser settings.');
      } else if (event.error === 'no-speech') {
        setSpeechError('No speech detected. Try again.');
      } else {
        setSpeechError('Voice input failed. Try again.');
      }
      setTimeout(() => setSpeechError(''), 4000);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F9]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-[#0d1f35] text-white shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Crystal Clear" className="w-9 h-9 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight text-white truncate">Crystal Clear</div>
            <div className="text-xs text-white/50 leading-tight">Estimator</div>
          </div>
        </div>
        {/* New Estimate CTA */}
        <div className="px-4 py-4">
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 w-full bg-[#4DA8DA] hover:bg-[#3d96c8] text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Estimate
          </Link>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {[
            { href: '/dashboard', label: 'Dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
            { href: '/history', label: 'Estimates', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
            { href: '/approvals', label: 'Signatures', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
            { href: '/references', label: 'References', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg> },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <span className="text-white/50">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-xs text-white/30 leading-snug">Crystal Clear Cleaning<br />& Contracting</div>
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Crystal Clear" className="h-8 w-auto" />
            <span className="font-semibold text-sm text-gray-900">Crystal Clear</span>
          </div>
          {/* Desktop label */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#4DA8DA] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-700">New Estimate</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="text-gray-500 hover:text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden lg:block"
            >
              History
            </Link>
            <Link
              href="/chat"
              className="bg-[#4DA8DA] hover:bg-[#3d96c8] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              + New
            </Link>
          </div>
        </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-white">
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

            {savedClients.length > 0 && (
              <div className="mt-5 w-full max-w-sm">
                <div className="relative">
                  <button
                    onClick={() => setShowClientDropdown((v) => !v)}
                    className="w-full flex items-center justify-between text-sm font-medium text-[#4DA8DA] border border-[#4DA8DA] rounded-xl px-3 py-2.5 hover:bg-[#4DA8DA]/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Past Clients ({savedClients.length})
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showClientDropdown && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {savedClients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="font-medium text-gray-900 text-sm">{client.name}</div>
                          {(client.address || client.cityStateZip) && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">
                              {[client.address, client.cityStateZip].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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
            <button
              type="button"
              onClick={speechAvailable ? toggleListening : undefined}
              disabled={!speechAvailable}
              title={speechAvailable ? (listening ? 'Stop recording' : 'Voice input') : 'Voice input not supported in this browser'}
              className={`absolute right-3 bottom-3 p-1.5 rounded-full transition-colors ${
                !speechAvailable
                  ? 'text-gray-300 cursor-not-allowed'
                  : listening
                  ? 'text-red-500 bg-red-50'
                  : 'text-gray-400 hover:text-[#4DA8DA] hover:bg-[#4DA8DA]/10'
              }`}
              aria-label={listening ? 'Stop recording' : 'Start voice input'}
            >
              {listening ? (
                <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zm-1 19.93V22h2v-1.07A8.001 8.001 0 0020 13h-2a6 6 0 01-12 0H4a8.001 8.001 0 007 7.93z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
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
        {speechError && (
          <p className="text-center text-xs text-red-500 mt-2">{speechError}</p>
        )}
        {!speechError && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        )}
      </div>
      </div>{/* end chat column */}
    </div>
  );
}
