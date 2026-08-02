'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, X, MessageCircle, Copy, RotateCcw, Check,
  Search, AlertTriangle, Clock, CheckCircle, XCircle,
  RefreshCcw, Flag, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { callLocalEngine } from '@/lib/chatEngine';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EDGE_FUNCTION_URL =
  'https://api.dataplug.store/functions/v1/dataplug-chat';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
     import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderRow {
  order_id: string;
  date: string;
  status: string;
  network: string;
  package: string;
  amount: string;
  recipient: string;
  refunded: boolean;
  can_report: boolean;
}

interface TrackingResult {
  found: boolean;
  count?: number;
  orders?: OrderRow[];
  message?: string;
  error?: string;
}

type MessageType = 'text' | 'tracking' | 'report_form' | 'report_submitted';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: MessageType;
  content: string;                    // always set — plain text or markdown
  trackingData?: TrackingResult;      // set when type === 'tracking'
  reportOrder?: OrderRow;             // set when type === 'report_form'
  reportRef?: string;                 // set when type === 'report_submitted'
  timestamp: number;
  error?: boolean;
}

interface ChatBotProps {
  page: string;
}

// ---------------------------------------------------------------------------
// Suggested questions
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  'What data bundles do you have?',
  'How do I buy data?',
  'Track my order',
  'What does each order status mean?',
  'How do I report an order not received?',
  'How do I become an agent?',
  'What is the AFA bundle?',
  'How do I register for AFA?',
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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === 'delivered') return 'text-green-400 bg-green-400/10 border-green-500/30';
  if (s === 'pending')   return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30';
  if (s === 'processing') return 'text-blue-400 bg-blue-400/10 border-blue-500/30';
  if (s === 'failed')    return 'text-red-400 bg-red-400/10 border-red-500/30';
  if (s === 'refunded')  return 'text-purple-400 bg-purple-400/10 border-purple-500/30';
  return 'text-slate-400 bg-slate-400/10 border-slate-500/30';
}

function statusIcon(status: string) {
  const s = status.toLowerCase();
  if (s === 'delivered')  return <CheckCircle className="h-3.5 w-3.5" />;
  if (s === 'pending')    return <Clock className="h-3.5 w-3.5" />;
  if (s === 'processing') return <RefreshCcw className="h-3.5 w-3.5" />;
  if (s === 'failed')     return <XCircle className="h-3.5 w-3.5" />;
  if (s === 'refunded')   return <RefreshCcw className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

function isDelivered(status: string) {
  return status.toLowerCase() === 'delivered';
}

// ---------------------------------------------------------------------------
// Detect if the user message is about tracking
// ---------------------------------------------------------------------------

function isTrackingIntent(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /track(ing)?\s*(my\s*)?order/.test(t) ||
    /where\s*is\s*my\s*order/.test(t) ||
    /order\s*status/.test(t) ||
    /check\s*(my\s*)?order/.test(t) ||
    /my\s*order/.test(t) ||
    /find\s*(my\s*)?order/.test(t)
  );
}

function looksLikePhone(text: string): boolean {
  return /^(\+233|0)[2-9][0-9]{8}$/.test(text.replace(/\s+/g, ''));
}

// ---------------------------------------------------------------------------
// Call edge function (returns raw JSON for structured responses)
// ---------------------------------------------------------------------------

async function callEdgeFunction(
  message: string,
  conversation: { role: string; content: string }[],
): Promise<{ reply?: string; tracking?: TrackingResult; error?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ message, conversation }),
  });

  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`edge_${res.status}`);

  const data = await res.json();
  return data;
}

// ---------------------------------------------------------------------------
// Call Supabase directly for order lookup
// ---------------------------------------------------------------------------

async function fetchOrdersByPhone(phone: string): Promise<TrackingResult> {
  const normalised = phone.replace(/^\+233/, '0').replace(/\s+/g, '').trim();

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: `Track my orders for phone number ${normalised}`,
        conversation: [],
        _action: 'track_order',
        phone_number: normalised,
      }),
    });

    if (!res.ok) throw new Error('failed');
    const data = await res.json();

    // The edge function returns tracking data embedded in the reply or as structured data
    if (data.tracking) return data.tracking as TrackingResult;

    // If AI replied with text, parse what we can — fall back gracefully
    return {
      found: false,
      message: data.reply || 'Could not retrieve orders. Please try again.',
    };
  } catch {
    return {
      found: false,
      error: 'Could not reach the server. Please check your connection and try again.',
    };
  }
}

// ---------------------------------------------------------------------------
// Submit report via edge function
// ---------------------------------------------------------------------------

async function submitReport(args: {
  phone_number: string;
  order_id?: string;
  network?: string;
  checked_master_beneficiary: boolean;
  owes_airtime: boolean;
  owes_momo: boolean;
  owes_bundles: boolean;
  notes?: string;
}): Promise<{ success: boolean; complaint_id?: string; message: string; blocked?: boolean; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: `Submit order report for ${args.phone_number}`,
        conversation: [],
        _action: 'submit_report',
        ...args,
      }),
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    if (data.report) return data.report;
    return {
      success: false,
      message: data.reply || 'Report submitted. The team will follow up with you.',
    };
  } catch {
    return {
      success: false,
      message: 'Could not submit the report right now. Please go to the Track Order tab, find the Delivered order, and tap the Report button there.',
    };
  }
}

// ---------------------------------------------------------------------------
// Order Tracking Card component
// ---------------------------------------------------------------------------

function OrderCard({
  order,
  onReport,
}: {
  order: OrderRow;
  onReport: (order: OrderRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const delivered = isDelivered(order.status);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden text-xs">
      {/* Top row */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColor(order.status)}`}>
            {statusIcon(order.status)}
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <span className="text-slate-400 font-mono">{order.network}</span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Toggle order details"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Summary row */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-slate-200 font-medium truncate">{order.package}</p>
          <p className="text-slate-500">{order.recipient} &middot; {order.amount}</p>
        </div>
        {delivered && (
          <button
            onClick={() => onReport(order)}
            className="flex items-center gap-1 bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1.5 rounded-md font-semibold text-[10px] whitespace-nowrap transition-colors flex-shrink-0"
            title="Report this order as not received"
          >
            <Flag className="h-3 w-3" />
            Report
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/60 space-y-1 text-slate-400">
          <div className="flex justify-between"><span>Order ID</span><span className="text-slate-300 font-mono text-[10px]">{order.order_id.slice(0, 16)}...</span></div>
          <div className="flex justify-between"><span>Date</span><span className="text-slate-300">{order.date}</span></div>
          <div className="flex justify-between"><span>Network</span><span className="text-slate-300">{order.network}</span></div>
          <div className="flex justify-between"><span>Package</span><span className="text-slate-300">{order.package}</span></div>
          <div className="flex justify-between"><span>Amount</span><span className="text-slate-300">{order.amount}</span></div>
          <div className="flex justify-between"><span>Recipient</span><span className="text-slate-300">{order.recipient}</span></div>
          {order.refunded && <p className="text-purple-400 text-[10px] pt-1">Refund processed to wallet</p>}
          {delivered && (
            <p className="text-orange-400/80 text-[10px] pt-1">
              Data not showing? Tap Report above after checking *124# &rarr; Master Beneficiary Data Bundle.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tracking message bubble
// ---------------------------------------------------------------------------

function TrackingBubble({
  data,
  onReport,
}: {
  data: TrackingResult;
  onReport: (order: OrderRow) => void;
}) {
  if (data.error) {
    return (
      <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
        <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
        {data.error}
      </div>
    );
  }

  if (!data.found || !data.orders?.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
        {data.message || 'No orders found for that number.'}
      </div>
    );
  }

  const deliveredCount = data.orders.filter(o => isDelivered(o.status)).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 px-1">
        Found <span className="text-white font-semibold">{data.count}</span> order{data.count !== 1 ? 's' : ''}.
        {deliveredCount > 0 && (
          <span className="text-orange-400 ml-1">
            {deliveredCount} delivered — tap <strong>Report</strong> if data not received.
          </span>
        )}
      </p>
      {data.orders.map(order => (
        <OrderCard key={order.order_id} order={order} onReport={onReport} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Form (inline in chat)
// ---------------------------------------------------------------------------

interface ReportFormProps {
  order: OrderRow;
  onSubmit: (result: { success: boolean; complaint_id?: string; message: string }) => void;
  onCancel: () => void;
}

function ReportForm({ order, onSubmit, onCancel }: ReportFormProps) {
  const [step, setStep] = useState<'precheck' | 'submitting' | 'done'>('precheck');
  const [checkedMaster, setCheckedMaster] = useState<boolean | null>(null);
  const [owesAirtime, setOwesAirtime] = useState<boolean | null>(null);
  const [owesMomo, setOwesMomo]       = useState<boolean | null>(null);
  const [owesBundles, setOwesBundles] = useState<boolean | null>(null);
  const [notes, setNotes]             = useState('');
  const [blockReason, setBlockReason] = useState('');

  const canSubmit =
    checkedMaster === true &&
    owesAirtime === false &&
    owesMomo === false &&
    owesBundles === false;

  async function handleSubmit() {
    if (!canSubmit) return;

    // Check blocking conditions first
    if (checkedMaster === false) {
      setBlockReason('Please check *124# → Master Beneficiary Data Bundle first (not Mashup Data). Come back if it still does not show.');
      return;
    }
    if (owesAirtime || owesMomo || owesBundles) {
      setBlockReason('The SIM has outstanding debts. The network holds data against unpaid debts. Please clear all debts on the line, then check *124# again — the data may already be there.');
      return;
    }

    setStep('submitting');
    const result = await submitReport({
      phone_number: order.recipient,
      order_id: order.order_id,
      network: order.network,
      checked_master_beneficiary: true,
      owes_airtime: false,
      owes_momo: false,
      owes_bundles: false,
      notes: notes.trim() || undefined,
    });
    setStep('done');
    onSubmit(result);
  }

  const YesNo = ({
    value,
    onChange,
  }: {
    value: boolean | null;
    onChange: (v: boolean) => void;
  }) => (
    <div className="flex gap-2">
      <button
        onClick={() => onChange(true)}
        className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
          value === true
            ? 'bg-cyan-600 border-cyan-500 text-white'
            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => onChange(false)}
        className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-colors ${
          value === false
            ? 'bg-slate-500 border-slate-400 text-white'
            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
        }`}
      >
        No
      </button>
    </div>
  );

  if (step === 'submitting') {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-6 text-center">
        <Loader2 className="h-6 w-6 text-cyan-400 animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-400">Submitting your report...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-orange-700/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-orange-700/20 px-3 py-2 border-b border-orange-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-orange-300">Report Order</span>
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Order summary */}
        <div className="bg-slate-900 rounded px-2.5 py-2 text-xs space-y-0.5">
          <p className="text-slate-300 font-medium">{order.package} &middot; {order.network}</p>
          <p className="text-slate-500">{order.recipient} &middot; {order.amount} &middot; {order.date}</p>
        </div>

        {/* Pre-checks */}
        <div className="space-y-3">
          {/* Q1 */}
          <div className="space-y-1.5">
            <p className="text-xs text-slate-300 leading-snug">
              Did you check <strong className="text-white">*124# → Master Beneficiary Data Bundle</strong>?
              <span className="text-slate-500 block text-[10px] mt-0.5">Not Mashup Data — they are different sections.</span>
            </p>
            <YesNo value={checkedMaster} onChange={setCheckedMaster} />
            {checkedMaster === false && (
              <p className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-700/30 rounded px-2 py-1.5">
                Please dial *124# first, select Data Balance → Balance Breakdown, and look for Master Beneficiary Data Bundle. Come back after checking.
              </p>
            )}
          </div>

          {/* Q2 — only show once Q1 answered */}
          {checkedMaster === true && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-300">Does the SIM owe any <strong className="text-white">airtime</strong>?</p>
              <YesNo value={owesAirtime} onChange={setOwesAirtime} />
              {owesAirtime === true && (
                <p className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-700/30 rounded px-2 py-1.5">
                  Outstanding airtime debt can hold the bundle. Clear the debt, then check *124# again — the data may already be there.
                </p>
              )}
            </div>
          )}

          {/* Q3 */}
          {checkedMaster === true && owesAirtime === false && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-300">Does the SIM owe any <strong className="text-white">Mobile Money</strong>?</p>
              <YesNo value={owesMomo} onChange={setOwesMomo} />
              {owesMomo === true && (
                <p className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-700/30 rounded px-2 py-1.5">
                  Outstanding MoMo debt can block bundle delivery. Clear it first, then check *124# again.
                </p>
              )}
            </div>
          )}

          {/* Q4 */}
          {checkedMaster === true && owesAirtime === false && owesMomo === false && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-300">Does the SIM owe any <strong className="text-white">bundle subscriptions</strong>?</p>
              <YesNo value={owesBundles} onChange={setOwesBundles} />
              {owesBundles === true && (
                <p className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-700/30 rounded px-2 py-1.5">
                  Clear any active bundle subscriptions on the line first, then re-check *124#.
                </p>
              )}
            </div>
          )}

          {/* Notes — only show when all pre-checks passed */}
          {canSubmit && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">Any extra details? (optional)</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. checked twice, waited 2 hours..."
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 px-2 py-1.5 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Block reason */}
        {blockReason && (
          <div className="bg-orange-900/20 border border-orange-700/30 rounded px-2.5 py-2 text-[10px] text-orange-300">
            {blockReason}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded transition-colors"
        >
          Submit Report
        </button>

        <p className="text-[10px] text-slate-500 text-center">
          Reports are reviewed by the support team. You will be contacted once processed.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ChatBot component
// ---------------------------------------------------------------------------

export default function ChatBot({ page }: ChatBotProps) {
  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [showLabel, setShowLabel]     = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  // Tracking flow
  const [awaitingPhone, setAwaitingPhone] = useState(false);
  const [isTracking, setIsTracking]       = useState(false);

  // Active report form — id of the message that has the form open
  const [activeReportMsgId, setActiveReportMsgId] = useState<string | null>(null);
  const [activeReportOrder, setActiveReportOrder] = useState<OrderRow | null>(null);

  // Drag
  const [isDragging, setIsDragging]   = useState(false);
  const [position, setPosition]       = useState({ x: 0, y: 0 });
  const dragStartRef                  = useRef({ x: 0, y: 0 });

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const chatWindowRef   = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);

  // Hide label after 5s
  useEffect(() => {
    const t = setTimeout(() => setShowLabel(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Load persisted messages
  useEffect(() => {
    const saved = localStorage.getItem(`chatbot_ai_${page}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        // Ensure old messages without type field get a default
        setMessages(parsed.map(m => ({ ...m, type: m.type ?? 'text' })));
      } catch { /* ignore */ }
    }
  }, [page]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeReportMsgId]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const persist = useCallback((msgs: Message[]) => {
    // Don't persist report_form messages — they should not restore mid-flow
    const toSave = msgs.map(m =>
      m.type === 'report_form' ? { ...m, type: 'text' as MessageType } : m
    );
    localStorage.setItem(`chatbot_ai_${page}`, JSON.stringify(toSave));
  }, [page]);

  // ---------- Drag ----------

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('textarea')) return;
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

  // ---------- Send message ----------

  const sendMessage = useCallback(async (text: string, currentMessages?: Message[]) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || isTracking) return;

    const base = currentMessages ?? messages;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      type: 'text',
      content: trimmed,
      timestamp: Date.now(),
    };

    const withUser = [...base, userMsg];
    setMessages(withUser);
    persist(withUser);
    setInput('');

    // --- Handle tracking phone number input ---
    if (awaitingPhone && looksLikePhone(trimmed)) {
      setAwaitingPhone(false);
      setIsTracking(true);

      try {
        const result = await fetchOrdersByPhone(trimmed);
        const trackMsg: Message = {
          id: `t-${Date.now()}`,
          role: 'assistant',
          type: 'tracking',
          content: '',
          trackingData: result,
          timestamp: Date.now(),
        };
        const final = [...withUser, trackMsg];
        setMessages(final);
        persist(final);
      } catch {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: 'assistant',
          type: 'text',
          content: 'I was not able to retrieve your orders right now. Please check the Track Order tab on your dashboard.',
          timestamp: Date.now(),
          error: true,
        };
        const final = [...withUser, errMsg];
        setMessages(final);
        persist(final);
      } finally {
        setIsTracking(false);
      }
      return;
    }

    // --- Handle tracking intent — ask for phone number ---
    if (isTrackingIntent(trimmed)) {
      setIsLoading(true);

      // Check if they already gave a phone in the same message
      const phoneMatch = trimmed.match(/(\+233|0)[2-9][0-9]{8}/);
      if (phoneMatch) {
        setIsLoading(false);
        setIsTracking(true);
        try {
          const result = await fetchOrdersByPhone(phoneMatch[0]);
          const trackMsg: Message = {
            id: `t-${Date.now()}`,
            role: 'assistant',
            type: 'tracking',
            content: '',
            trackingData: result,
            timestamp: Date.now(),
          };
          const final = [...withUser, trackMsg];
          setMessages(final);
          persist(final);
        } catch {
          const errMsg: Message = {
            id: `e-${Date.now()}`,
            role: 'assistant',
            type: 'text',
            content: 'Could not retrieve orders right now. Please check the Track Order tab on your dashboard.',
            timestamp: Date.now(),
            error: true,
          };
          const final = [...withUser, errMsg];
          setMessages(final);
          persist(final);
        } finally {
          setIsTracking(false);
        }
        return;
      }

      // No phone yet — ask for it
      const askMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        type: 'text',
        content: 'Sure. What phone number was used when placing the order? I will pull up the orders for that number.',
        timestamp: Date.now(),
      };
      const withAsk = [...withUser, askMsg];
      setMessages(withAsk);
      persist(withAsk);
      setIsLoading(false);
      setAwaitingPhone(true);
      return;
    }

    // --- Regular AI message ---
    setIsLoading(true);

    try {
      const conversation = withUser
        .filter(m => !m.error && m.type === 'text')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let reply: string;

      try {
        const data = await callEdgeFunction(trimmed, conversation.slice(-20));
        reply = data.reply ?? 'I could not generate a response. Please try again.';
      } catch (err) {
        if (err instanceof Error && err.message === 'rate_limited') {
          setRateLimited(true);
          setTimeout(() => setRateLimited(false), 60_000);
          throw err;
        }
        // Fallback to local engine
        const local = callLocalEngine(trimmed, conversation.slice(-20));
        reply = local.reply;
      }

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        type: 'text',
        content: reply,
        timestamp: Date.now(),
      };
      const final = [...withUser, aiMsg];
      setMessages(final);
      persist(final);
    } catch (err: unknown) {
      const isRateLimited = err instanceof Error && err.message === 'rate_limited';
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        type: 'text',
        content: isRateLimited
          ? 'You have sent quite a few messages in a short time — please wait a moment before trying again.'
          : 'I was not able to get a response right now. Please try again in a moment.',
        timestamp: Date.now(),
        error: true,
      };
      const final = [...withUser, errMsg];
      setMessages(final);
      persist(final);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, isTracking, awaitingPhone, persist]);

  const handleSendMessage = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ---------- Report flow ----------

  const handleOpenReport = useCallback((order: OrderRow, sourceMsgId: string) => {
    setActiveReportMsgId(sourceMsgId);
    setActiveReportOrder(order);
    // Append a report form message after the tracking message
    const formMsg: Message = {
      id: `rf-${Date.now()}`,
      role: 'assistant',
      type: 'report_form',
      content: '',
      reportOrder: order,
      timestamp: Date.now(),
    };
    setMessages(prev => {
      const updated = [...prev, formMsg];
      persist(updated);
      return updated;
    });
  }, [persist]);

  const handleReportSubmitted = useCallback((
    formMsgId: string,
    result: { success: boolean; complaint_id?: string; message: string },
  ) => {
    setActiveReportMsgId(null);
    setActiveReportOrder(null);

    const resultMsg: Message = {
      id: `rs-${Date.now()}`,
      role: 'assistant',
      type: 'report_submitted',
      content: result.success
        ? `Report submitted. Your reference number is **${result.complaint_id}**. The team will review it and follow up with you. Keep this reference — you can ask me "What is the status of report ${result.complaint_id}?" anytime.`
        : result.message,
      reportRef: result.complaint_id,
      timestamp: Date.now(),
    };

    setMessages(prev => {
      const updated = prev
        .filter(m => m.id !== formMsgId)   // remove the form
        .concat(resultMsg);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const handleCancelReport = useCallback((formMsgId: string) => {
    setActiveReportMsgId(null);
    setActiveReportOrder(null);
    setMessages(prev => {
      const updated = prev.filter(m => m.id !== formMsgId);
      persist(updated);
      return updated;
    });
  }, [persist]);

  // ---------- Retry ----------

  const handleRetry = useCallback((failedMsgId: string) => {
    const idx = messages.findIndex(m => m.id === failedMsgId);
    if (idx < 1) return;
    const userMsg = messages[idx - 1];
    if (userMsg?.role !== 'user') return;
    const pruned = messages.filter((_, i) => i !== idx);
    setMessages(pruned);
    persist(pruned);
    sendMessage(userMsg.content, pruned.filter((_, i) => i < idx - 1));
  }, [messages, persist, sendMessage]);

  // ---------- Copy ----------

  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ---------- Clear chat ----------

  const handleClearChat = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      setAwaitingPhone(false);
      setActiveReportMsgId(null);
      setActiveReportOrder(null);
      localStorage.removeItem(`chatbot_ai_${page}`);
    }
  };

  // ---------- Render ----------

  const loadingLabel = isTracking ? 'Looking up orders...' : 'Typing...';

  return (
    <>
      {/* Floating button — desktop */}
      {!isOpen && (
        <div
          className="fixed z-40 hidden md:flex"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            bottom: position.y === 0 ? '32px' : 'auto',
            right:  position.x === 0 ? '32px' : 'auto',
          }}
        >
          <button
            onMouseDown={handleDragStart}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 cursor-grab active:cursor-grabbing"
            title="Support chat"
          >
            <MessageCircle className="h-5 w-5 flex-shrink-0" />
            {showLabel && (
              <span className="font-semibold text-sm animate-pulse">Support</span>
            )}
          </button>
        </div>
      )}

      {/* Floating button — mobile */}
      {!isOpen && (
        <div
          className="fixed z-40 flex md:hidden"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            bottom: position.y === 0 ? '24px' : 'auto',
            right:  position.x === 0 ? '24px' : 'auto',
          }}
        >
          <button
            onMouseDown={handleDragStart}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 cursor-grab active:cursor-grabbing"
            title="Support chat"
          >
            <MessageCircle className="h-6 w-6 flex-shrink-0" />
            {showLabel && (
              <span className="font-semibold text-sm animate-pulse">Support</span>
            )}
          </button>
        </div>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          className={`fixed z-40 w-full md:w-[420px] h-full md:h-[640px] bg-slate-900 rounded-none md:rounded-xl shadow-2xl flex flex-col border border-slate-700 ${
            position.x === 0 && position.y === 0
              ? 'bottom-0 right-0 md:bottom-8 md:right-8 animate-in slide-in-from-bottom-2 duration-200'
              : ''
          }`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
            cursor: isDragging ? 'grabbing' : 'default',
            ...(position.x !== 0 || position.y !== 0 ? { bottom: 'auto', right: 'auto' } : {}),
          }}
        >
          {/* Header */}
          <div
            onMouseDown={handleDragStart}
            className="flex items-center justify-between bg-slate-950 border-b border-slate-700 px-4 py-3 cursor-grab hover:bg-slate-900 transition-colors select-none rounded-none md:rounded-t-xl"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-cyan-600 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-white" />
                </div>
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-slate-950" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-sm">Support</h2>
                <p className="text-[10px] text-green-400">Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 hover:bg-red-600 text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center h-full text-center text-slate-400 pb-6">
                <div className="h-14 w-14 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mb-3 mt-6">
                  <MessageCircle className="h-7 w-7 text-cyan-400" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Hi, how can I help?</p>
                <p className="text-xs mb-5 opacity-70 max-w-xs">
                  Ask about packages, orders, AFA, agents, accounts, and more.
                </p>

                {/* Quick action chips */}
                <div className="flex gap-2 mb-4 flex-wrap justify-center px-2">
                  <button
                    onClick={() => sendMessage('Track my order')}
                    className="flex items-center gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-full transition-all font-medium"
                  >
                    <Search className="h-3 w-3" />
                    Track Order
                  </button>
                  <button
                    onClick={() => sendMessage('How do I report an order that shows Delivered but I did not receive the data?')}
                    className="flex items-center gap-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-full transition-all font-medium"
                  >
                    <Flag className="h-3 w-3" />
                    Report Not Received
                  </button>
                  <button
                    onClick={() => sendMessage('What does each order status mean?')}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-full transition-all"
                  >
                    Order Status Guide
                  </button>
                </div>

                {/* Suggested questions */}
                <div className="w-full px-1 space-y-1.5 max-h-64 overflow-y-auto">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2.5 rounded-lg border border-slate-700 hover:border-cyan-500 transition-all"
                      title={q}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                // ---------- Tracking message ----------
                if (msg.type === 'tracking' && msg.trackingData) {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-full w-full">
                        <TrackingBubble
                          data={msg.trackingData}
                          onReport={(order) => handleOpenReport(order, msg.id)}
                        />
                        <p className="text-[10px] text-slate-600 mt-1 pl-1">{formatTime(msg.timestamp)}</p>
                      </div>
                    </div>
                  );
                }

                // ---------- Report form ----------
                if (msg.type === 'report_form' && msg.reportOrder) {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-full w-full">
                        <ReportForm
                          order={msg.reportOrder}
                          onSubmit={(result) => handleReportSubmitted(msg.id, result)}
                          onCancel={() => handleCancelReport(msg.id)}
                        />
                      </div>
                    </div>
                  );
                }

                // ---------- Regular text message ----------
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative group max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-br-sm'
                          : msg.error
                            ? 'bg-red-900/50 text-red-200 rounded-bl-sm border border-red-700/50'
                            : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none leading-relaxed
                          prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                          prose-strong:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                          prose-headings:text-white prose-headings:text-sm
                          prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}

                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p className="text-[10px] opacity-50">{formatTime(msg.timestamp)}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {msg.role === 'assistant' && !msg.error && (
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                              aria-label="Copy"
                            >
                              {copiedId === msg.id
                                ? <Check className="h-3 w-3 text-green-400" />
                                : <Copy className="h-3 w-3 text-slate-400" />
                              }
                            </button>
                          )}
                          {msg.error && (
                            <button
                              onClick={() => handleRetry(msg.id)}
                              className="p-0.5 rounded hover:bg-slate-700 transition-colors"
                              aria-label="Retry"
                            >
                              <RotateCcw className="h-3 w-3 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing / loading indicator */}
            {(isLoading || isTracking) && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <div className="h-2 w-2 bg-cyan-400 rounded-full animate-bounce" />
                    <div className="h-2 w-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.12s' }} />
                    <div className="h-2 w-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.24s' }} />
                    {isTracking && (
                      <span className="text-[10px] text-slate-500 ml-2">{loadingLabel}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Rate limit banner */}
            {rateLimited && (
              <div className="bg-yellow-900/40 border border-yellow-700/50 rounded-lg px-3 py-2 text-xs text-yellow-300 text-center">
                Too many messages. Please wait a moment before sending again.
              </div>
            )}

            {/* Awaiting phone hint */}
            {awaitingPhone && !isTracking && (
              <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg px-3 py-2 text-[11px] text-cyan-300 text-center">
                Enter the Ghana phone number (e.g. 0241234567)
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input footer */}
          <div className="border-t border-slate-700 px-4 py-3 bg-slate-800 rounded-none md:rounded-b-xl space-y-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-[11px] text-slate-500 hover:text-slate-400 transition"
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
                placeholder={awaitingPhone ? 'Enter phone number, e.g. 0241234567' : 'Ask me anything...'}
                disabled={isLoading || isTracking || rateLimited}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading || isTracking || rateLimited}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-3 py-2 transition"
                aria-label="Send message"
              >
                {isTracking
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </div>
            <p className="text-[10px] text-slate-600 text-center">
              Press Enter to send &middot; 24/7 support
            </p>
          </div>
        </div>
      )}
    </>
  );
}
