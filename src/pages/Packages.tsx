import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import NotificationPopup from "@/components/NotificationPopup";
import PaymentDialog from "@/components/PaymentDialog";
import PaymentVerifier from "@/components/PaymentVerifier";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wifi, Search, Package, CheckCircle, Clock, XCircle, X,
  Loader2, Check, Mail, MessageCircle, Rocket, Gift, Trophy,
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
  price: number;
}

interface Order {
  id: string;
  customer_number: string;
  network: string;
  size_gb: number;
  amount: number;
  status: string;
  fulfillment_status: string;
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

// ────────────────────────────────────────────── Order Tracking Card ──
const OrderTrackingCard = ({ order, toast }: { order: Order; toast: any }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const elapsed = (now.getTime() - new Date(order.created_at).getTime()) / 60000;
  let step = 1, msg = "", note: string | null = null;

  if (elapsed >= 150) {
    step = 4; msg = "Your data bundle has been delivered successfully.";
    note = order.network === "mtn" ? "Check your MTNUP2U and MTN messages."
      : order.network === "airteltigo" ? "Check your AirtelTigo iShare and BigTime messages."
        : order.network === "telecel" ? "Check your Telecel messages." : "Check your messages.";
  } else if (elapsed >= 60) {
    step = 3;
    msg = order.network === "mtn" ? "Expecting your data soon. Check MTN / MTNUP2U messages."
      : order.network === "airteltigo" ? "Expecting your data soon. Check AirtelTigo iShare / BigTime."
        : order.network === "telecel" ? "Expecting your data soon. Check Telecel messages." : "Expecting your data soon.";
    note = "Order is now with the network. Any further delay is from them.";
  } else if (elapsed >= 15) {
    step = 3; msg = "Your order can be delivered any moment. Report only if it shows 'Delivered' but you didn't receive.";
  } else if (elapsed >= 12) {
    step = 3; msg = `Waiting for validation from ${formatNetworkName(order.network)}…`;
  } else if (elapsed >= 9) {
    step = 2; msg = `Order sent to ${formatNetworkName(order.network)} for validation.`;
    note = "Delay from here is from the network.";
  } else {
    msg = "Order being processed…";
  }

  const d = new Date(order.created_at).toLocaleString();

  // Build detailed report message exactly as requested
  const getDetailedReportMessage = (): string => {
    const orderDate = new Date(order.created_at).toLocaleString();
    const networkName = formatNetworkName(order.network);
    const amountFormatted = `GH₵ ${Number(order.amount).toFixed(2)}`;
    const orderStatus = `${order.status} / ${order.fulfillment_status}`;

    return `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.

Order Details:
- Order Date: ${orderDate}
- Network: ${networkName}
- Data: ${order.size_gb}GB
- Amount: ${amountFormatted}
- Customer Number: ${order.customer_number}
- Order Status: ${orderStatus}
- Order ID: ${order.id}

Please investigate and assist. Thank you.`;
  };

  const reportMessage = getDetailedReportMessage();
  const waLink = `https://wa.me/233200511211?text=${encodeURIComponent(reportMessage)}`;
  const mailtoLink = `mailto:dataplugstore@gmail.com?subject=${encodeURIComponent("Order Support - Delivered but not received")}&body=${encodeURIComponent(reportMessage)}`;

  const labels = ["Order Placed", "Sent to Network", "Network Validation", "Delivered"];

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
      {elapsed >= 150 && elapsed < 3030 && (
        <Button variant="outline" size="sm" className="w-full border-yellow-600/50 text-yellow-600 hover:bg-yellow-600/10" asChild>
          <a href={waLink} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-2" />Only Report: If it Shows Delivered <br></br>but you have not received it</a>
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex justify-between">
          {labels.map((l, i) => {
            const n = i + 1;
            const icon = n < step ? <Check className="h-4 w-4 text-green-400" /> : n === step ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <Clock className="h-4 w-4 text-muted-foreground" />;
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${n < step ? "bg-green-600/20" : n === step ? "bg-primary/20 border border-primary/50" : "bg-muted"}`}>{icon}</div>
                <span className={`text-xs text-center mt-1 ${n === step ? "text-primary font-medium" : "text-muted-foreground"}`}>{l}</span>
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
        {step === 1 && elapsed < 8 && <p className="text-xs text-muted-foreground mt-1">Estimated time remaining: {Math.max(0, Math.ceil(8 - elapsed))} min(s)</p>}
      </div>
      {elapsed >= 132 && (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={mailtoLink}><Mail className="h-4 w-4 mr-2" />Contact Support</a>
        </Button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────── Spin Wheel Popup ──
interface SpinWheelPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: {
    enabled: boolean;
    default_network: Network;
    payment_required: boolean;
    payment_amount: number;
    segments: SpinSegment[];
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
      // current canvas angle of this segment's centre
      const canvasAngle = ((segCenter + finalAngle) % 360 + 360) % 360;
      // distance to 270° (top)
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
    // Determine winner by the segment under the pointer
    const winner = getSegmentUnderPointer(angleRef.current);
    winIdxRef.current = winner;
    setWinningIdx(winner);
    draw(angleRef.current, winner);

    phaseRef.current = "idle";
    setPhase("idle");

    const seg = segs[winner];

    if (seg.type === "extra_spin") {
      // extra spin – normal logic, spins increase
      const newCount = spinCount; // keep current, then add 1
      setSpinCount(newCount + 1);
      if (!paymentRequired) {
        localStorage.setItem(getSpinCountKey(phone), String(newCount + 1));
      }
      sounds.win();
      setResultMsg("🎁 Extra Spin! +1 added!");
      toast({ title: "Extra spin!", description: "You earned an extra spin!" });
    } else if (seg.type === "gb" && Number(seg.value) > 0) {
      // GB prize – FORFEIT ALL REMAINING SPINS
      sounds.win();
      setSuccessGb(Number(seg.value));
      setResultMsg(`🎉 You won ${seg.value}GB!`);

      // Set spin count to 0 immediately
      setSpinCount(0);
      if (!paymentRequired) {
        localStorage.removeItem(getSpinCountKey(phone));
        // Start cooldown so no free spins until next window
        localStorage.setItem(getSpinCooldownKey(phone), String(Date.now() + SPIN_COOLDOWN_MS));
      }
      // Do NOT decrement; just wipe remaining spins
    } else {
      // Message / no win – normal decrement
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

    setSuccessGb(0); setResultMsg(""); setShowWinBanner(false); setWonGbForBanner(0);
    setWinningIdx(null);

    velocityRef.current = 18;
    lastTickRef.current = angleRef.current;
    phaseRef.current = "freewheeling";
    setPhase("freewheeling");
    runLoop();
  }, [segs, spinCount, paymentRequired, cooldownMs, toast, runLoop]);

  // ── Stop button: pick a random winning segment, compute target angle to place it under pointer ──
  const handleStop = useCallback(() => {
    if (phaseRef.current !== "freewheeling") return;

    // Randomly choose winning segment (still using weights)
    const total = segs.reduce((s, sg) => s + (sg.weight || 1), 0);
    let r = Math.random() * total;
    let chosenIdx = 0;
    for (let i = 0; i < segs.length; i++) { r -= segs[i].weight || 1; if (r < 0) { chosenIdx = i; break; } }

    // Compute target rotation so that the centre of the chosen segment is exactly at 270°
    const segCentre = segStarts[chosenIdx] + segAngles[chosenIdx] / 2;
    const targetMod = ((270 - segCentre) % 360 + 360) % 360;
    const currentMod = ((angleRef.current % 360) + 360) % 360;
    const delta = ((targetMod - currentMod) % 360 + 360) % 360;
    const extraTurns = 360 * 2.5; // at least 2.5 full rotations for drama
    targetRef.current = angleRef.current + delta + extraTurns;
    winIdxRef.current = chosenIdx;

    phaseRef.current = "decelerating";
    setPhase("decelerating");
  }, [segs, segStarts, segAngles]);

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

      supabase.functions.invoke("agent-purchase", {
        body: { storeName: "cheap bundles", reference: "9795", network: selectedNetwork, sizeGb: gb, phone },
      }).catch(() => { });

      setWonGbForBanner(gb);
      setShowWinBanner(true);
    } catch {
      setWonGbForBanner(gb);
      setShowWinBanner(true);
      toast({ title: "⚠️ Prize registered", description: `${gb}GB will be processed shortly.` });
    } finally {
      setClaimLoading(false);
      setSuccessGb(0);
      setWinningIdx(null);
    }
  };

  // ── Payment & free spins ──
  const handlePay = async () => {
    if (!isValidPhone(phone)) { toast({ title: "Invalid phone", description: "Enter 10 digits", variant: "destructive" }); return; }
    setPaymentLoading(true);
    try {
      const res = await supabase.functions.invoke("initiate-payment", {
        body: { amount: config!.payment_amount, email: `player_${phone}@spin.dataplug.store`, phone, callback_url: `${window.location.origin}/packages`, metadata: { type: "spin_wheel", phone, network: selectedNetwork } },
      });
      if (res.error) throw new Error(res.error.message);
      sessionStorage.setItem("pending_spin_payment", res.data.reference);
      sessionStorage.setItem("pending_spin_phone", phone);
      window.location.href = res.data.authorization_url;
    } catch (e: any) { toast({ title: "Payment error", description: e.message, variant: "destructive" }); }
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

  const handlePhoneConfirm = () => {
    if (!isValidPhone(phone)) { toast({ title: "Invalid number", description: "Enter 10 digits", variant: "destructive" }); return; }
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
            {paymentRequired ? `Pay GH₵${config.payment_amount} for 2 spins` : "Free — 2 spins every 8 hours per number"}
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
              <Input
                placeholder="0501234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="bg-white/10 text-white border-white/20 placeholder:text-white/30 text-sm"
                disabled={phoneConfirmed}
              />
              {!phoneConfirmed && (
                <Button onClick={handlePhoneConfirm} disabled={!isValidPhone(phone)} className="bg-purple-600 hover:bg-purple-700 shrink-0 text-sm px-3">OK</Button>
              )}
            </div>
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
                Pay GH₵{config.payment_amount} for 2 Spins
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

// ─────────────────────────────────────────────────── Packages Page ──
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
  const [activeCategory, setActiveCategory] = useState<"data" | "afa" | "vouchers" | "services">("data");
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [spinConfig, setSpinConfig] = useState<{
    enabled: boolean; default_network: Network; payment_required: boolean; payment_amount: number; segments: SpinSegment[];
  } | null>(null);

  useEffect(() => {
    supabase.from("spin_config").select("enabled,default_network,payment_required,payment_amount,segments").single()
      .then(({ data, error }) => {
        setSpinConfig(error || !data
          ? { enabled: false, default_network: "mtn", payment_required: true, payment_amount: 2, segments: [] }
          : { ...data, default_network: data.default_network as Network, segments: (data.segments as SpinSegment[]).filter(s => !(s.type === "gb" && Number(s.value) === 10)) }
        );
      });
  }, []);

  useEffect(() => {
    supabase.from("data_packages").select("id,network,size_gb,price").eq("active", true).order("size_gb", { ascending: true })
      .then(({ data }) => { setPackages(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    const n = searchParams.get("network");
    if (n === "mtn" || n === "airteltigo" || n === "telecel") setSelectedNetwork(n);
  }, [searchParams]);

  const filtered = useMemo(() => packages.filter(p => p.network === selectedNetwork), [packages, selectedNetwork]);

  const searchOrders = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true); setSearchPerformed(true);
    const q = searchQuery.trim();
    let query = supabase.from("orders").select("id,customer_number,network,size_gb,amount,status,fulfillment_status,created_at");
    query = q.length === 36 && q.includes("-") ? query.eq("id", q) : query.ilike("customer_number", `%${q}%`);
    const { data, error } = await query.order("created_at", { ascending: false });
    setOrders(!error && data ? data as Order[] : []);
    setSearching(false);
  };

  const clearSearch = () => { setSearchQuery(""); setOrders([]); setSearchPerformed(false); };

  const getStatusIcon = (s: string) =>
    s === "completed" || s === "paid" ? <CheckCircle className="h-4 w-4 text-green-400" />
      : s === "pending" ? <Clock className="h-4 w-4 text-yellow-400" />
        : <XCircle className="h-4 w-4 text-red-400" />;
  const getStatusText = (s: string) => s === "completed" || s === "paid" ? "Payment Completed" : s === "pending" ? "Pending" : s;

  const renderComingSoon = () => (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6"><Rocket className="h-12 w-12 text-primary" /></div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon!</h2>
      <p className="text-muted-foreground max-w-md mx-auto">We're working hard to bring you this feature. Stay tuned!</p>
    </div>
  );

  const catIcons: Record<string, React.ReactNode> = {
    data: <Wifi className="h-4 w-4 mr-2" />, afa: <Package className="h-4 w-4 mr-2" />,
    vouchers: <CheckCircle className="h-4 w-4 mr-2" />, services: <Rocket className="h-4 w-4 mr-2" />,
  };
  const catLabels: Record<string, string> = { data: "Data Bundles", afa: "AFA Bundles", vouchers: "Vouchers", services: "Internet Services" };

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />
      <Navbar />
      <div className="container pt-24 pb-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-center mb-2">Our <span className="text-primary">Products</span></h1>
        <p className="text-muted-foreground text-center mb-8">Choose a category and get connected instantly</p>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {(["data", "afa", "vouchers", "services"] as const).map((cat) => (
            <Button key={cat} variant={activeCategory === cat ? "hero" : "outline"} onClick={() => setActiveCategory(cat)} className="font-semibold">
              {catIcons[cat]}{catLabels[cat]}
            </Button>
          ))}
          {spinConfig?.enabled && (
            <Button variant="hero" className="bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-700 hover:to-orange-600 font-bold shadow-lg" onClick={() => setShowSpinWheel(true)}>
              <Gift className="h-4 w-4 mr-2" />🎡 Win Free Data{spinConfig.payment_required ? ` (GH₵${spinConfig.payment_amount})` : " (Free)"}
            </Button>
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
                      <Input placeholder="Phone number or Order ID" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchOrders()} className="bg-background min-w-[200px]" />
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
                                      <span className="font-bold">{order.size_gb}GB</span>
                                      <span className="text-primary">GH₵ {Number(order.amount).toFixed(2)}</span>
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
                                <div className="pt-3"><OrderTrackingCard order={order} toast={toast} /></div>
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

            <div className="flex justify-center gap-3 mb-8">
              {(Object.keys(networkConfig) as Network[]).map((net) => (
                <Button key={net} variant={selectedNetwork === net ? "hero" : "outline"} onClick={() => setSelectedNetwork(net)} className="font-semibold">{networkConfig[net].label}</Button>
              ))}
            </div>

            {loading ? <div className="text-center text-muted-foreground">Loading packages…</div> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filtered.map((pkg) => (
                  <Card key={pkg.id} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{ background: "linear-gradient(135deg,#2d1b69 0%,#1a0a3e 100%)" }}>
                    <CardContent className="p-4 text-center space-y-2">
                      <p className="text-3xl md:text-4xl font-bold text-white">{pkg.size_gb}GB</p>
                      <p className={`text-sm font-semibold uppercase tracking-wide ${networkConfig[selectedNetwork].color}`}>{networkConfig[selectedNetwork].label}</p>
                      <p className="text-xl font-bold text-white">GHC{Number(pkg.price).toFixed(2)}</p>
                      <Button variant="secondary" size="sm" className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium" onClick={() => setPaymentPkg(pkg)}>Buy Now</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : renderComingSoon()}
      </div>

      {paymentPkg && (
        <PaymentDialog open={!!paymentPkg} onOpenChange={(v) => !v && setPaymentPkg(null)} packageName={`${paymentPkg.size_gb}GB`} network={selectedNetwork} price={Number(paymentPkg.price)} packageId={paymentPkg.id} />
      )}
      <PaymentVerifier />

      <SpinWheelPopup open={showSpinWheel} onOpenChange={setShowSpinWheel} config={spinConfig} />

      {!showSpinWheel && (
        <a href="https://whatsapp.com/channel/0029VbCBiBmCsU9XSl2ozc3R" target="_blank" rel="noopener noreferrer"
          style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000, display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#25D366", borderRadius: "30px", padding: "10px 15px", boxShadow: "0 4px 6px rgba(0,0,0,0.3)", cursor: "pointer", transition: "transform 0.2s" }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")} onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" style={{ width: "35px", height: "35px" }} />
          <span style={{ color: "white", fontWeight: "bold", fontSize: "14px", whiteSpace: "nowrap" }}>Join channel – get updates &amp; free giveaways</span>
        </a>
      )}
    </div>
  );
};

export default Packages;