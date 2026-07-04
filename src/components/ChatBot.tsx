'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, ChevronDown } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatBotProps {
  page: 'home' | 'packages' | 'agent-dashboard';
}

// Knowledge base for Q&A
const KNOWLEDGE_BASE: Record<string, string> = {
  // Package questions
  'what packages do you have': 'We offer daily, weekly, and monthly data packages for MTN, AirtelTigo, and Telecel. All packages are affordable and come with instant activation.',
  'data packages available': 'We have data bundles ranging from 100MB to 50GB for all major networks in Ghana. Check the Packages page to view all available options.',
  'how much is data': 'Prices vary by network and data size. Visit our Packages page to see exact pricing for each bundle.',
  'mtn data price': 'MTN data packages start from as low as GHS 0.50. Visit Packages page for complete pricing.',
  'airtel data price': 'AirtelTigo data packages are very affordable. Check the Packages page for current rates.',
  'telecel data price': 'Telecel data packages are available at competitive rates. View Packages page for details.',
  'package offline': 'If a package shows as offline, it means it\'s temporarily unavailable. Please scroll down to see other available packages or check back later.',
  'why is package offline': 'Packages go offline due to network maintenance, server stability issues, or temporary service interruptions. We\'re working to restore them soon.',

  // Order tracking
  'how do i track order': 'You can track your order using the Track Order card on the homepage. Just enter your phone number or order ID to see your order status.',
  'track my order': 'Use the Track Order section to monitor your purchase. Enter your phone number or order ID for instant updates.',
  'where is my order': 'Check the Track Order card on the homepage with your phone number or order ID to see your order status in real-time.',
  'order status': 'Visit the Track Order card and enter your phone number or order ID to check your current order status.',

  // Payment
  'what payment methods': 'We accept mobile money (MTN Mobile Money, Vodafone Cash), bank transfers, and card payments. All transactions are secure and instant.',
  'how do i pay': 'Simply select your package, choose your payment method, and complete the transaction. Payment is processed instantly.',
  'payment options': 'We support MTN Mobile Money, Vodafone Cash, bank transfers, and card payments for your convenience.',
  'is payment safe': 'Yes, all payments are encrypted and secure. We use trusted payment gateways to protect your information.',

  // Delivery
  'when will i get data': 'Data is delivered instantly after payment confirmation. In rare cases, please wait 5-10 minutes.',
  'how long delivery': 'Our data is delivered within seconds of payment. If delayed, contact support immediately.',
  'data not received': 'If you don\'t receive data within 15 minutes, please contact our WhatsApp support for immediate assistance.',
  'instant delivery': 'Yes, all our data deliveries are instant. You\'ll get your bundle activated immediately after payment.',

  // Agent questions
  'become an agent': 'We\'re always looking for agents! Click the "Become an Agent" button to join our growing network. You\'ll earn 5-10% commission on sales.',
  'how to become agent': 'To become an agent, fill out the registration form with your details, verify your phone number, and start selling. It\'s free and easy!',
  'agent commission': 'Agents earn 5% commission as starters, 7.5% with 100+ sales, and up to 10% as elite agents with 500+ monthly sales.',
  'agent benefits': 'As an agent, you get commission on every sale, priority customer support, exclusive bulk discounts, and the ability to build your own customer base.',
  'sell data bundles': 'Become an agent and start selling data bundles today! Earn attractive commissions with every sale.',

  // Support
  'contact support': 'You can reach our support team via WhatsApp 24/7. Click the WhatsApp icon for instant chat.',
  'customer service': 'Our customer service team is available 24/7 via WhatsApp. We respond within minutes.',
  'how to contact': 'Contact us via the WhatsApp button on your screen. We\'re available 24 hours a day, 7 days a week.',
  'support hours': 'We provide 24/7 customer support via WhatsApp. We\'re always here to help!',

  // General
  'hello': 'Hello! 👋 How can I help you today? Ask me about our data packages, orders, or becoming an agent.',
  'hi': 'Hi there! What can I help you with? Feel free to ask about our services.',
  'help': 'I can help you with: 📦 Data packages • 🚚 Order tracking • 💳 Payment info • 🤝 Becoming an agent • 📞 Support',
  'what can you do': 'I can answer questions about our data packages, help you track orders, explain payment methods, provide agent information, and assist with general support.',
  'thanks': 'You\'re welcome! Feel free to ask if you need anything else. 😊',
  'thank you': 'Happy to help! Let me know if you have any other questions.',
};

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

  // Find best matching answer
  const findAnswer = (userQuery: string): string => {
    const lowerQuery = userQuery.toLowerCase().trim();

    // Exact match first
    if (KNOWLEDGE_BASE[lowerQuery]) {
      return KNOWLEDGE_BASE[lowerQuery];
    }

    // Partial match
    for (const [key, answer] of Object.entries(KNOWLEDGE_BASE)) {
      if (lowerQuery.includes(key) || key.includes(lowerQuery.split(' ')[0])) {
        return answer;
      }
    }

    // Default response
    return `I'm not sure about that. Try asking about our data packages, orders, payment methods, or how to become an agent. You can also contact our support team via WhatsApp for more help!`;
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
      const answer = findAnswer(input);
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
