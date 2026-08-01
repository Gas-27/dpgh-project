'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, MessageCircle, Copy, RotateCcw, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { callLocalEngine } from '@/lib/chatEngine';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EDGE_FUNCTION_URL =
  'https://api.dataplug.store/functions/v1/dataplug-chat';

// VITE_SUPABASE_PUBLISHABLE_KEY is the public anon key injected by Vite
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  error?: boolean;    // marks a failed assistant reply so it can be retried
}

interface ChatBotProps {
  page: string;
}

// Suggested questions shown on the empty state screen
const SUGGESTED_QUESTIONS = [
  'What data bundles do you have?',
  'How do I buy data?',
  'How do I track my order?',
  'What does each order status mean?',
  'How do I report an order not received?',
  'How do I become an agent?',
  'What is the AFA bundle?',
  'How do I register for AFA?',
  'How do I become a sub-agent?',
  'How long does delivery take?',
  'How do I get a refund?',
  'I made a wrong order, what can I do?',
  'How do I reset my password?',
  'How do I sign up?',
  'What payment methods do you accept?',
  'How do I top up my wallet?',
  'What is the premium subscription?',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStorageKey(page: string) {
  return `chatbot_ai_${page}`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatBot({ page }: ChatBotProps) {
  const [isOpen, setIsOpen]             = useState(false);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [showLabel, setShowLabel]       = useState(true);
  const [rateLimited, setRateLimited]   = useState(false);
  const [copiedId, setCopiedId]         = useState<string | null>(null);

  // Drag state
  const [isDragging, setIsDragging]     = useState(false);
  const [position, setPosition]         = useState({ x: 0, y: 0 });
  const dragStartRef                    = useRef({ x: 0, y: 0 });

  const messagesEndRef                  = useRef<HTMLDivElement>(null);
  const chatWindowRef                   = useRef<HTMLDivElement>(null);
  const inputRef                        = useRef<HTMLInputElement>(null);

  // Hide "Ask Chatbot" label after 5 s
  useEffect(() => {
    const t = setTimeout(() => setShowLabel(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Load persisted conversation
  useEffect(() => {
    const saved = localStorage.getItem(buildStorageKey(page));
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [page]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const persist = useCallback((msgs: Message[]) => {
    localStorage.setItem(buildStorageKey(page), JSON.stringify(msgs));
  }, [page]);

  // -------------------------------------------------------------------------
  // Drag handlers (unchanged from original)
  // -------------------------------------------------------------------------

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // -------------------------------------------------------------------------
  // AI call
  // -------------------------------------------------------------------------

  const callAI = useCallback(async (
    userText: string,
    history: Message[],
  ): Promise<string> => {
    const conversation = history
      .filter(m => !m.error)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Try the live Supabase Edge Function first.
    // Falls back to the local knowledge-base engine if the request fails.
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ message: userText, conversation }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setTimeout(() => setRateLimited(false), 60_000);
        throw new Error('rate_limited');
      }

      if (res.ok) {
        const data = await res.json();
        if (data?.reply) return data.reply as string;
      }
    } catch (err) {
      // If rate-limited, re-throw so the UI shows the rate-limit banner
      if (err instanceof Error && err.message === 'rate_limited') throw err;
      // Any network / CORS / 5xx error: silently fall through to local engine
    }

    // Local fallback — always works, no API key required
    const result = callLocalEngine(userText, conversation);
    return result.reply;
  }, []);

  // -------------------------------------------------------------------------
  // Send message (shared by keyboard, button, and suggested questions)
  // -------------------------------------------------------------------------

  const sendMessage = useCallback(async (text: string, currentMessages?: Message[]) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const base = currentMessages ?? messages;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    const withUser = [...base, userMsg];
    setMessages(withUser);
    persist(withUser);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await callAI(trimmed, base);
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };
      const final = [...withUser, aiMsg];
      setMessages(final);
      persist(final);
    } catch (err: any) {
      const errorContent = err.message === 'rate_limited'
        ? 'You have sent quite a few messages in a short time — please wait a moment and then try again.'
        : 'I was not able to get a response right now. Please try again in a moment.';

      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: Date.now(),
        error: true,
      };
      const final = [...withUser, errMsg];
      setMessages(final);
      persist(final);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, callAI, persist]);

  const handleSendMessage = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // -------------------------------------------------------------------------
  // Retry last failed message
  // -------------------------------------------------------------------------

  const handleRetry = useCallback((failedMsgId: string) => {
    const idx = messages.findIndex(m => m.id === failedMsgId);
    if (idx < 1) return;
    const userMsg = messages[idx - 1];
    if (userMsg?.role !== 'user') return;
    // Remove the error message and resend
    const pruned = messages.filter((_, i) => i !== idx);
    setMessages(pruned);
    persist(pruned);
    sendMessage(userMsg.content, pruned.filter((_, i) => i < idx - 1));
  }, [messages, persist, sendMessage]);

  // -------------------------------------------------------------------------
  // Copy message
  // -------------------------------------------------------------------------

  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // -------------------------------------------------------------------------
  // Clear chat
  // -------------------------------------------------------------------------

  const handleClearChat = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      localStorage.removeItem(buildStorageKey(page));
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Chat Widget Button — desktop */}
      {!isOpen && (
        <div
          className="fixed z-40 hidden md:flex"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            bottom: position.y === 0 ? '32px' : 'auto',
            right: position.x === 0 ? '32px' : 'auto',
          }}
        >
          <button
            onMouseDown={handleDragStart}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 cursor-grab active:cursor-grabbing"
            title="Ask the chatbot any question - Click to open, drag to move"
          >
            <MessageCircle className="h-5 w-5 flex-shrink-0" />
            {showLabel && (
              <span className="font-semibold text-sm animate-pulse">Ask Chatbot</span>
            )}
          </button>
        </div>
      )}

      {/* Chat Widget Button — mobile */}
      {!isOpen && (
        <div
          className="fixed z-40 flex md:hidden"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            bottom: position.y === 0 ? '24px' : 'auto',
            right: position.x === 0 ? '24px' : 'auto',
          }}
        >
          <button
            onMouseDown={handleDragStart}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 cursor-grab active:cursor-grabbing"
            title="Ask the chatbot - Drag to move"
          >
            <MessageCircle className="h-6 w-6 flex-shrink-0" />
            {showLabel && (
              <span className="font-semibold text-sm animate-pulse">Ask Chatbot</span>
            )}
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className={`fixed z-40 w-full md:w-96 h-full md:h-[600px] bg-slate-900 rounded-none md:rounded-lg shadow-2xl flex flex-col border border-slate-700 ${position.x === 0 && position.y === 0 ? 'bottom-0 right-0 md:bottom-8 md:right-8 animate-in slide-in-from-bottom-2 duration-200' : ''}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging ? 'grabbing' : 'grab',
            ...(position.x !== 0 || position.y !== 0 ? { bottom: 'auto', right: 'auto' } : {}),
          }}
        >
          {/* Header */}
          <div
            onMouseDown={handleDragStart}
            className="flex items-center justify-between bg-slate-950 border-b border-slate-700 p-4 cursor-grab hover:bg-slate-900 transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
              <h2 className="font-semibold text-white">Support Assistant</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-700 hover:bg-red-600 text-white transition-colors"
              aria-label="Close chatbot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
            {messages.length === 0 ? (
              /* Empty state with suggested questions */
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 pb-10">
                <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-semibold mb-1">Hi! How can I help you today?</p>
                <p className="text-xs mb-4 opacity-75">
                  Ask me anything about packages, orders, AFA, agents, accounts, and more.
                </p>
                {/* Quick action chips */}
                <div className="w-full px-1 flex gap-2 mb-2 flex-wrap justify-center">
                  <button
                    onClick={() => sendMessage('How do I track my order?')}
                    className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-full transition-all font-medium"
                  >
                    Track Order
                  </button>
                  <button
                    onClick={() => sendMessage('How do I report an order that shows Delivered but I did not receive the data?')}
                    className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-full transition-all font-medium"
                  >
                    Report Order Not Received
                  </button>
                  <button
                    onClick={() => sendMessage('What does each order status mean?')}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-full transition-all"
                  >
                    Order Status Guide
                  </button>
                </div>
                <div className="w-full px-1 space-y-1.5 max-h-60 overflow-y-auto">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded border border-slate-700 hover:border-cyan-500 transition-all truncate"
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`relative group max-w-xs px-4 py-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none'
                        : msg.error
                          ? 'bg-red-900/60 text-red-200 rounded-bl-none border border-red-700'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    {/* Markdown-rendered content */}
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none leading-relaxed
                        prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                        prose-strong:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                        prose-headings:text-white prose-headings:text-sm prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}

                    <div className="flex items-center justify-between mt-1 gap-2">
                      <p className="text-xs opacity-60">{formatTime(msg.timestamp)}</p>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Copy button (assistant messages) */}
                        {msg.role === 'assistant' && !msg.error && (
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                            aria-label="Copy message"
                            title="Copy"
                          >
                            {copiedId === msg.id
                              ? <Check className="h-3 w-3 text-green-400" />
                              : <Copy className="h-3 w-3 text-slate-400" />
                            }
                          </button>
                        )}
                        {/* Retry button (error messages) */}
                        {msg.error && (
                          <button
                            onClick={() => handleRetry(msg.id)}
                            className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                            aria-label="Retry message"
                            title="Retry"
                          >
                            <RotateCcw className="h-3 w-3 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-200 px-4 py-3 rounded-lg border border-slate-700 rounded-bl-none">
                  <div className="flex gap-1 items-center">
                    <div className="h-2 w-2 bg-cyan-400 rounded-full animate-bounce" />
                    <div className="h-2 w-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.12s' }} />
                    <div className="h-2 w-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.24s' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Rate limit banner */}
            {rateLimited && (
              <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg px-3 py-2 text-xs text-yellow-300 text-center">
                Rate limit reached. Please wait 60 seconds before sending another message.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input footer */}
          <div className="border-t border-slate-700 p-4 bg-slate-800 rounded-none md:rounded-b-lg space-y-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-xs text-slate-400 hover:text-slate-300 transition"
              >
                Clear chat
              </button>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                disabled={isLoading || rateLimited}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading || rateLimited}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Press Enter to send &middot; 24/7 support
            </p>
          </div>
        </div>
      )}
    </>
  );
}
