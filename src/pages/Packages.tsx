import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  Loader2, Check, Mail, MessageCircle, Rocket, Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

const networkConfig: Record<Network, { label: string; color: string }> = {
  mtn: { label: "MTN", color: "text-yellow-400" },
  airteltigo: { label: "AirtelTigo", color: "text-blue-400" },
  telecel: { label: "Telecel", color: "text-red-400" },
};

const formatNetworkName = (network: string) => {
  if (network === "mtn") return "MTN";
  if (network === "airteltigo") return "AirtelTigo";
  if (network === "telecel") return "Telecel";
  return network;
};

// ============================================================
// ORDER TRACKING CARD – your original unchanged
// ============================================================
const OrderTrackingCard = ({ order, toast }: { order: Order; toast: any }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const orderCreatedAt = new Date(order.created_at);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedMs = currentTime.getTime() - orderCreatedAt.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);

  let currentStep = 1;
  let statusMessage = "";
  let extraNote = null;

  if (elapsedMinutes >= 150) {
    currentStep = 4;
    statusMessage = "Your data bundle has been delivered successfully.";
    if (order.network === "mtn") {
      extraNote = "Please check your MTNUP2U and MTN messages for delivery confirmation.";
    } else if (order.network === "airteltigo") {
      extraNote = "Please check your AirtelTigo iShare and BigTime messages for delivery confirmation.";
    } else if (order.network === "telecel") {
      extraNote = "Please check your Telecel messages for delivery confirmation.";
    } else {
      extraNote = "Please check your messages for delivery confirmation.";
    }
  }
  else if (elapsedMinutes >= 60) {
    currentStep = 3;
    if (order.network === "mtn") {
      statusMessage = "Please be expecting your data any moment from now. Check your MTN and MTNUP2U messages for delivery confirmation.";
    } else if (order.network === "airteltigo") {
      statusMessage = "Please be expecting your data any moment from now. Check your AirtelTigo iShare or BigTime messages for delivery confirmation.";
    } else if (order.network === "telecel") {
      statusMessage = "Please be expecting your data any moment from now. Check your Telecel messages for delivery confirmation.";
    } else {
      statusMessage = "Please be expecting your data any moment from now. Check your messages for delivery confirmation.";
    }
    extraNote = "The order has left our system and is now with the network you bought the data from. All delays from now are from them.";
  }
  else if (elapsedMinutes >= 12) {
    currentStep = 3;
    statusMessage = `Waiting for validation from ${formatNetworkName(order.network)}...`;
    if (elapsedMinutes >= 15) {
      statusMessage = "Your order can be delivered any moment from now. You can ignore the progress steps. Please report only if data is not delivered while it shows 'Delivered'.";
    }
  }
  else if (elapsedMinutes >= 9) {
    currentStep = 2;
    statusMessage = `Order sent to ${formatNetworkName(order.network)} for validation`;
    extraNote = "Now waiting for validation from the network to deliver your data. All delay now is from the network you bought the data from.";
  }
  else {
    currentStep = 1;
    statusMessage = "Order being processed...";
  }

  const orderDate = new Date(order.created_at).toLocaleString();

  const emailSubject = encodeURIComponent("Order Support Request");
  const emailBody = encodeURIComponent(
    `Hello,\n\nI need assistance with my order.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease help resolve this issue.\n\nThank you.`
  );
  const mailtoLink = `mailto:dataplugstore@gmail.com?subject=${emailSubject}&body=${emailBody}`;

  const whatsappNumber = "233200511211";
  const whatsappMessage = encodeURIComponent(
    `Hello, I am reporting that my order shows as "Delivered" but I have not received the data.\n\nOrder Details:\n- Order Date: ${orderDate}\n- Network: ${formatNetworkName(order.network)}\n- Data: ${order.size_gb}GB\n- Amount: GH₵ ${Number(order.amount).toFixed(2)}\n- Customer Number: ${order.customer_number}\n- Order Status: ${order.status} / ${order.fulfillment_status}\n- Order ID: ${order.id}\n\nPlease investigate and assist. Thank you.`
  );
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const showSupportButton = elapsedMinutes >= 132 && currentStep !== 4;
  const showReportButton = currentStep === 4 && elapsedMinutes >= 150 && elapsedMinutes < 3030;

  if (currentStep === 4) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Delivery Status</span>
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Delivered
          </Badge>
        </div>
        <div className="relative">
          <div className="flex items-center justify-between">
            {["Order Placed", "Sent to Network", "Network Validation", "Delivered"].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1">
                <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-xs text-center mt-1 text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-4 left-0 w-full h-0.5 bg-green-600/30 -z-10" />
        </div>
        <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/30">
          <p className="text-sm text-foreground font-medium">{statusMessage}</p>
          {extraNote && (
            <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-green-600/20">
              {extraNote}
            </p>
          )}
        </div>
        {showReportButton && (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-yellow-600/50 text-yellow-600 hover:bg-yellow-600/10"
            asChild
          >
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Only Report: if it shows Delivered<br /> here
              but you did not received it
            </a>
          </Button>
        )}
      </div>
    );
  }

  const steps = [
    { name: "Order Placed", step: 1 },
    { name: "Sent 2 Network", step: 2 },
    { name: "Network Validation", step: 3 },
    { name: "Delivered", step: 4 },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step) => {
            let icon;
            if (step.step < currentStep) {
              icon = <Check className="h-4 w-4 text-green-400" />;
            } else if (step.step === currentStep) {
              icon = <Loader2 className="h-4 w-4 text-primary animate-spin" />;
            } else {
              icon = <Clock className="h-4 w-4 text-muted-foreground" />;
            }
            return (
              <div key={step.step} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.step < currentStep
                  ? "bg-green-600/20 text-green-400"
                  : step.step === currentStep
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "bg-muted text-muted-foreground"
                  }`}>
                  {icon}
                </div>
                <span className={`text-xs text-center mt-1 ${step.step === currentStep ? "text-primary font-medium" : "text-muted-foreground"
                  }`}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-10">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-foreground font-medium">{statusMessage}</p>
        {extraNote && (
          <p className="text-xs text-muted-foreground mt-2 border-t pt-2 border-primary/20">
            {extraNote}
          </p>
        )}
        {currentStep === 1 && elapsedMinutes < 8 && (
          <p className="text-xs text-muted-foreground mt-1">
            Estimated time remaining: {Math.max(0, Math.ceil(8 - elapsedMinutes))} minute(s)
          </p>
        )}
      </div>

      {showSupportButton && (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={mailtoLink}>
            <Mail className="h-4 w-4 mr-2" />
            Contact Support (dataplugstore@gmail.com)
          </a>
        </Button>
      )}
    </div>
  );
};

// ============================================================
// SPIN WHEEL POPUP – same logic, wheel enlarged
// ============================================================
interface SpinSegment {
  type: "gb" | "message" | "extra_spin";
  value: number | string;
  label: string;
  weight: number;
}

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
  onSpinComplete?: (wonGb?: number, phone?: string) => void;
}

const SpinWheelPopup = ({ open, onOpenChange, config, onSpinComplete }: SpinWheelPopupProps) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [spinCount, setSpinCount] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [result, setResult] = useState<{ prize: number | string; message: string } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [lastWinOrderId, setLastWinOrderId] = useState<string | null>(null);
  const [spinInterval, setSpinInterval] = useState<NodeJS.Timeout | null>(null);

  const selectedNetwork = config?.default_network || "mtn";

  useEffect(() => {
    if (open && phone) {
      const stored = localStorage.getItem(`spin_${phone}`);
      if (stored) setSpinCount(parseInt(stored, 10) || 0);
    }
  }, [open, phone]);

  useEffect(() => {
    if (phone && spinCount > 0) {
      localStorage.setItem(`spin_${phone}`, spinCount.toString());
    } else if (phone && spinCount === 0) {
      localStorage.removeItem(`spin_${phone}`);
    }
  }, [spinCount, phone]);

  useEffect(() => {
    if (open) {
      setPhone("");
      setSpinCount(0);
      setResult(null);
      setCurrentAngle(0);
      setPaymentRef(null);
      setLastWinOrderId(null);
      if (spinInterval) clearInterval(spinInterval);
      setSpinning(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (spinInterval) clearInterval(spinInterval);
    };
  }, [spinInterval]);

  useEffect(() => {
    const verifyPendingPayment = async () => {
      if (!config?.payment_required) return;
      const pendingRef = sessionStorage.getItem("pending_spin_payment");
      if (!pendingRef) return;
      setPaymentLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference: pendingRef },
        });
        if (error || !data?.success) {
          toast({ title: "Verification failed", description: "Payment not confirmed.", variant: "destructive" });
        } else if (data.grant_spins) {
          const newSpins = data.spins || 2;
          setSpinCount(newSpins);
          if (phone) localStorage.setItem(`spin_${phone}`, newSpins.toString());
          toast({ title: "Payment successful!", description: `You have ${newSpins} spins. Good luck!` });
          sessionStorage.removeItem("pending_spin_payment");
        } else {
          toast({ title: "Already used", description: "Payment already redeemed.", variant: "destructive" });
          sessionStorage.removeItem("pending_spin_payment");
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Could not verify payment", variant: "destructive" });
      } finally {
        setPaymentLoading(false);
      }
    };
    if (open) verifyPendingPayment();
  }, [open, config?.payment_required, toast, phone]);

  const isValidPhone = (num: string) => /^\d{10}$/.test(num);

  const handlePayment = async () => {
    if (!config?.payment_required) {
      const newSpins = 2;
      setSpinCount(newSpins);
      if (phone) localStorage.setItem(`spin_${phone}`, newSpins.toString());
      toast({ title: "Free spins!", description: "You have 2 spins. Good luck!" });
      return;
    }

    if (!isValidPhone(phone)) {
      toast({ title: "Invalid phone", description: "Enter exactly 10 digits", variant: "destructive" });
      return;
    }

    setPaymentLoading(true);
    try {
      const email = `player_${phone}@spin.dataplug.store`;
      const response = await supabase.functions.invoke("initiate-payment", {
        body: {
          amount: config.payment_amount,
          email,
          phone,
          callback_url: `${window.location.origin}/packages`,
          metadata: { type: "spin_wheel", phone, network: selectedNetwork },
        },
      });
      if (response.error) throw new Error(response.error.message);
      const { authorization_url, reference } = response.data;
      setPaymentRef(reference);
      sessionStorage.setItem("pending_spin_payment", reference);
      window.location.href = authorization_url;
    } catch (err: any) {
      console.error(err);
      toast({ title: "Payment error", description: err.message || "Could not initialise payment", variant: "destructive" });
    } finally {
      setPaymentLoading(false);
    }
  };

  const deliverPrize = async (sizeGb: number, phoneNumber: string): Promise<string | null> => {
    setDeliveryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-purchase", {
        body: {
          storeName: "cheap bundles",
          reference: "9795",
          network: selectedNetwork,
          sizeGb,
          phone: phoneNumber,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || "Delivery failed");
      toast({ title: "🎉 Data won!", description: `${sizeGb}GB will be delivered shortly. Use the tracking section above.` });
      return data.order_id || null;
    } catch (err) {
      console.error(err);
      toast({ title: "⚠️ Prize registered", description: `You won ${sizeGb}GB! It will be processed soon.`, variant: "default" });
      return null;
    } finally {
      setDeliveryLoading(false);
    }
  };

  const startSpin = () => {
    if (spinCount <= 0) {
      toast({ title: "No spins left", description: "Please get more spins.", variant: "destructive" });
      return;
    }
    if (spinning) return;
    if (!config?.segments?.length) {
      toast({ title: "Error", description: "Spin wheel not configured.", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setResult(null);

    const interval = setInterval(() => {
      setCurrentAngle(prev => prev + 10);
    }, 30);
    setSpinInterval(interval);

    setTimeout(() => {
      if (spinInterval) clearInterval(spinInterval);
      setSpinInterval(null);
      stopSpin();
    }, 30000);
  };

  const stopSpin = () => {
    if (!spinning) return;
    if (spinInterval) {
      clearInterval(spinInterval);
      setSpinInterval(null);
    }

    const segments = config!.segments;
    const totalWeight = segments.reduce((sum, s) => sum + (s.weight || 1), 0);
    let rand = Math.random() * totalWeight;
    let selectedIndex = 0;
    let cumulative = 0;
    for (let i = 0; i < segments.length; i++) {
      cumulative += segments[i].weight || 1;
      if (rand < cumulative) {
        selectedIndex = i;
        break;
      }
    }
    const selected = segments[selectedIndex];
    const prizeValue = selected.type === "gb" ? Number(selected.value) : 0;

    const segmentAngle = 360 / segments.length;
    const targetCenterAngle = selectedIndex * segmentAngle + segmentAngle / 2;
    const targetRotation = (360 - targetCenterAngle + 90) % 360;
    const fullTurns = 360 * 2;
    let delta = (targetRotation - currentAngle) % 360;
    if (delta < 0) delta += 360;
    const finalAngle = currentAngle + delta + fullTurns;

    setCurrentAngle(finalAngle);
    setSpinning(false);

    setTimeout(async () => {
      const newCount = spinCount - 1;
      setSpinCount(newCount);
      if (phone) localStorage.setItem(`spin_${phone}`, newCount.toString());

      if (selected.type === "extra_spin") {
        const extraCount = newCount + 1;
        setSpinCount(extraCount);
        if (phone) localStorage.setItem(`spin_${phone}`, extraCount.toString());
        setResult({ prize: 0, message: "🎁 Extra Spin! +1 spin added!" });
        toast({ title: "Extra spin!", description: "You earned an additional spin!", variant: "default" });
      } else if (selected.type === "gb" && prizeValue > 0) {
        setResult({ prize: prizeValue, message: `🎉 You won ${prizeValue} GB! 🎉` });
        const orderId = await deliverPrize(prizeValue, phone);
        if (orderId) setLastWinOrderId(orderId);
        toast({
          title: "Track your prize",
          description: `Enter ${phone} in "Track Your Order" above to see delivery status.`,
          duration: 8000,
        });
        onSpinComplete?.(prizeValue, phone);
      } else {
        setResult({ prize: 0, message: selected.label });
      }
    }, 2000);
  };

  if (!config) return null;

  const colors = ["#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40", "#8e5ea2", "#3cba9f", "#e8c3b9"];
  const segmentCount = config.segments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-sm border-white/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-white">🎡 Spin to Win Data 🎡</DialogTitle>
          <DialogDescription className="text-center text-gray-200">
            {config.payment_required ? `Pay ${config.payment_amount} GHS for 2 spins` : "Free spins! Get 2 spins now."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-center">
            <p className="text-sm text-gray-300 mb-1">Prize Network</p>
            <div className={`text-3xl font-bold ${networkConfig[selectedNetwork]?.color || "text-white"}`}>
              {networkConfig[selectedNetwork]?.label || selectedNetwork.toUpperCase()}
            </div>
          </div>

          <div>
            <Label className="text-white">Your phone number (10 digits)</Label>
            <Input
              placeholder="0599449202"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="bg-white/10 text-white border-white/20"
              disabled={spinCount > 0}
            />
          </div>

          {spinCount === 0 && (
            <Button
              onClick={handlePayment}
              disabled={paymentLoading || !isValidPhone(phone)}
              className="bg-green-600 hover:bg-green-700 w-full"
            >
              {paymentLoading ? <Loader2 className="animate-spin mr-2" /> : <Gift className="mr-2 h-4 w-4" />}
              {config.payment_required ? `Pay ${config.payment_amount} GHS for 2 Spins` : "Get 2 Free Spins"}
            </Button>
          )}

          {spinCount > 0 && (
            <div className="text-center">
              <Badge className="bg-yellow-500 text-black">Spins left: {spinCount}</Badge>
            </div>
          )}

          {/* WHEEL CONTAINER – ENLARGED from w-80 h-80 to w-96 h-96 */}
          <div className="relative flex justify-center">
            <div className="relative w-96 h-96">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full"
                style={{ transform: `rotate(${currentAngle}deg)`, transition: spinning ? "none" : "transform 2s cubic-bezier(0.2, 0.9, 0.4, 1)" }}
              >
                {config.segments.map((seg, i) => {
                  const start = (i * 360) / segmentCount;
                  const end = ((i + 1) * 360) / segmentCount;
                  const x1 = 50 + 40 * Math.cos((start * Math.PI) / 180);
                  const y1 = 50 + 40 * Math.sin((start * Math.PI) / 180);
                  const x2 = 50 + 40 * Math.cos((end * Math.PI) / 180);
                  const y2 = 50 + 40 * Math.sin((end * Math.PI) / 180);
                  const largeArc = end - start <= 180 ? 0 : 1;
                  const d = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                  const textAngle = start + (end - start) / 2;
                  const textX = 50 + 28 * Math.cos((textAngle * Math.PI) / 180);
                  const textY = 50 + 28 * Math.sin((textAngle * Math.PI) / 180);
                  let shortLabel = seg.label;
                  if (seg.type === "extra_spin") shortLabel = "+1 Spin";
                  else if (shortLabel.length > 8) shortLabel = shortLabel.slice(0, 6) + "..";
                  return (
                    <g key={i}>
                      <path d={d} fill={colors[i % colors.length]} stroke="white" strokeWidth="0.5" />
                      <text x={textX} y={textY - 6} textAnchor="middle" dominantBaseline="middle" fontSize="3" fill="white" fontWeight="bold">{i + 1}</text>
                      <text x={textX} y={textY + 4} textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fill="black" fontWeight="bold">{shortLabel}</text>
                    </g>
                  );
                })}
                <circle cx="50" cy="50" r="12" fill="white" stroke="#333" strokeWidth="1.5" />
              </svg>
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-red-600" />
            </div>
          </div>

          {spinCount > 0 && (
            <div className="flex gap-3">
              {!spinning ? (
                <Button onClick={startSpin} className="flex-1 bg-pink-600 hover:bg-pink-700">
                  🎲 SPIN
                </Button>
              ) : (
                <Button onClick={stopSpin} className="flex-1 bg-red-600 hover:bg-red-700">
                  ⏹️ STOP
                </Button>
              )}
            </div>
          )}

          {result && (
            <div className="text-center text-white font-bold text-lg bg-black/30 p-2 rounded">
              {result.message}
            </div>
          )}

          {deliveryLoading && (
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-white" />
              <span className="ml-2 text-white">Delivering...</span>
            </div>
          )}

          {lastWinOrderId && (
            <div className="text-center text-xs text-gray-300 bg-black/20 p-2 rounded">
              Track your win with order ID: {lastWinOrderId.slice(0, 8)}...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// MAIN PACKAGES COMPONENT
// ============================================================
const Packages = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(() => {
    const network = searchParams.get("network");
    return network === "mtn" || network === "airteltigo" || network === "telecel" ? network : "mtn";
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
    enabled: boolean;
    default_network: Network;
    payment_required: boolean;
    payment_amount: number;
    segments: SpinSegment[];
  } | null>(null);

  // Fetch spin configuration with robust logging
  useEffect(() => {
    const fetchSpinConfig = async () => {
      try {
        console.log("🔄 Fetching spin_config from Supabase...");
        const { data, error } = await supabase
          .from("spin_config")
          .select("enabled, default_network, payment_required, payment_amount, segments")
          .single();

        if (error) {
          console.error("❌ Error fetching spin_config:", error);
          setSpinConfig({
            enabled: false,
            default_network: "mtn",
            payment_required: true,
            payment_amount: 2,
            segments: [],
          });
          return;
        }

        console.log("✅ Spin config loaded:", data);
        setSpinConfig({
          enabled: data.enabled,
          default_network: data.default_network as Network,
          payment_required: data.payment_required,
          payment_amount: data.payment_amount,
          segments: data.segments as SpinSegment[],
        });
      } catch (err) {
        console.error("🔥 Unexpected error:", err);
        setSpinConfig({
          enabled: false,
          default_network: "mtn",
          payment_required: true,
          payment_amount: 2,
          segments: [],
        });
      }
    };
    fetchSpinConfig();
  }, []);

  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from("data_packages")
        .select("id, network, size_gb, price")
        .eq("active", true)
        .order("size_gb", { ascending: true });
      setPackages(data ?? []);
      setLoading(false);
    };
    fetchPackages();
  }, []);

  useEffect(() => {
    const network = searchParams.get("network");
    if (network === "mtn" || network === "airteltigo" || network === "telecel") {
      setSelectedNetwork(network);
    }
  }, [searchParams]);

  const filtered = useMemo(
    () => packages.filter((pkg) => pkg.network === selectedNetwork),
    [packages, selectedNetwork]
  );

  const handleBuyNow = (pkg: DataPackage) => {
    setPaymentPkg(pkg);
  };

  const searchOrders = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchPerformed(true);
    const trimmedQuery = searchQuery.trim();
    let query = supabase
      .from("orders")
      .select("id, customer_number, network, size_gb, amount, status, fulfillment_status, created_at");
    if (trimmedQuery.length === 36 && trimmedQuery.includes("-")) {
      query = query.eq("id", trimmedQuery);
    } else {
      query = query.ilike("customer_number", `%${trimmedQuery}%`);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      setOrders(data as Order[]);
    } else {
      setOrders([]);
    }
    setSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setOrders([]);
    setSearchPerformed(false);
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed" || status === "paid") return <CheckCircle className="h-4 w-4 text-green-400" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  const getStatusText = (status: string) => {
    if (status === "completed" || status === "paid") return "Payment Completed";
    if (status === "pending") return "Pending";
    return status;
  };

  const renderComingSoon = () => (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6">
        <Rocket className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon!</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        We're working hard to bring you this feature. Stay tuned for exciting updates!
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <NotificationPopup />
      <Navbar />
      <div className="container pt-24 pb-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-center mb-2">
          Our <span className="text-primary">Products</span>
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Choose a category and get connected instantly
        </p>



        {/* Category Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <Button
            variant={activeCategory === "data" ? "hero" : "outline"}
            onClick={() => setActiveCategory("data")}
            className="font-semibold"
          >
            <Wifi className="h-4 w-4 mr-2" />
            Data Bundles
          </Button>
          <Button
            variant={activeCategory === "afa" ? "hero" : "outline"}
            onClick={() => setActiveCategory("afa")}
            className="font-semibold"
          >
            <Package className="h-4 w-4 mr-2" />
            AFA Bundles
          </Button>
          <Button
            variant={activeCategory === "vouchers" ? "hero" : "outline"}
            onClick={() => setActiveCategory("vouchers")}
            className="font-semibold"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Vouchers
          </Button>
          <Button
            variant={activeCategory === "services" ? "hero" : "outline"}
            onClick={() => setActiveCategory("services")}
            className="font-semibold"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Internet Services
          </Button>
          {/* Spin Wheel Button - only show if enabled === true */}
          {spinConfig?.enabled === true && (
            <Button
              variant="hero"
              className="bg-gradient-to-r from-pink-600 to-orange-500 font-bold"
              onClick={() => setShowSpinWheel(true)}
            >
              <Gift className="h-4 w-4 mr-2" />
              Win Free Data – Spin {spinConfig.payment_required ? `(${spinConfig.payment_amount} GHS)` : "(Free)"}
            </Button>
          )}
        </div>

        {/* Rest of your component unchanged (order tracking, network filters, packages grid) */}
        {activeCategory === "data" ? (
          <>
            {/* Order Tracking Section */}
            <div className="max-w-4xl mx-auto mb-12">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex-1">
                      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-2">
                        <Package className="h-5 w-5 text-primary" />
                        Track Your Order
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Enter your phone number or order ID to check the status of your purchase.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <div className="flex-1 min-w-[200px]">
                        <Input
                          placeholder="Phone number or Order ID"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && searchOrders()}
                          className="bg-background"
                        />
                      </div>
                      <Button variant="hero" onClick={searchOrders} disabled={searching}>
                        {searching ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        ) : (
                          <Search className="h-4 w-4 mr-1" />
                        )}
                        Search
                      </Button>
                      {searchPerformed && (
                        <Button variant="outline" onClick={clearSearch} disabled={searching}>
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {searchPerformed && (
                    <div className="mt-6">
                      {searching ? (
                        <div className="text-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
                          <p className="text-muted-foreground">Searching for your order...</p>
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="text-center py-8 border border-border rounded-lg bg-background/50">
                          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">No orders found for "{searchQuery}".</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Please check your phone number or order ID and try again.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-foreground">Found {orders.length} order(s):</p>
                          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                            {orders.map((order) => (
                              <div
                                key={order.id}
                                className="flex flex-col p-4 border border-border rounded-lg bg-background/50 hover:bg-background transition-colors"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="font-mono text-xs">
                                        {order.id.slice(0, 8)}...
                                      </Badge>
                                      <span className="text-sm font-medium text-foreground">
                                        {order.customer_number}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="uppercase text-muted-foreground">{order.network}</span>
                                      <span className="font-display font-bold">{order.size_gb}GB</span>
                                      <span className="text-primary">GH₵ {Number(order.amount).toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(order.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(order.status)}
                                    <Badge
                                      className={
                                        order.status === "completed" || order.status === "paid"
                                          ? "bg-green-600/20 text-green-400 border-green-600/30"
                                          : order.status === "pending"
                                            ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                            : "bg-red-600/20 text-red-400 border-red-600/30"
                                      }
                                    >
                                      {getStatusText(order.status)}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="pt-3">
                                  <OrderTrackingCard order={order} toast={toast} />
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

            {/* Network Filter Buttons */}
            <div className="flex justify-center gap-3 mb-8">
              {(Object.keys(networkConfig) as Network[]).map((net) => (
                <Button
                  key={net}
                  variant={selectedNetwork === net ? "hero" : "outline"}
                  onClick={() => setSelectedNetwork(net)}
                  className="font-semibold"
                >
                  {networkConfig[net].label}
                </Button>
              ))}
            </div>

            {/* Packages Grid */}
            {loading ? (
              <div className="text-center text-muted-foreground">Loading packages...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filtered.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group"
                    style={{ background: "linear-gradient(135deg, #2d1b69 0%, #1a0a3e 100%)" }}
                  >
                    <CardContent className="p-4 text-center space-y-2">
                      <p className="text-3xl md:text-4xl font-bold text-white">{pkg.size_gb}GB</p>
                      <p className={`text-sm font-semibold uppercase tracking-wide ${networkConfig[selectedNetwork].color}`}>
                        {networkConfig[selectedNetwork].label}
                      </p>
                      <p className="text-xl font-bold text-white">GHC{Number(pkg.price).toFixed(2)}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium"
                        onClick={() => handleBuyNow(pkg)}
                      >
                        Buy Now
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          renderComingSoon()
        )}
      </div>

      {paymentPkg && (
        <PaymentDialog
          open={!!paymentPkg}
          onOpenChange={(v) => !v && setPaymentPkg(null)}
          packageName={`${paymentPkg.size_gb}GB`}
          network={selectedNetwork}
          price={Number(paymentPkg.price)}
          packageId={paymentPkg.id}
        />
      )}
      <PaymentVerifier />

      {/* Spin Wheel Popup */}
      <SpinWheelPopup
        open={showSpinWheel}
        onOpenChange={setShowSpinWheel}
        config={spinConfig}
        onSpinComplete={(wonGb, phoneNum) => {
          if (phoneNum) {
            setSearchQuery(phoneNum);
            setTimeout(() => searchOrders(), 500);
          }
        }}
      />

      {/* Floating WhatsApp Button – HIDDEN when spin wheel is open */}
      {!showSpinWheel && (
        <a
          href="https://whatsapp.com/channel/0029Vb6Yd9ALo4hZ2ikWCV1z"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#25D366",
            borderRadius: "30px",
            padding: "10px 15px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
            cursor: "pointer",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
            alt="Join WhatsApp Channel"
            style={{ width: "35px", height: "35px" }}
          />
          <span
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: "14px",
              whiteSpace: "nowrap",
            }}
          >
            Join channel – get updates & free giveaways
          </span>
        </a>
      )}
    </div>
  );
};

export default Packages;