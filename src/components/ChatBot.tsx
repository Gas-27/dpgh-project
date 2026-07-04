'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { CHATBOT_KNOWLEDGE_BASE, findAnswer } from '@/data/chatbot-knowledge-base';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatBotProps {
  page: 'home' | 'packages' | 'agent-dashboard';
}

export default function ChatBot({ page }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation from localStorage
  useEffect(() => {
    const storageKey = `chatbot_${page}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load chat history', e);
      }
    }
  }, [page]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to localStorage
  const saveMessages = (newMessages: Message[]) => {
    const storageKey = `chatbot_${page}`;
    localStorage.setItem(storageKey, JSON.stringify(newMessages));
  };

  // Enhanced answer finding with comprehensive knowledge base
  const getAnswer = (userQuery: string): string => {
    const match = findAnswer(userQuery);
    if (match) {
      return match.answer;
    }

    // Fallback with helpful suggestions
    return `I'm here to help! You can ask me about:
    📦 Data packages & pricing
    🚚 Order tracking & delivery
    💳 Payment methods & safety
    🤝 Becoming an agent & earning commissions
    👨‍🌾 AFA bundles for farmers
    💰 Withdrawals & payments
    📞 Support & contact info
    
    What would you like to know?`;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    // Simulate thinking time
    setTimeout(() => {
      const answer = getAnswer(input);
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-1`,
        role: 'assistant',
        content: answer,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveMessages(finalMessages);
      setIsLoading(false);
    }, 500);
  };

  const handleClearChat = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      const storageKey = `chatbot_${page}`;
      localStorage.removeItem(storageKey);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Chat Widget */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 z-40 md:flex hidden items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="font-semibold text-sm">Chat with us</span>
        </button>
      )}

      {/* Mobile Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 md:hidden flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-full w-14 h-14 shadow-lg transition-all hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 md:bottom-8 md:right-8 z-40 w-full md:w-96 h-full md:h-[600px] bg-slate-900 rounded-none md:rounded-lg shadow-2xl flex flex-col border border-slate-700 animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white p-4 rounded-none md:rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">Customer Support</h3>
              <p className="text-xs text-cyan-100">Always here to help</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-cyan-600 rounded-lg p-2 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1 opacity-75">
                  Ask about packages, orders, or support
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className="text-xs mt-1 opacity-60">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-200 px-4 py-2 rounded-lg border border-slate-700 rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-slate-500 rounded-full animate-bounce" />
                    <div
                      className="h-2 w-2 bg-slate-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <div
                      className="h-2 w-2 bg-slate-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
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
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask me anything..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Press Enter to send
            </p>
          </div>
        </div>
      )}
    </>
  );
}
