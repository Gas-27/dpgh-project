import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCachedData } from "@/hooks/useCachedData";
import Navbar from "@/components/Navbar";
import NotificationPopup from "@/components/NotificationPopup";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import ReportComplaintDialog from "@/components/ReportComplaintDialog";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import ClaimFreeDataDialog from "@/components/ClaimFreeDataDialog";
import ChatBot from "@/components/ChatBot";
import AFAPackagesDisplay from "@/components/AFAPackagesDisplay";
import AFARegistrationSuccess from "@/components/AFARegistrationSuccess";
import AgentSignupPrompt from "@/components/AgentSignupPrompt";
import DraggableFAB from "@/components/DraggableFAB";
import NetworkIndicator from "@/components/NetworkIndicator";
import PackageStatusIndicator, { PackageStatus } from "@/components/PackageStatusIndicator";
import { detectNetwork, isValidPhoneLength } from "@/lib/phoneUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wifi, Search, Package, CheckCircle, Clock, XCircle, X,
  Loader2, Check, Mail, MessageCircle, Rocket, Gift, Trophy, UserPlus, Layers, FileSpreadsheet, RotateCcw, Phone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ──────────────────────────────────────────────────────────── Types ─────
type Network = "mtn" | "airteltigo" | "telecel";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  size_gb_text?: string;
  mins?: number;
  price: number;
  active?: boolean;
  is_online?: boolean;
  offline_reason?: string;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
  order_status: string;
  created_at: string;
}

interface SpinSegment {
  type: "gb" | "message" | "extra_spin";
  value: number | string;
  label: string;
  weight: number;
}

// ───────────────────────────────────────────────────────── Constants ──
const networkConfig: Record<Network, { label: string; color: string }> = {
  mtn: { label: "MTN", color: "text-yellow-400" },
  airteltigo: { label: "AirtelTigo", color: "text-blue-400" },
  telecel: { label: "Telecel", color: "text-red-400" },
};

const SPIN_PACKAGE_IDS: Record<number, string> = {
  1: "a9d3a307-c416-4a81-9095-9f2b85cc197d",
  2: "1e232e3a-ba58-483a-8012-efcddeb5cd5b",
  5: "9cab80c3-fa7b-45ad-beb2-745e79310125",
};

const SPIN_COOLDOWN_MS = 8 * 60 * 60 * 1000;

const WHEEL_COLORS = [
  "#c0392b", "#2980b9", "#f39c12", "#27ae60",
  "#8e44ad", "#16a085", "#e67e22", "#2c3e50",
  "#d35400", "#1abc9c",
];

// Variable segment angles (in degrees) for prize slots
const FIXED_ANGLES: Record<number, number> = {
  1: 50,   // 1 GB – slightly bigger
  2: 35,   // 2 GB – smaller
  5: 15,   // 5 GB – very small
};

// ──────────────────────────────────────────────────────── Helpers ────
const formatNetworkName = (n: string) =>
  n === "mtn" ? "MTN" : n === "airteltigo" ? "AirtelTigo" : n === "telecel" ? "Telecel" : n;

const isValidPhone = (n: string) => /^\d{10}$/.test(n);
const getSpinCooldownKey = (p: string) => `spin_cooldown_${p}`;
const getSpinCountKey = (p: string) => `spin_count_${p}`;

const getCooldownRemaining = (phone: string): number => {
  const raw = localStorage.getItem(getSpinCooldownKey(phone));
  if (!raw) return 0;
  const rem = parseInt(raw, 10) - Date.now();
  return rem > 0 ? rem : 0;
};

const formatCountdown = (ms: number): string => {
  if (ms <= 0) return "0:00:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─────────────────────────────────────────── Synthesised Sound Engine ──
const createAudioCtx = (): AudioContext | null => {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
};

let _audioCtx: AudioContext | null = null;
const getAudioCtx = () => { if (!_audioCtx) _audioCtx = createAudioCtx(); return _audioCtx; };

const playTone = (freq: number, type: OscillatorType, dur: number, vol = 0.25, delay = 0) => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    g.gain.setValueAtTime(0, ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur + 0.05);
  } catch { /* ignore */ }
};

const sounds = {
  tick: () => playTone(520, "square", 0.03, 0.12),
  slowTick: () => playTone(300, "square", 0.06, 0.18),
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, "sine", 0.55, 0.38, i * 0.11));
    setTimeout(() => [1568, 2093].forEach((f, i) => playTone(f, "sine", 0.3, 0.22, i * 0.09)), 700);
  },
  noWin: () => { playTone(220, "sawtooth", 0.28, 0.22); playTone(180, "sawtooth", 0.22, 0.18, 0.18); },
};

// ────────────────────────────────────────────── Order Tracking Card (UPDATED: delivered at 300 minutes) ──
const OrderTrackingCard = ({ order, toast, onReportClick }: { order: Order; toast: any; onReportClick: (order: Order) => void }) => {
  const [complaintStatus, setComplaintStatus] = useState<string | null>(null);

  // Fetch complaint status for this order
  useEffect(() => {
    const fetchComplaintStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("complaints")
          .select("status")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setComplaintStatus(data.status);
        }
      } catch (e) {
        // No complaint found, that's okay
      }
    };

    fetchComplaintStatus();
    const interval = setInterval(fetchComplaintStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [order.id]);

  // ── Status-based step logic (no time dependency) ──
  const orderStatus = order.order_status?.toLowerCase().trim() || "";
  let step = 1, msg = "", note: string | null = null;

  if (orderStatus === "delivered") {
    step = 4;
    msg = "Your data bundle has been delivered successfully.";
    note = order.network === "mtn" ? "Check your MTNUP2U and MTN messages."
      : order.network === "airteltigo" ? "Check your AirtelTigo iShare and BigTime messages."
        : order.network === "telecel" ? "Check your Telecel messages." : "Check your messages.";
  } else if (orderStatus === "waiting") {
    step = 2;
    msg = "Your number is being added to our beneficiary list.";
    note = "MTN's new rule requires your number to be part of our beneficiary list before you can make purchases through our MTN portal. Your number is now being added and we're submitting your contact to MTN for approval. This is a one-time process. Once MTN approves and adds your contact to their list, your order will start processing immediately. Every new order from your contact will then go smoothly straight to processing.";
  } else if (orderStatus === "processing") {
    step = 3;
    msg = `Order sent to ${formatNetworkName(order.network)} for delivery.`;
    note = "Your order is being processed by the network. The status will update automatically once delivered.";
  } else if (orderStatus === "refunded") {
    step = 1;
    msg = "This order has been refunded.";
    note = "Please contact support if you have any questions.";
  } else if (orderStatus === "failed") {
    step = 1;
    msg = "This order could not be fulfilled.";
    note = "Please contact support for assistance.";
  } else if (orderStatus === "pending") {
    step = 1;
    msg = "Order is placed and sent to the portal and now waiting for the portal to pick it up for processing.";
    note = "Your order has been received and is in the queue. It will be picked up by the portal for processing shortly.";
  } else {
    // any other status defaults to processing step
    step = 3;
    msg = `Order sent to ${formatNetworkName(order.network)} for delivery.`;
    note = "Waiting for the network to deliver your data.";
  }

  const getDetailedReportMessage = (): string => {
    const orderDate = new Date(order.created_at).toLocaleString();
    const networkName = formatNetworkName(order.network);
    const amountFormatted = `GHC ${Number(order.amount).toFixed(2)}`;
    const orderStatusStr = `${order.status} / ${order.fulfillment_status}`;

    return `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.

Order Details:
- Order Date: ${orderDate}
- Network: ${networkName}
- Data: ${(order as any).size_gb_text || order.size_gb + "GB"}
- Amount: ${amountFormatted}
- Customer Number: ${order.customer_number}
- Order Status: ${orderStatusStr}
- Order ID: ${order.id}

Please investigate and assist. Thank you.`;
  };

  const reportMessage = getDetailedReportMessage();
  const waLink = `https://wa.me/233200511211?text=${encodeURIComponent(reportMessage)}`;
  const mailtoLink = `mailto:dataplugstore@gmail.com?subject=${encodeURIComponent("Order Support - Delivered but not received")}&body=${encodeURIComponent(reportMessage)}`;

  // All networks now use 4 steps: Order Placed → Number Verifying → Processing → Delivered
  const labels = ["Order Placed", "Number Verifying", "Processing", "Delivered"];

  if (step === 4) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Delivery Status</span>
        <Badge className="bg-green-600/20 text-green-400 border-green-600/30"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>
      </div>
      <div className="relative">
        <div className="flex justify-between">
          {labels.map((l, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center"><Check className="h-4 w-4" /></div>
              <span className="text-xs text-center mt-1 text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>
        <div className="absolute top-4 left-0 w-full h-0.5 bg-green-600/30 -z-10" />
      </div>
      <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
        <p className="text-sm font-medium">{msg}</p>
        {note && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-green-600/20">{note}</p>}
      </div>
      {/* Report button only shows when order status is "delivered" */}
      {orderStatus === "delivered" && !complaintStatus && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full border-yellow-600/50 text-yellow-600 hover:bg-yellow-600/10"
          onClick={() => onReportClick(order)}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Only tap on this Report: If it Shows <br />Delivered but you have not received it
        </Button>
      )}
      
      {/* Show status message if complaint submitted */}
      {complaintStatus && complaintStatus !== "resolved" && (
        <div className="p-3 rounded-lg bg-blue-600/10 border border-blue-600/30">
          <p className="text-sm font-medium text-blue-400">
            ✓ Report has been sent to network providers
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Status: {complaintStatus === "in-progress" ? "In Progress" : "Pending"}. We are working on it for you.
          </p>
        </div>
      )}
      
      {complaintStatus === "resolved" && (
        <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
          <p className="text-sm font-medium text-green-400">
            ✓ Your complaint has been resolved
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex justify-between">
          {labels.map((l, i) => {
            const n = i + 1;
            // For mashup/mtn_mashup at delivered (step 3), show check mark instead of loader
            const isMashupDelivered = (order.network === "mashup" || order.network === "mtn_mashup") && step === 3 && n === step;
            const icon = n < step ? <Check className="h-4 w-4 text-green-400" /> : n === step && !isMashupDelivered ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : n === step && isMashupDelivered ? <Check className="h-4 w-4 text-green-400" /> : <Clock className="h-4 w-4 text-muted-foreground" />;
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${n < step ? "bg-green-600/20" : n === step ? isMashupDelivered ? "bg-green-600/20" : "bg-primary/20 border border-primary/50" : "bg-muted"}`}>{icon}</div>
                <span className={`text-xs text-center mt-1 ${n === step ? isMashupDelivered ? "text-green-400 font-medium" : "text-primary font-medium" : "text-muted-foreground"}`}>{l}</span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
        </div>
      </div>
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm font-medium">{msg}</p>
        {note && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-primary/20">{note}</p>}

      </div>
    </div>
  );
};

// ──────────────────────────────────────────────��� Spin Wheel Popup (unchanged) ──
interface SpinWheelPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: {
    enabled: boolean;
    default_network: Network;
    payment_required: boolean;
    payment_amount: number;
    segments: SpinSegment[];
    chance_2gb?: number;
    chance_1gb?: number;
    chance_extra_spin?: number;
    auto_disable_enabled?: boolean;
    auto_disable_order_limit?: number;
    current_spin_orders?: number;
    display_spin_orders?: number;
  } | null;
}

type SpinPhase = "idle" | "freewheeling" | "decelerating";

const SpinWheelPopup = ({ open, onOpenChange, config }: SpinWheelPopupProps) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Animation state in refs (avoids re‑renders in rAF)
  const phaseRef = useRef<SpinPhase>("idle");
  const angleRef = useRef(0);      // current wheel rotation (degrees)
  const velocityRef = useRef(0);   // deg/frame during freewheeling
  const targetRef = useRef(0);     // final angle for deceleration
  const winIdxRef = useRef(-1);
  const lastTickRef = useRef(0);

  const [phase, setPhase] = useState<SpinPhase>("idle");
  const [winningIdx, setWinningIdx] = useState<number | null>(null);

  // Phone / spins
  const [phone, setPhone] = useState("");
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const [cooldownMs, setCooldownMs] = useState(0);

  // Result / prize
  const [successGb, setSuccessGb] = useState(0);
  const [resultMsg, setResultMsg] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [showWinBanner, setShowWinBanner] = useState(false);
  const [wonGbForBanner, setWonGbForBanner] = useState(0);

  // Payment
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Segments (after shuffle & weight adjustment)
  const [segments, setSegments] = useState<SpinSegment[]>([]);

  const selectedNetwork = config?.default_network ?? "mtn";
  const paymentRequired = config?.payment_required ?? true;

  // Adjust weights to make 1GB & 2GB harder
  const segs = useMemo<SpinSegment[]>(() => segments.map(s => {
    if (s.type === "gb") {
      const gb = Number(s.value);
      if (gb === 1) return { ...s, weight: Math.max(1, Math.round((s.weight || 5) * 0.3)) };
      if (gb === 2) return { ...s, weight: Math.max(1, Math.round((s.weight || 5) * 0.38)) };
    }
    return s;
  }), [segments]);

  // Variable segment angles
  const segAngles = useMemo(() => {
    const a: number[] = [];
    let used = 0, gbCount = 0;
    segs.forEach(s => {
      if (s.type === "gb" && typeof s.value === "number") {
        const gb = s.value;
        const angle = FIXED_ANGLES[gb] || 15;
        a.push(angle);
        used += angle;
        gbCount++;
      } else {
        a.push(0);
      }
    });
    const remaining = 360 - used;
    const normalCount = segs.length - gbCount;
    const normalAngle = normalCount > 0 ? remaining / normalCount : 0;
    return a.map(angle => angle === 0 ? normalAngle : angle);
  }, [segs]);

  // Cumulative start angles
  const segStarts = useMemo(() => {
    let cum = 0;
    return segAngles.map(a => { const s = cum; cum += a; return s; });
  }, [segAngles]);

  // ── Reset when dialog opens ──
  useEffect(() => {
    if (!open) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    phaseRef.current = "idle";
    angleRef.current = 0;
    velocityRef.current = 0;
    winIdxRef.current = -1;
    lastTickRef.current = 0;
    setPhase("idle");
    setWinningIdx(null);
    setPhone(""); setPhoneConfirmed(false);
    setSpinCount(0); setCooldownMs(0);
    setSuccessGb(0); setResultMsg("");
    setShowWinBanner(false); setWonGbForBanner(0);

    // Remove 10 GB, then shuffle
    const initial = config?.segments
      ? shuffleArray(config.segments.filter(s => !(s.type === "gb" && Number(s.value) === 10)))
      : [];
    setSegments(initial);
  }, [open]);

  // ── Cooldown ticker (free spins) ──
  useEffect(() => {
    if (!phoneConfirmed || paymentRequired) return;
    const tick = () => setCooldownMs(getCooldownRemaining(phone));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phoneConfirmed, phone, paymentRequired]);

  // ── Draw wheel with variable segments ──
  const draw = useCallback((rotDeg: number, hlIdx: number | null) => {
    const canvas = canvasRef.current;
    if (!canvas || segs.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sz = canvas.width, cx = sz / 2, cy = sz / 2, R = sz / 2 - 8;
    ctx.clearRect(0, 0, sz, sz);

    for (let i = 0; i < segs.length; i++) {
      const saDeg = rotDeg + segStarts[i];
      const eaDeg = saDeg + segAngles[i];
      const sa = saDeg * Math.PI / 180;
      const ea = eaDeg * Math.PI / 180;
      const ma = saDeg + segAngles[i] / 2;
      const midRad = ma * Math.PI / 180;
      const hl = hlIdx === i;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sa, ea);
      ctx.closePath();
      ctx.fillStyle = hl ? "#FFD700" : WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = hl ? "#fff" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = hl ? 2.5 : 1;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(cx + R * 0.65 * Math.cos(midRad), cy + R * 0.65 * Math.sin(midRad));
      ctx.rotate(midRad + Math.PI / 2);
      let l1 = "", l2 = "";
      const seg = segs[i];
      if (seg.type === "gb") { l1 = `${seg.value}GB`; l2 = "Data"; }
      else if (seg.type === "extra_spin") { l1 = "+1"; l2 = "Spin"; }
      else {
        const ws = seg.label.split(" ");
        const h = Math.ceil(ws.length / 2);
        l1 = ws.slice(0, h).join(" ").slice(0, 9);
        l2 = ws.slice(h).join(" ").slice(0, 9);
      }
      const fs = Math.max(7, Math.min(13, sz / 8));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 4;
      ctx.fillStyle = "#fff";
      ctx.fillText(l1, 0, -fs * 0.7);
      ctx.fillText(l2, 0, fs * 0.7);
      ctx.restore();
    }
    // Center knob
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.1, 0, Math.PI * 2);
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.1);
    gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#bbb");
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5; ctx.stroke();
  }, [segs, segStarts, segAngles]);

  useEffect(() => { draw(angleRef.current, winningIdx); }, [draw, winningIdx]);

  // ── Find segment closest to the pointer (270°) given final rotation ──
  const getSegmentUnderPointer = useCallback((finalAngle: number): number => {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const segCenter = segStarts[i] + segAngles[i] / 2;
      const canvasAngle = ((segCenter + finalAngle) % 360 + 360) % 360;
      const dist = Math.min(Math.abs(canvasAngle - 270), 360 - Math.abs(canvasAngle - 270));
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [segs, segStarts, segAngles]);

  // ── Finalise spin ──
  const finaliseSpin = useCallback(() => {
    const winner = getSegmentUnderPointer(angleRef.current);
    winIdxRef.current = winner;
    setWinningIdx(winner);
    draw(angleRef.current, winner);

    phaseRef.current = "idle";
    setPhase("idle");

    const seg = segs[winner];

    if (seg.type === "extra_spin") {
      const newCount = spinCount;
      setSpinCount(newCount + 1);
      if (!paymentRequired) {
        localStorage.setItem(getSpinCountKey(phone), String(newCount + 1));
      }
      sounds.win();
      setResultMsg("🎁 Extra Spin! +1 added!");
      toast({ title: "Extra spin!", description: "You earned an extra spin!" });
    } else if (seg.type === "gb" && Number(seg.value) > 0) {
      sounds.win();
      setSuccessGb(Number(seg.value));
      setResultMsg(`🎉 You won ${seg.value}GB!`);

      setSpinCount(0);
      if (!paymentRequired) {
        localStorage.removeItem(getSpinCountKey(phone));
        localStorage.setItem(getSpinCooldownKey(phone), String(Date.now() + SPIN_COOLDOWN_MS));
      }
    } else {
      sounds.noWin();
      const newCount = spinCount - 1;
      setSpinCount(newCount);
      if (!paymentRequired) {
        if (newCount === 0) {
          localStorage.setItem(getSpinCooldownKey(phone), String(Date.now() + SPIN_COOLDOWN_MS));
          localStorage.removeItem(getSpinCountKey(phone));
        } else {
          localStorage.setItem(getSpinCountKey(phone), String(newCount));
        }
      }
      setResultMsg(seg.label || "Better luck next time!");
    }
  }, [spinCount, paymentRequired, phone, segs, draw, toast, getSegmentUnderPointer]);

  // ── rAF loop ──
  const runLoop = useCallback(() => {
    const loop = () => {
      if (phaseRef.current === "idle") return;

      if (phaseRef.current === "freewheeling") {
        angleRef.current += velocityRef.current;
        if (angleRef.current - lastTickRef.current >= 30) {
          sounds.tick();
          lastTickRef.current = angleRef.current;
        }
        draw(angleRef.current, null);
        rafRef.current = requestAnimationFrame(loop);
      } else if (phaseRef.current === "decelerating") {
        const remaining = targetRef.current - angleRef.current;
        if (remaining <= 0.08) {
          angleRef.current = targetRef.current;
          finaliseSpin();
          return;
        }
        const step = Math.max(0.12, remaining * 0.045);
        angleRef.current += step;
        if (angleRef.current - lastTickRef.current >= 18) {
          sounds.slowTick();
          lastTickRef.current = angleRef.current;
        }
        draw(angleRef.current, null);
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, finaliseSpin]);

  // ── Spin button ──
  const handleSpin = useCallback(() => {
    if (phaseRef.current !== "idle" || segs.length === 0) return;
    if (spinCount <= 0) { toast({ title: "No spins left", variant: "destructive" }); return; }
    if (!paymentRequired && cooldownMs > 0) return;
    
    // Validate phone number for spin wheel - must be MTN
    if (!isValidPhoneLength(phone)) {
      toast({ title: "Invalid phone number", description: "Please enter exactly 10 digits", variant: "destructive" });
      return;
    }
    
    const detectedNetwork = detectNetwork(phone);
    if (detectedNetwork === "unknown") {
      toast({ title: "Invalid phone prefix", description: "Please check your phone number. The prefix is not recognized.", variant: "destructive" });
      return;
    }
    
    if (detectedNetwork !== "mtn") {
      toast({ title: "MTN Only", description: "The spin wheel is only available for MTN phone numbers. Your number appears to be " + detectedNetwork.toUpperCase() + ".", variant: "destructive" });
      return;
    }

    setSuccessGb(0); setResultMsg(""); setShowWinBanner(false); setWonGbForBanner(0);
    setWinningIdx(null);

    velocityRef.current = 18;
    lastTickRef.current = angleRef.current;
    phaseRef.current = "freewheeling";
    setPhase("freewheeling");
    runLoop();
  }, [segs, spinCount, paymentRequired, cooldownMs, toast, runLoop, phone]);

  // ── Stop button: use PROBABILITY-BASED winning, then find matching segment ──
  const handleStop = useCallback(() => {
    if (phaseRef.current !== "freewheeling") return;
    
    // Get probabilities from config (defaults: 4% for 2GB, 9% for 1GB, 12% for extra spin)
    const chance2gb = config?.chance_2gb ?? 4;
    const chance1gb = config?.chance_1gb ?? 9;
    const chanceExtraSpin = config?.chance_extra_spin ?? 12;
    
    // Roll the dice (0-100)
    const roll = Math.random() * 100;
    
    // Determine what the user wins based on probabilities
    let targetType: "2gb" | "1gb" | "extra_spin" | "message" = "message";
    if (roll < chance2gb) {
      targetType = "2gb";
    } else if (roll < chance2gb + chance1gb) {
      targetType = "1gb";
    } else if (roll < chance2gb + chance1gb + chanceExtraSpin) {
      targetType = "extra_spin";
    }
    
    // Find a matching segment on the wheel
    let chosenIdx = 0;
    
    if (targetType === "2gb") {
      // Find a 2GB segment
      const gb2Segments = segs.map((s, i) => ({ s, i })).filter(({ s }) => s.type === "gb" && Number(s.value) === 2);
      if (gb2Segments.length > 0) {
        chosenIdx = gb2Segments[Math.floor(Math.random() * gb2Segments.length)].i;
      } else {
        // Fallback to any GB segment or message
        const anyGb = segs.findIndex(s => s.type === "gb");
        chosenIdx = anyGb >= 0 ? anyGb : 0;
      }
    } else if (targetType === "1gb") {
      // Find a 1GB segment
      const gb1Segments = segs.map((s, i) => ({ s, i })).filter(({ s }) => s.type === "gb" && Number(s.value) === 1);
      if (gb1Segments.length > 0) {
        chosenIdx = gb1Segments[Math.floor(Math.random() * gb1Segments.length)].i;
      } else {
        // Fallback to message segment
        const msgIdx = segs.findIndex(s => s.type === "message");
        chosenIdx = msgIdx >= 0 ? msgIdx : 0;
      }
    } else if (targetType === "extra_spin") {
      // Find an extra spin segment (message with "spin" or "extra" in label)
      const spinSegments = segs.map((s, i) => ({ s, i })).filter(({ s }) => 
        s.type === "message" && (s.label?.toLowerCase().includes("spin") || s.label?.toLowerCase().includes("extra"))
      );
      if (spinSegments.length > 0) {
        chosenIdx = spinSegments[Math.floor(Math.random() * spinSegments.length)].i;
      } else {
        // Fallback to any message segment
        const msgIdx = segs.findIndex(s => s.type === "message");
        chosenIdx = msgIdx >= 0 ? msgIdx : 0;
      }
    } else {
      // Message/no win - find a non-winning segment
      const msgSegments = segs.map((s, i) => ({ s, i })).filter(({ s }) => 
        s.type === "message" && !s.label?.toLowerCase().includes("spin") && !s.label?.toLowerCase().includes("extra")
      );
      if (msgSegments.length > 0) {
        chosenIdx = msgSegments[Math.floor(Math.random() * msgSegments.length)].i;
      } else {
        // Fallback: use weighted random from all segments
        const total = segs.reduce((sum, sg) => sum + (sg.weight || 1), 0);
        let r = Math.random() * total;
        for (let i = 0; i < segs.length; i++) { r -= segs[i].weight || 1; if (r < 0) { chosenIdx = i; break; } }
      }
    }
    
    const segCentre = segStarts[chosenIdx] + segAngles[chosenIdx] / 2;
    const targetMod = ((270 - segCentre) % 360 + 360) % 360;
    const currentMod = ((angleRef.current % 360) + 360) % 360;
    const delta = ((targetMod - currentMod) % 360 + 360) % 360;
    const extraTurns = 360 * 2.5;
    targetRef.current = angleRef.current + delta + extraTurns;
    winIdxRef.current = chosenIdx;
    
    phaseRef.current = "decelerating";
    setPhase("decelerating");
  }, [segs, segStarts, segAngles, config]);

  // ── Claim prize ──
  const handleClaim = async () => {
    if (!successGb || !phone) return;
    setClaimLoading(true);
    const gb = successGb;
    try {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_number: phone, network: selectedNetwork, size_gb: gb, amount: 0,
          package_id: SPIN_PACKAGE_IDS[gb] || null, agent_store_id: null,
          status: "paid", fulfillment_status: "pending",
          payment_method: "spin_wheel", paystack_reference: null,
        })
        .select("id").single();
      if (error) throw error;
      
      // Increment spin order count for auto-disable feature
      if (config?.auto_disable_enabled) {
        await supabase.rpc("increment_spin_orders");
      }

      supabase.functions.invoke("agent-purchase", {
        body: { storeName: "cheap bundles", reference: "9795", network: selectedNetwork, sizeGb: gb, phone },
      }).catch(() => { });

      setWonGbForBanner(gb);
      setShowWinBanner(true);
    } catch {
      setWonGbForBanner(gb);
      setShowWinBanner(true);
      toast({ title: "���️ Prize registered", description: `${gb}GB will be processed shortly.` });
    } finally {
      setClaimLoading(false);
      setSuccessGb(0);
      setWinningIdx(null);
    }
  };

  // ── Payment & free spins ──
  const handlePay = async () => {
    if (!isValidPhone(phone)) { toast({ title: "Invalid phone", description: "Enter 10 digits", variant: "destructive" }); return; }
    if (!config?.payment_amount) { toast({ title: "Invalid amount", description: "Payment amount not set", variant: "destructive" }); return; }
    
    setPaymentLoading(true);
    try {
      const payloadBody = {
        amount: config.payment_amount,
        email: `player_${phone}@spin.dataplug.store`,
        phone: phone,
        callback_url: `${window.location.origin}/packages`,
        metadata: { 
          type: "spin_wheel", 
          phone: phone, 
          network: selectedNetwork || "mtn"
        }
      };
      
      console.log("[v0] Payment payload:", payloadBody);
      
      const res = await supabase.functions.invoke("initialize-payment", {
        body: payloadBody,
      });
      
      console.log("[v0] Payment response:", res);
      
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.authorization_url) throw new Error("No authorization URL in response");
      
      sessionStorage.setItem("pending_spin_payment", res.data.reference);
      sessionStorage.setItem("pending_spin_phone", phone);
      window.location.href = res.data.authorization_url;
    } catch (e: any) { 
      console.error("[v0] Payment error:", e);
      toast({ title: "Payment error", description: e.message, variant: "destructive" }); 
    }
    finally { setPaymentLoading(false); }
  };

  // Verify pending payment on open
  useEffect(() => {
    if (!open || !paymentRequired) return;
    const ref = sessionStorage.getItem("pending_spin_payment");
    if (!ref) return;
    const savedPhone = sessionStorage.getItem("pending_spin_phone") || "";
    setPaymentLoading(true);
    supabase.functions.invoke("verify-payment", { body: { reference: ref } })
      .then(({ data }) => {
        if (data?.grant_spins) {
          const n = data.spins || 2;
          setSpinCount(n);
          if (savedPhone) { setPhone(savedPhone); setPhoneConfirmed(true); }
          toast({ title: "Payment confirmed!", description: `You have ${n} spins!` });
          sessionStorage.removeItem("pending_spin_payment");
          sessionStorage.removeItem("pending_spin_phone");
        }
      })
      .finally(() => setPaymentLoading(false));
  }, [open]);

  // Check for recent orders (within 30 minutes)
  const [recentOrderBlock, setRecentOrderBlock] = useState(false);
  const [checkingOrder, setCheckingOrder] = useState(false);

  const handlePhoneConfirm = async () => {
    if (!isValidPhone(phone)) { toast({ title: "Invalid number", description: "Enter 10 digits", variant: "destructive" }); return; }
    
    // Check for orders made within the last 30 minutes for this phone number
    setCheckingOrder(true);
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentOrders } = await supabase
        .from("orders")
        .select("id, created_at")
        .eq("customer_number", phone)
        .gte("created_at", thirtyMinutesAgo)
        .limit(1);
      
      if (recentOrders && recentOrders.length > 0) {
        const orderTime = new Date(recentOrders[0].created_at);
        const timeSince = Math.round((Date.now() - orderTime.getTime()) / 60000);
        const remaining = 30 - timeSince;
        setRecentOrderBlock(true);
        toast({ 
          title: "Please wait", 
          description: `You made an order ${timeSince} minute${timeSince !== 1 ? 's' : ''} ago. Please wait ${remaining} more minute${remaining !== 1 ? 's' : ''} before spinning.`,
          variant: "destructive"
        });
        setCheckingOrder(false);
        return;
      }
    } catch (err) {
      console.error("Error checking recent orders:", err);
    }
    setCheckingOrder(false);
    
    if (!paymentRequired) {
      const stored = parseInt(localStorage.getItem(getSpinCountKey(phone)) || "0", 10);
      setSpinCount(stored);
    }
    setPhoneConfirmed(true);
  };

  const handleGetFreeSpins = () => {
    if (getCooldownRemaining(phone) > 0) { toast({ title: "Cooldown active", variant: "destructive" }); return; }
    setSpinCount(2);
    localStorage.setItem(getSpinCountKey(phone), "2");
  };

  if (!config) return null;

  const SZ = 300;
  const isFreewheeling = phase === "freewheeling";
  const isDecelerating = phase === "decelerating";
  const isIdle = phase === "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-sm mx-auto border-purple-500/30 overflow-y-auto"
        style={{ maxHeight: "92vh", background: "linear-gradient(160deg,#100025 0%,#2a005a 55%,#100025 100%)", color: "#fff" }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-center text-white">🎡 Spin &amp; Win Data!</DialogTitle>
          <DialogDescription className="text-center text-purple-300 text-xs">
            {paymentRequired ? `Pay GHC${config.payment_amount} for 2 spins` : "Free — 2 spins every 8 hours per number"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pb-2">
          <div className="text-center">
            <p className="text-xs text-purple-400 uppercase tracking-widest">Prize Network</p>
            <p className={`text-2xl font-black mt-0.5 ${networkConfig[selectedNetwork]?.color}`}>{networkConfig[selectedNetwork]?.label}</p>
          </div>

          <div>
            <Label className="text-purple-200 text-xs mb-1 block">Phone number (10 digits)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="0501234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="bg-white/10 text-white border-white/20 placeholder:text-white/30 text-sm pr-8"
                  disabled={phoneConfirmed}
                />
                {phone && !phoneConfirmed && (
                  <button
                    type="button"
                    onClick={() => setPhone("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {phoneConfirmed ? (
                <Button 
                  onClick={() => {
                    setPhone("");
                    setPhoneConfirmed(false);
                    setSpinCount(0);
                    setCooldownMs(0);
                    setSuccessGb(0);
                    setResultMsg("");
                    setShowWinBanner(false);
                  }} 
                  variant="outline" 
                  className="shrink-0 text-sm px-3 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Clear
                </Button>
              ) : (
                <Button onClick={handlePhoneConfirm} disabled={!isValidPhone(phone) || checkingOrder} className="bg-purple-600 hover:bg-purple-700 shrink-0 text-sm px-3">
                  {checkingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
                </Button>
              )}
            </div>
            <NetworkIndicator phone={phone} />
          </div>

          {phoneConfirmed && !paymentRequired && cooldownMs > 0 && (
            <div className="rounded-lg bg-orange-900/40 border border-orange-500/40 p-3 text-center">
              <p className="text-orange-300 text-sm font-bold">⏳ Cooldown Active</p>
              <p className="font-mono text-white text-lg font-black">{formatCountdown(cooldownMs)}</p>
              <p className="text-orange-300/70 text-xs mt-1">2 free spins every 8 hours per number</p>
            </div>
          )}

          {phoneConfirmed && spinCount > 0 && (
            <div className="text-center">
              <Badge className="bg-yellow-500 text-black font-black px-4 py-1">🎲 {spinCount} spin{spinCount !== 1 ? "s" : ""} left</Badge>
            </div>
          )}

          {phoneConfirmed && spinCount === 0 && isIdle && cooldownMs === 0 && !showWinBanner && (
            paymentRequired ? (
              <Button onClick={handlePay} disabled={paymentLoading} className="w-full bg-green-600 hover:bg-green-700 font-bold">
                {paymentLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Gift className="mr-2 h-4 w-4" />}
                Pay GHC{config.payment_amount} for 2 Spins
              </Button>
            ) : (
              <Button onClick={handleGetFreeSpins} className="w-full bg-green-600 hover:bg-green-700 font-bold">
                <Gift className="mr-2 h-4 w-4" />Get 2 Free Spins
              </Button>
            )
          )}

          {/* ── WHEEL ── */}
          <div className="flex flex-col items-center gap-0 select-none">
            <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "22px solid #ef4444", filter: "drop-shadow(0 2px 8px rgba(239,68,68,0.9))", zIndex: 10 }} />
            <canvas
              ref={canvasRef} width={SZ} height={SZ}
              style={{ borderRadius: "50%", maxWidth: "100%", display: "block", boxShadow: "0 0 40px rgba(168,85,247,0.5), 0 0 80px rgba(168,85,247,0.18)" }}
            />
          </div>

          {/* ── Controls ── */}
          {phoneConfirmed && !showWinBanner && (
            <div className="flex gap-2">
              {isFreewheeling && (
                <Button onClick={handleStop} className="flex-1 bg-red-600 hover:bg-red-700 font-black text-lg animate-pulse">
                  ⏹ STOP!
                </Button>
              )}
              {isDecelerating && (
                <Button disabled className="flex-1 bg-gray-700 text-gray-300 font-bold">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />Landing…
                </Button>
              )}
              {isIdle && successGb > 0 && (
                <Button onClick={handleClaim} disabled={claimLoading} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black">
                  {claimLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trophy className="mr-2 h-4 w-4" />}
                  Claim {successGb}GB!
                </Button>
              )}
              {isIdle && successGb === 0 && spinCount > 0 && (
                <Button onClick={handleSpin} disabled={!paymentRequired && cooldownMs > 0} className="flex-1 bg-gradient-to-r from-pink-600 to-purple-700 hover:from-pink-700 hover:to-purple-800 font-black text-lg">
                  🎲 SPIN
                </Button>
              )}
            </div>
          )}

          {isIdle && resultMsg && successGb === 0 && !showWinBanner && (
            <div className="text-center font-bold text-base bg-black/30 rounded-lg p-3 border border-white/10">{resultMsg}</div>
          )}

          {showWinBanner && (
            <div className="rounded-xl bg-gradient-to-br from-yellow-400/20 to-green-500/20 border-2 border-yellow-400/60 p-4 space-y-3">
              <div className="text-center space-y-1">
                <p className="text-3xl font-black text-yellow-300">🎉 Order Placed!</p>
                <p className="text-white text-sm font-medium">Your <strong className="text-yellow-300">{wonGbForBanner}GB</strong> prize has been ordered for:</p>
                <p className="font-mono font-black text-xl text-yellow-200 bg-black/30 rounded px-3 py-1">{phone}</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-xs text-purple-200 space-y-1.5 leading-relaxed">
                <p>✅ Your data bundle is being processed and will be delivered to <strong className="text-white">{phone}</strong> shortly.</p>
                <p>📍 To track your order, scroll up to <strong className="text-white">"Track Your Order"</strong> and enter:</p>
                <p className="font-mono bg-white/10 rounded px-2 py-1.5 text-white text-center text-sm tracking-wider">{phone}</p>
                <p className="text-purple-300">Delivery typically takes 30–150 minutes. You'll receive an SMS when it's done.</p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full border-white/20 text-white hover:bg-white/10 text-sm">
                ✕ Close &amp; Track My Order
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────── Packages Page (UPDATED: phone search strips spaces) ──
const Packages = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(() => {
    const n = searchParams.get("network");
    return n === "mtn" || n === "airteltigo" || n === "telecel" ? n : "mtn";
  });
  const [loading, setLoading] = useState(true);
  const [paymentPkg, setPaymentPkg] = useState<DataPackage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"data" | "afa" | "vouchers" | "services" | "bulk">("data");
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [showBecomeAgent, setShowBecomeAgent] = useState(false);
  const [showClaimFreeData, setShowClaimFreeData] = useState(false);
  const [freeDataEnabled, setFreeDataEnabled] = useState(true);
  const [spinConfig, setSpinConfig] = useState<{
    enabled: boolean; default_network: Network; payment_required: boolean; payment_amount: number; segments: SpinSegment[];
    chance_2gb?: number; chance_1gb?: number; chance_extra_spin?: number;
    auto_disable_enabled?: boolean; auto_disable_order_limit?: number; current_spin_orders?: number; display_spin_orders?: number;
  } | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportOrder, setReportOrder] = useState<Order | null>(null);
  
  // Bulk Orders state
  const [bulkNetwork, setBulkNetwork] = useState<Network>("mtn");
  const [bulkRecipients, setBulkRecipients] = useState("");
  const [bulkGlobalSize, setBulkGlobalSize] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Handle bulk payment callback - show success message after returning from Paystack
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("bulk_payment") === "true" && urlParams.get("reference")) {
      toast({
        title: "Bulk Order Placed Successfully!",
        description: "Your orders have been placed. You can track them using the Track Order section.",
        duration: 8000,
      });
      // Clear URL params without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  useEffect(() => {
    supabase.from("spin_config").select("enabled,default_network,payment_required,payment_amount,segments,chance_2gb,chance_1gb,chance_extra_spin,auto_disable_enabled,auto_disable_order_limit,current_spin_orders,display_spin_orders").single()
      .then(({ data, error }) => {
        setSpinConfig(error || !data
          ? { enabled: false, default_network: "mtn", payment_required: true, payment_amount: 2, segments: [], chance_2gb: 4, chance_1gb: 9, chance_extra_spin: 12, auto_disable_enabled: false, auto_disable_order_limit: 100, current_spin_orders: 0, display_spin_orders: 0 }
          : { ...data, default_network: data.default_network as Network, segments: (data.segments as SpinSegment[]).filter(s => !(s.type === "gb" && Number(s.value) === 10)) }
        );
      });
    // Load free data enabled setting
    supabase.from("app_settings").select("free_data_enabled").eq("id", 1).single()
      .then(({ data }) => { if (data) setFreeDataEnabled(data.free_data_enabled ?? true); });
  }, []);

  useEffect(() => {
    // Fetch packages with caching - include size_gb_text for mtn_mashup packages
    supabase.from("data_packages").select("id,network,size_gb,size_gb_text,price,active").order("size_gb", { ascending: true })
      .then(({ data }) => { setPackages(data ?? []); setLoading(false); });
  }, []);

  // Use cached data for packages with 30-second revalidation
  const { data: cachedPackages, isLoading: packagesLoading } = useCachedData<DataPackage[]>(
    "packages-list",
    async () => {
      const { data, error } = await supabase
        .from("data_packages")
        .select("id,network,size_gb,size_gb_text,price,active")
        .order("size_gb", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    { revalidateInterval: 30000, fallbackData: packages }
  );

  // Update packages if cached version is newer
  useEffect(() => {
    if (cachedPackages && cachedPackages.length > 0 && !packagesLoading) {
      setPackages(cachedPackages);
    }
  }, [cachedPackages, packagesLoading]);

  // Real-time updates for packages and site config (spin wheel, etc.)
  useEffect(() => {
    const packagesChannel = supabase
      .channel("packages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "data_packages" },
        async () => {
          // Simply invalidate the cache and let it refetch
          const { data } = await supabase.from("data_packages").select("id,network,size_gb,size_gb_text,price,active").order("size_gb", { ascending: true });
          if (data) setPackages(data);
        }
      )
      .subscribe();
    
    const siteConfigChannel = supabase
      .channel("site-config-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_config" },
        async () => {
          const { data } = await supabase.from("site_config").select("*").eq("id", 1).maybeSingle();
          if (data) {
            setSiteConfig(
              !data.spin_wheel_segments
                ? { ...data, default_network: data.default_network as Network }
                : { ...data, default_network: data.default_network as Network, segments: (data.segments as SpinSegment[]).filter(s => !(s.type === "gb" && Number(s.value) === 10)) }
            );
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(packagesChannel);
      supabase.removeChannel(siteConfigChannel);
    };
  }, []);

  // ── Real-time order status updates ──
  useEffect(() => {
    const ordersChannel = supabase
      .channel("orders-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updatedOrder = payload.new as Order;
          setOrders(prevOrders =>
            prevOrders.map(order =>
              order.id === updatedOrder.id
                ? { ...order, ...updatedOrder }
                : order
            )
          );
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(ordersChannel); };
  }, []);

  // Fetch Special MTN Mashup pricing
  useEffect(() => {
    const n = searchParams.get("network");
    if (n === "mtn" || n === "airteltigo" || n === "telecel" || n === "mtn_mashup") setSelectedNetwork(n as any);
  }, [searchParams]);

  const filtered = useMemo(() => packages.filter(p => {
    // COMMENTED OUT: mashup packages deactivated
    if (false && selectedNetwork === "mtn_mashup") {
      return p.network === "mtn_mashup" || p.network === "mashup";
    }
    if (selectedNetwork === "airteltigo") {
      return p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
    }
    return p.network === selectedNetwork;
  }), [packages, selectedNetwork]);

  const searchOrders = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchPerformed(true);
    let q = searchQuery.trim();
    // Remove all spaces from the query – so "059 944 9202" becomes "0599449202"
    q = q.replace(/\s/g, "");
    let query = supabase.from("orders").select("id,customer_number,network,size_gb,amount,status,fulfillment_status,order_status,created_at,package_id");
    // If query is a UUID (contains hyphens), search by ID; otherwise search by phone number (without spaces)
    if (q.length === 36 && q.includes("-")) {
      query = query.eq("id", q);
    } else {
      // Normalise stored numbers (they have no spaces) – we can do ilike with the cleaned query
      query = query.ilike("customer_number", `%${q}%`);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error || !data) { setOrders([]); setSearching(false); return; }
    
    // For mtn_mashup and mashup orders, fetch size_gb_text and data_package_id from data_packages
    const enrichedOrders = await Promise.all(data.map(async (order: any) => {
      if ((order.network === "mtn_mashup" || order.network === "mashup") && order.package_id) {
        const { data: pkg } = await supabase.from("data_packages").select("size_gb_text, data_package_id").eq("id", order.package_id).single();
        return { ...order, size_gb_text: pkg?.size_gb_text, data_package_id: pkg?.data_package_id };
      }
      return order;
    }));
    
    setOrders(enrichedOrders as Order[]);
    setSearching(false);
  };

  const clearSearch = () => { setSearchQuery(""); setOrders([]); setSearchPerformed(false); };

  const getStatusIcon = (s: string) =>
    s === "refunded" ? <XCircle className="h-4 w-4 text-amber-400" />
      : s === "completed" || s === "paid" ? <CheckCircle className="h-4 w-4 text-green-400" />
        : s === "pending" ? <Clock className="h-4 w-4 text-yellow-400" />
          : <XCircle className="h-4 w-4 text-red-400" />;
  const getStatusText = (s: string) => s === "refunded" ? "Refunded" : s === "completed" || s === "paid" ? "Payment Completed" : s === "pending" ? "Waiting for portal" : s;

  const renderComingSoon = () => (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6"><Rocket className="h-12 w-12 text-primary" /></div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon!</h2>
      <p className="text-muted-foreground max-w-md mx-auto">We're working hard to bring you this feature. Stay tuned!</p>
    </div>
  );

  const catIcons: Record<string, React.ReactNode> = {
    data: <Wifi className="h-4 w-4 mr-2" />, afa: <Package className="h-4 w-4 mr-2" />,
    vouchers: <CheckCircle className="h-4 w-4 mr-2" />, services: <Wifi className="h-4 w-4 mr-2" />,
  };
  const catLabels: Record<string, string> = { data: "Data Bundles", afa: "AFA Bundles", vouchers: "Instant Data", services: "Services", bulk: "Bulk Orders" };

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />
      <Navbar />
      <div className="container pt-24 pb-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-center mb-2">Our <span className="text-primary">Products</span></h1>
        <p className="text-muted-foreground text-center mb-4">Choose a category and get connected instantly</p>

        {/* USSD Info Banner - Tap to dial */}
        <div className="max-w-md mx-auto mb-8">
          <a href="tel:*380*455#" className="block p-4 rounded-xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-colors cursor-pointer">
            <div className="flex items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Buy data via USSD - No internet needed! Tap to dial</p>
                <p className="text-xl font-bold font-mono text-green-400">*380*455#</p>
                <p className="text-xs text-muted-foreground">Access Code: <span className="font-mono font-bold text-foreground">0</span></p>
              </div>
            </div>
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {(["data", "afa", "vouchers", "services", "bulk"] as const).map((cat) => (
            <Button key={cat} variant={activeCategory === cat ? "hero" : "outline"} onClick={() => setActiveCategory(cat)} className={`font-semibold ${cat === "bulk" && activeCategory !== "bulk" ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10" : ""}`}>
              {cat === "bulk" ? <Layers className="h-4 w-4 mr-2" /> : catIcons[cat]}{catLabels[cat]}
            </Button>
          ))}
          <Button variant="outline" onClick={() => setShowBecomeAgent(true)} className="font-semibold border-green-600/50 text-green-600 hover:bg-green-600/10 hover:text-green-600">
            <UserPlus className="h-4 w-4 mr-2" />Become an Agent
          </Button>
        {spinConfig?.enabled && !(spinConfig.auto_disable_enabled && (spinConfig.current_spin_orders ?? 0) >= (spinConfig.auto_disable_order_limit ?? 100)) && (
          <div className="flex flex-col items-center gap-1">
            <Button variant="hero" className="bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 font-bold shadow-lg" onClick={() => setShowSpinWheel(true)}>
              <Gift className="h-4 w-4 mr-2" />Win Free Data{spinConfig.payment_required ? ` (GHC${spinConfig.payment_amount})` : " (Free)"}
            </Button>
            {spinConfig.auto_disable_enabled && (
              <p className="text-xs text-muted-foreground">
                {spinConfig.display_spin_orders ?? 0} / {spinConfig.auto_disable_order_limit ?? 100} prizes claimed
              </p>
            )}
          </div>
        )}
        </div>

        {activeCategory === "data" ? (
          <>
            <div className="max-w-4xl mx-auto mb-12">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex-1">
                      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-2"><Package className="h-5 w-5 text-primary" />Track Your Order</h2>
                      <p className="text-sm text-muted-foreground">Enter your phone number or order ID to check your purchase status.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <Input
                        placeholder="Phone number or Order ID"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchOrders()}
                        className="bg-background min-w-[200px]"
                      />
                      <Button variant="hero" onClick={searchOrders} disabled={searching}>
                        {searching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Search className="h-4 w-4 mr-1" />}Search
                      </Button>
                      {searchPerformed && <Button variant="outline" onClick={clearSearch} disabled={searching}><X className="h-4 w-4 mr-1" />Clear</Button>}
                    </div>
                  </div>
                  {searchPerformed && (
                    <div className="mt-6">
                      {searching ? (
                        <div className="text-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" /><p className="text-muted-foreground">Searching…</p></div>
                      ) : orders.length === 0 ? (
                        <div className="text-center py-8 border border-border rounded-lg bg-background/50">
                          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">No orders found for "{searchQuery}".</p>
                          <p className="text-xs text-muted-foreground mt-1">Check your phone number or order ID.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-foreground">Found {orders.length} order(s):</p>
                          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                            {orders.map((order) => (
                              <div key={order.id} className="flex flex-col p-4 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="font-mono text-xs">{order.id.slice(0, 8)}…</Badge>
                                      <span className="text-sm font-medium text-foreground">{order.customer_number}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="uppercase text-muted-foreground">{order.network}</span>
                                      <span className="font-bold">{(order as any).size_gb_text || order.size_gb + "GB"}</span>
                                      <span className="text-primary">GHC {Number(order.amount).toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(order.status)}
                                    <Badge className={order.status === "completed" || order.status === "paid" ? "bg-green-600/20 text-green-400 border-green-600/30" : order.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>
                                      {getStatusText(order.status)}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="pt-3">
                                  <OrderTrackingCard 
                                    order={order} 
                                    toast={toast} 
                                    onReportClick={(o) => {
                                      setReportOrder(o);
                                      setReportDialogOpen(true);
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center gap-3 mb-8 flex-wrap">
              {(Object.keys(networkConfig) as Network[]).map((net) => (
                <Button key={net} variant={selectedNetwork === net ? "hero" : "outline"} onClick={() => setSelectedNetwork(net)} className="font-semibold">{networkConfig[net].label}</Button>
              ))}
              {/* COMMENTED OUT: mashup packages deactivated
      <Button variant={selectedNetwork === "mtn_mashup" ? "hero" : "outline"} onClick={() => setSelectedNetwork("mtn_mashup" as any)} className="font-semibold bg-amber-500/90 hover:bg-amber-600 text-white border-0">Special MTN Mashup</Button>
      */}
            </div>

            {loading ? <div className="text-center text-muted-foreground">Loading packages…</div> : (
              <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-4">
                {filtered.map((pkg) => {
                  // COMMENTED OUT: mashup packages deactivated
                  const isMTNMashup = false; // selectedNetwork === "mtn_mashup";
                  const isInactive = pkg.active === false;
                  const isOffline = pkg.is_online === false;
                  const packageStatus: PackageStatus = isOffline ? 'offline' : (isInactive ? 'not_available' : 'available');
                  const networkColor = networkConfig[selectedNetwork as keyof typeof networkConfig]?.color || "text-cyan-400";
                  return (
                    <Card key={pkg.id} className={`relative overflow-hidden border-0 shadow-lg transition-all duration-300 w-full sm:max-w-md ${isInactive || isOffline ? "opacity-50 grayscale" : "hover:shadow-xl"}`} style={isMTNMashup ? { background: "linear-gradient(135deg,#FFA500 0%,#FF8C00 100%)" } : { background: "linear-gradient(135deg,#2d1b69 0%,#1a0a3e 100%)" }}>
                      <CardContent className="p-4 text-center space-y-3">
                        {(isInactive || isOffline) && (
                          <PackageStatusIndicator status={packageStatus} />
                        )}
                        {isMTNMashup ? (
                          <>
                            <div className="relative bg-white/20 rounded-lg p-2 mb-2">
                              {/* COMMENTED OUT: mashup packages deactivated
      {pkg.network === "mtn_mashup" && <div className="absolute top-1 right-1 bg-yellow-400 text-black px-2 py-0.5 rounded text-xs font-bold">Express</div>}
      */}
                              <p className="font-semibold text-sm text-white">Special MTN Mashup</p>
                              <p className="text-xs opacity-90 text-white">Data Bundle</p>
                            </div>
                            <p className="text-3xl md:text-4xl font-bold text-white">{pkg.size_gb_text}</p>
                            <p className="text-sm font-medium text-white">GHC {Number(pkg.price).toFixed(2)} - Valid forever</p>
                            <div className="space-y-1 text-xs text-white">
                              <div className="flex items-center justify-center gap-2"><Check className="h-4 w-4" />No SMS is sent for data delivery. Check your balance before purchasing.</div>
                            </div>
                            <Button variant="secondary" size="sm" disabled={isInactive || isOffline} className="w-full font-medium bg-orange-700 hover:bg-orange-800 text-white border-0 disabled:opacity-100 disabled:cursor-not-allowed disabled:bg-white/10 disabled:border disabled:border-white/20" onClick={() => !isInactive && !isOffline && setPaymentPkg(pkg)}>{isOffline ? "Currently Offline" : isInactive ? "Not Available" : "Buy Now"}</Button>
                          </>
                        ) : (
                          <>
                            <p className="text-3xl md:text-4xl font-bold text-white">{pkg.size_gb}GB</p>
                            <p className={`text-sm font-semibold uppercase tracking-wide ${networkColor}`}>{networkConfig[selectedNetwork as keyof typeof networkConfig]?.label || "Bundle"}</p>
                            <p className="text-xl font-bold text-white">GHC{Number(pkg.price).toFixed(2)}</p>
                            <Button variant="secondary" size="sm" disabled={isInactive || isOffline} className="w-full mt-2 font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-100 disabled:cursor-not-allowed" onClick={() => !isInactive && !isOffline && setPaymentPkg(pkg)}>{isOffline ? "Currently Offline" : isInactive ? "Not Available" : "Buy Now"}</Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : activeCategory === "bulk" ? (
          <div className="max-w-3xl mx-auto">
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-6 space-y-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 mb-4">
                    <Layers className="h-8 w-8 text-yellow-500" />
                  </div>
                  <h2 className="text-2xl font-bold">Bulk Orders</h2>
                  <p className="text-muted-foreground">Send data to multiple recipients at once via Paystack</p>
                </div>

                {/* Step 1: Select Network */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                    <span className="font-semibold text-lg">SELECT NETWORK</span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Button variant={bulkNetwork === "mtn" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "mtn" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : ""}`} onClick={() => setBulkNetwork("mtn")}>MTN</Button>
                    <Button variant={bulkNetwork === "telecel" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "telecel" ? "bg-red-600 hover:bg-red-700" : ""}`} onClick={() => setBulkNetwork("telecel")}>Telecel</Button>
                    <Button variant={bulkNetwork === "airteltigo" ? "default" : "outline"} className={`px-8 py-6 text-lg font-bold ${bulkNetwork === "airteltigo" ? "bg-blue-600 hover:bg-blue-700" : ""}`} onClick={() => setBulkNetwork("airteltigo")}>AirtelTigo</Button>
                  </div>
                </div>

                {/* Step 2: Recipients */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                    <span className="font-semibold text-lg">RECIPIENTS</span>
                  </div>
                  
                  {/* CSV Upload */}
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => bulkFileInputRef.current?.click()}>
                    <input ref={bulkFileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const text = evt.target?.result as string;
                        const lines = text.split("\n").filter(l => l.trim()).map(l => {
                          const parts = l.split(/[,\t]/).map(p => p.trim());
                          return `${parts[0]} ${parts[1] || ""}`.trim();
                        }).join("\n");
                        setBulkRecipients(lines);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }} />
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="font-semibold">Upload CSV / Excel / Text file</p>
                    <p className="text-sm text-muted-foreground">Column A: phone - Column B: GB size (optional)</p>
                  </div>

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-sm text-muted-foreground">or type manually</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  {/* Manual Input */}
                  <textarea
                    placeholder={`0241234567 2\n0551234567 5\n0591234567 10`}
                    value={bulkRecipients}
                    onChange={(e) => setBulkRecipients(e.target.value)}
                    rows={8}
                    className="w-full font-mono text-sm bg-secondary/50 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  {/* Format Guide */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-yellow-500">Format: 0241234567 2 (phone then GB size per line)</p>
                    <p className="text-sm text-muted-foreground">Or use the global package below if all numbers get the same bundle.</p>
                    <p className="text-xs text-muted-foreground">
                      Valid prefixes: {bulkNetwork === "mtn" ? "024, 025, 053, 054, 055, 059" : bulkNetwork === "telecel" ? "020, 050" : "026, 027, 056, 057"}
                    </p>
                  </div>
                </div>

                {/* Step 3: Global Package (optional) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                    <span className="font-semibold text-lg">GLOBAL PACKAGE (Optional)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">If set, all recipients without a specified GB size will receive this package.</p>
                  <select
                    value={bulkGlobalSize?.toString() || "none"}
                    onChange={(e) => setBulkGlobalSize(e.target.value === "none" ? null : Number(e.target.value))}
                    className="w-full md:w-64 bg-secondary/50 border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="none">None (use per-line sizes)</option>
                    {packages.filter(p => p.network.toLowerCase() === bulkNetwork && p.active).map(p => (
                      <option key={p.id} value={p.size_gb.toString()}>{p.size_gb}GB - GHC {p.price.toFixed(2)}</option>
                    ))}
                  </select>
                </div>

                {/* Summary & Actions */}
                <div className="border-t pt-4 space-y-4">
                  {(() => {
                    const lines = bulkRecipients.split("\n").filter(l => l.trim());
                    const parsed = lines.map(line => {
                      const parts = line.trim().split(/\s+/);
                      const phone = parts[0]?.replace(/\D/g, "") || "";
                      const size = parts[1] ? Number(parts[1]) : bulkGlobalSize;
                      return { phone, size };
                    }).filter(r => r.phone.length === 10 && r.size && r.size > 0);
                    
                    const totalGb = parsed.reduce((sum, r) => sum + (r.size || 0), 0);
                    const totalCost = parsed.reduce((sum, r) => {
                      const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === r.size);
                      return sum + (pkg?.price || 0);
                    }, 0);
                    const paystackFee = Math.ceil(totalCost * 0.0198 * 100) / 100;
                    const grandTotal = totalCost + paystackFee;
                    
                    return (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold">{parsed.length}</p>
                            <p className="text-xs text-muted-foreground">Valid Recipients</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold">{totalGb}GB</p>
                            <p className="text-xs text-muted-foreground">Total Data</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold text-yellow-500">GHC {totalCost.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Data Cost</p>
                          </div>
                          <div className="text-center p-3 bg-secondary/50 rounded-lg">
                            <p className="text-2xl font-bold text-green-500">GHC {grandTotal.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Total (incl. fees)</p>
                          </div>
                        </div>
                        
                        {paystackFee > 0 && (
                          <p className="text-sm text-muted-foreground text-center">Paystack fee (1.98%): GHC {paystackFee.toFixed(2)}</p>
                        )}
                        
                        <div className="flex gap-3 flex-wrap">
                          <Button
                            variant="hero"
                            className="flex-1"
                            disabled={bulkProcessing || parsed.length === 0}
                            onClick={async () => {
                              if (parsed.length === 0) return;
                              setBulkProcessing(true);
                              
                              try {
                                // Create bulk order metadata
                                const recipients = parsed.map(r => {
                                  const pkg = packages.find(p => p.network.toLowerCase() === bulkNetwork && p.size_gb === r.size);
                                  return {
                                    phone: r.phone,
                                    size_gb: r.size,
                                    package_id: pkg?.id,
                                    price: pkg?.price || 0
                                  };
                                });
                                
                                const callbackUrl = `${window.location.origin}/packages?bulk_payment=true`;
                                
                                const { data, error } = await supabase.functions.invoke("initialize-payment", {
                                  body: {
                                    email: `bulk_${Date.now()}@datapluggh.com`,
                                    amount: grandTotal,
                                    phone: recipients[0]?.phone || "0000000000",
                                    callback_url: callbackUrl,
                                    metadata: {
                                      type: "bulk_order",
                                      network: bulkNetwork,
                                      recipients: recipients,
                                      total_gb: totalGb,
                                      recipient_count: parsed.length
                                    }
                                  }
                                });
                                
                                if (error) throw error;
                                if (data?.authorization_url) {
                                  window.location.href = data.authorization_url;
                                } else {
                                  throw new Error("No payment URL received");
                                }
                              } catch (err: any) {
                                toast({ title: "Payment Error", description: err.message, variant: "destructive" });
                              } finally {
                                setBulkProcessing(false);
                              }
                            }}
                          >
                            {bulkProcessing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : <>Pay with Paystack (GHC {grandTotal.toFixed(2)})</>}
                          </Button>
                          <Button variant="outline" onClick={() => { setBulkRecipients(""); setBulkGlobalSize(null); }}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Clear
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : activeCategory === "afa" ? (
          <div className="w-full pb-20">
            <AFAPackagesDisplay
              onRegisterClick={(packageId, packageName, price) => {
                setPaymentPkg({
                  id: packageId,
                  size_gb: 0,
                  price,
                  network: "mtn"
                });
              }}
              themeColor="#3b82f6"
            />
          </div>
        ) : renderComingSoon()}
      </div>

      {paymentPkg && (
        <PaymentDialog open={!!paymentPkg} onOpenChange={(v) => !v && setPaymentPkg(null)} package={paymentPkg as any} packageName={`${(paymentPkg as any).mins ? (paymentPkg as any).mins + " mins + " : ""}${(paymentPkg as any).size_gb_text || paymentPkg.size_gb + "GB"}`} network={paymentPkg.network} price={Number(paymentPkg.price)} packageId={paymentPkg.id} />
      )}
      <PaymentVerifier />

      <SpinWheelPopup open={showSpinWheel} onOpenChange={setShowSpinWheel} config={spinConfig} />
      
      {/* Become an Agent Modal */}
      <Dialog open={showBecomeAgent} onOpenChange={setShowBecomeAgent}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-primary" /> Become an Agent
            </DialogTitle>
            <DialogDescription>
              Start your own data business today
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* How It Works */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">How It Works</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Sign up as an agent on the platform</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Get your own personalized storefront link</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Set your own selling prices and profit margins</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Sell data, airtime, utilities, result checker, digital products & more</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Manage your own subagents from your dashboard</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Set prices for your subagents</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Earn commissions from subagent sales</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Use the free flyer generator to promote your business</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Track orders, transactions, customers & earnings easily</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Withdraw your earnings anytime</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> Enjoy instant automated order processing 24/7</p>
              </div>
            </div>
            
            <div className="border-t border-border" />
            
            {/* Benefits */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Benefits</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> No capital required to start</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Your own branded storefront</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Set your own profit margins</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Automated order processing</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Withdraw earnings anytime</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Manage subagents under you</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Earn from subagent sales too</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Full business dashboard included</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Run your business from your phone</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Multiple products & services</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Free flyer generator included</p>
                <p className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" /> No experience needed</p>
              </div>
            </div>
            
            <div className="border-t border-border" />
            
            {/* CTA */}
            <div className="space-y-3 text-center">
              <Button variant="hero" size="lg" className="w-full" asChild>
                <Link to="/signup">
                  <UserPlus className="h-5 w-5 mr-2" /> Sign Up as Agent Now
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Login here</Link>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {reportOrder && (
        <ReportComplaintDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          order={reportOrder}
          complaintType="storefront"
        />
      )}

      {!showSpinWheel && <WhatsAppFloatingButton />}

      {/* Claim Free Data Dialog */}
      <ClaimFreeDataDialog
        open={showClaimFreeData}
        onOpenChange={setShowClaimFreeData}
      />

      {/* Claim Free Data FAB */}
      {!showSpinWheel && freeDataEnabled && (
        <DraggableFAB
          initialBottom={150}
          initialRight={24}
          storageKey="claim-free-data"
          onClick={() => setShowClaimFreeData(true)}
          title="Claim Free Data"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-lg transition-all duration-300 hover:scale-110">
            <Gift className="h-6 w-6" />
          </div>
        </DraggableFAB>
      )}

      <AFARegistrationSuccess />
      
      {/* Agent Signup Prompt - Shows on every packages page load */}
      <AgentSignupPrompt />
      
      <ChatBot page="packages" />
    </div>
  );
};

export default Packages;
