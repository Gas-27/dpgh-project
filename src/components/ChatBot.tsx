'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { CHATBOT_KNOWLEDGE_BASE, findAnswer, FREQUENT_QUESTIONS } from '@/data/chatbot-knowledge-base';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isHtml?: boolean;
}

interface ChatBotProps {
  page: string;
}

interface ChatState {
  mode: 'normal' | 'tracking_phone' | 'tracking_count' | 'packages';
  trackingCount?: number; // how many orders to show
}

export default function ChatBot({ page }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatState, setChatState] = useState<ChatState>({ mode: 'normal' });
  const [showLabel, setShowLabel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Hide "Ask Chatbot" label text after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowLabel(false), 5000);
    return () => clearTimeout(t);
  }, []);

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

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return; // Don't drag if clicking buttons or inputs
    }
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Fetch available packages from Supabase
  const fetchAvailablePackages = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('data_packages')
        .select('*')
        .order('network', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        return "Currently, all packages are offline for maintenance. Please check back in a few minutes.";
      }

      // Separate active and offline packages
      const activePackages = data.filter(pkg => pkg.active && pkg.is_online !== false);
      const offlinePackages = data.filter(pkg => !pkg.active || pkg.is_online === false);

      // Group by network
      const activeByNetwork: Record<string, any[]> = {};
      const offlineByNetwork: Record<string, any[]> = {};

      activePackages.forEach(pkg => {
        if (!activeByNetwork[pkg.network]) activeByNetwork[pkg.network] = [];
        activeByNetwork[pkg.network].push(pkg);
      });

      offlinePackages.forEach(pkg => {
        if (!offlineByNetwork[pkg.network]) offlineByNetwork[pkg.network] = [];
        offlineByNetwork[pkg.network].push(pkg);
      });

      let response = "📦 **Available Data Packages**\n\n";

      // Show active packages
      if (Object.keys(activeByNetwork).length > 0) {
        Object.entries(activeByNetwork).forEach(([network, packages]) => {
          response += `**${network}:**\n`;
          packages.forEach(pkg => {
            response += `• ${pkg.size_gb_text || pkg.size_gb + 'GB'}\n`;
          });
          response += "\n";
        });
      }

      // Show offline packages if any
      if (Object.keys(offlineByNetwork).length > 0) {
        response += "🔴 **Offline Packages:**\n";
        Object.entries(offlineByNetwork).forEach(([network, packages]) => {
          response += `**${network}:**\n`;
          packages.forEach(pkg => {
            response += `• ${pkg.size_gb_text || pkg.size_gb + 'GB'} (Offline)\n`;
          });
          response += "\n";
        });
      }

      response += "For pricing details, please visit the Packages page!";
      return response;
    } catch (error) {
      console.error('Error fetching packages:', error);
      return "I couldn't load available packages right now. Please check the Packages page on our site or contact support.";
    }
  };

  // Fetch order(s) by phone number
  const fetchOrderByPhone = async (phoneNumber: string, count: number = 1): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, network, size_gb, amount, status, fulfillment_status, created_at')
        .eq('customer_number', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(count);

      if (error) throw error;

      if (!data || data.length === 0) {
        return `No orders found for phone number ${phoneNumber}. Please check the number or contact support.`;
      }

      const label = count === 1 ? 'Most Recent Order' : `Last ${data.length} Order${data.length > 1 ? 's' : ''}`;
      let response = `📍 **${label} for ${phoneNumber}**\n\n`;
      data.forEach((order, i) => {
        if (count > 1) response += `**Order ${i + 1}:**\n`;
        response += `**ID:** ${order.id.slice(0, 8)}...\n`;
        response += `**Network:** ${order.network?.toUpperCase()}\n`;
        response += `**Size:** ${order.size_gb}GB\n`;
        response += `**Amount:** GHC ${order.amount}\n`;
        response += `**Status:** ${order.fulfillment_status || order.status || 'Processing'}\n`;
        response += `**Date:** ${new Date(order.created_at).toLocaleDateString()}\n`;
        if (i < data.length - 1) response += '\n---\n\n';
      });
      response += '\n\nIf you need more help, contact our WhatsApp support!';
      return response;
    } catch (error) {
      console.error('Error fetching order:', error);
      return "I couldn't retrieve your order information. Please contact our WhatsApp support team for assistance.";
    }
  };

  // Fetch order by order ID
  const fetchOrderById = async (orderId: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (!data) {
        return `Order ${orderId} not found. Please check the ID and try again.`;
      }

      return `📍 **Order Status for ${data.customer_number}**\n\n**Order ID:** ${data.id}\n**Network:** ${data.network}\n**Size:** ${data.size_gb}GB\n**Amount:** GHC${data.amount}\n**Status:** ${data.status || 'Processing'}\n**Delivery Status:** ${data.fulfillment_status || 'Pending'}\n**Date:** ${new Date(data.created_at).toLocaleDateString()}\n\nIf you need more help, contact our WhatsApp support!`;
    } catch (error) {
      console.error('Error fetching order:', error);
      return "I couldn't retrieve that order. Please verify the order ID or contact support.";
    }
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

    setTimeout(async () => {
      let answer = '';

      // Handle tracking modes
      if (chatState.mode === 'tracking_count') {
        // User has picked how many orders to show — now ask for phone
        const lower = input.trim().toLowerCase();
        let count = 1;
        if (lower.includes('last 5') || lower === '5' || lower.includes('five')) count = 5;
        else if (lower.includes('last 2') || lower === '2' || lower.includes('two')) count = 2;
        // else most recent = 1
        setChatState({ mode: 'tracking_phone', trackingCount: count });
        answer = "Please enter the phone number (e.g. 0501234567):";
      } else if (chatState.mode === 'tracking_phone') {
        answer = await fetchOrderByPhone(input.trim(), chatState.trackingCount ?? 1);
        setChatState({ mode: 'normal' });
      } else if (chatState.mode === 'packages') {
        answer = await fetchAvailablePackages();
        setChatState({ mode: 'normal' });
      } else {
        const lowerInput = input.toLowerCase();

        // Check if user wants to track order naturally
        if (lowerInput.includes('track') || lowerInput.includes('order status') ||
            (lowerInput.includes('where') && lowerInput.includes('order')) ||
            lowerInput.includes('check my order')) {
          // Ask how many orders to show
          answer = "How many orders would you like to check?\n\n• Most Recent (1 order)\n• Last 2 orders\n• Last 5 orders\n\nJust type your choice:";
          setChatState({ mode: 'tracking_count' });
        }
        else if (lowerInput.includes('package') || lowerInput.includes('available')) {
          answer = await fetchAvailablePackages();
        }
        else {
          answer = getAnswer(input);
        }
      }

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
            <h2 className="font-semibold text-white">Chatbot Assistant</h2>
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
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 pb-20">
                <MessageCircle className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-semibold mb-2">Hi! I'm your Chatbot Assistant</p>
                <p className="text-xs mb-4 opacity-75">
                  Ask me anything about packages, agents, AFA, APIs, features, or anything else. I'm here 24/7!
                </p>
                
                {/* Frequently Asked Questions and Quick Actions */}
                <div className="w-full px-2 space-y-2 max-h-72 overflow-y-auto">
                  {/* Quick Action Buttons */}
                  <button
                    onClick={() => {
                      const userMsg: Message = {
                        id: `msg-${Date.now()}`,
                        role: 'user',
                        content: 'Track my order by phone',
                        timestamp: Date.now(),
                      };
                      const updatedMessages = [...messages, userMsg];
                      setMessages(updatedMessages);
                      saveMessages(updatedMessages);

                      const assistantMsg: Message = {
                        id: `msg-${Date.now()}-1`,
                        role: 'assistant',
                        content: 'Please enter your phone number (e.g., 0501234567):',
                        timestamp: Date.now(),
                      };
                      const finalMessages = [...updatedMessages, assistantMsg];
                      setMessages(finalMessages);
                      saveMessages(finalMessages);
                      setChatState({ mode: 'tracking_phone' });
                    }}
                    className="w-full text-left text-xs bg-blue-900 hover:bg-blue-800 text-blue-100 hover:text-white p-2 rounded border border-blue-700 hover:border-blue-500 transition-all font-semibold"
                  >
                    📍 Track Order by Phone
                  </button>

                  <button
                    onClick={async () => {
                      const userMsg: Message = {
                        id: `msg-${Date.now()}`,
                        role: 'user',
                        content: 'Show available packages',
                        timestamp: Date.now(),
                      };
                      const updatedMessages = [...messages, userMsg];
                      setMessages(updatedMessages);
                      saveMessages(updatedMessages);
                      setIsLoading(true);

                      setTimeout(async () => {
                        const answer = await fetchAvailablePackages();
                        const assistantMsg: Message = {
                          id: `msg-${Date.now()}-1`,
                          role: 'assistant',
                          content: answer,
                          timestamp: Date.now(),
                        };
                        const finalMessages = [...updatedMessages, assistantMsg];
                        setMessages(finalMessages);
                        saveMessages(finalMessages);
                        setIsLoading(false);
                      }, 500);
                    }}
                    className="w-full text-left text-xs bg-green-900 hover:bg-green-800 text-green-100 hover:text-white p-2 rounded border border-green-700 hover:border-green-500 transition-all font-semibold"
                  >
                    📦 Show Available Packages
                  </button>

                  <div className="border-t border-slate-700 pt-2 mt-2">
                    <p className="text-xs text-slate-400 px-2 py-1">Quick Questions:</p>
                  </div>

                  {/* FAQ Questions */}
                  {FREQUENT_QUESTIONS.slice(0, 15).map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(question);
                        const userMsg: Message = {
                          id: `msg-${Date.now()}`,
                          role: 'user',
                          content: question,
                          timestamp: Date.now(),
                        };
                        const updatedMessages = [...messages, userMsg];
                        setMessages(updatedMessages);
                        saveMessages(updatedMessages);
                        setInput('');
                        setIsLoading(true);

                        setTimeout(() => {
                          const match = findAnswer(question);
                          const answer = match?.answer || `I'm here to help! You can ask me about data packages, pricing, delivery, becoming an agent, AFA programs, withdrawals, and more. What would you like to know?`;
                          const assistantMsg: Message = {
                            id: `msg-${Date.now()}-1`,
                            role: 'assistant',
                            content: answer,
                            timestamp: Date.now(),
                          };
                          const finalMessages = [...updatedMessages, assistantMsg];
                          setMessages(finalMessages);
                          saveMessages(finalMessages);
                          setIsLoading(false);
                        }, 500);
                      }}
                      className="w-full text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded border border-slate-700 hover:border-cyan-500 transition-all truncate"
                      title={question}
                    >
                      {question}
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
                    className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words text-sm">
                      {msg.content.split('\n').map((line, i) => (
                        <div key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                          {line.replace(/\*\*/g, '')}
                        </div>
                      ))}
                    </div>
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
