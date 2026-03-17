import { Zap, Clock, Shield, CheckCircle } from "lucide-react";

const items = [
  { icon: Zap, text: "Instant Delivery" },
  { icon: Clock, text: "24/7 Available" },
  { icon: Shield, text: "Secure Payments" },
  { icon: CheckCircle, text: "99.9% Uptime" },
  { icon: Zap, text: "Instant Delivery" },
  { icon: Clock, text: "24/7 Available" },
  { icon: Shield, text: "Secure Payments" },
  { icon: CheckCircle, text: "99.9% Uptime" },
];

const TrustTicker = () => {
  return (
    <div className="border-y border-border bg-card/50 py-4 overflow-hidden">
      <div className="flex animate-scroll-left gap-8 w-max">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-muted-foreground whitespace-nowrap">
            <item.icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustTicker;
