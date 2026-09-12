import { detectNetwork, getNetworkInfo, isValidPhoneLength } from "@/lib/phoneUtils";

interface NetworkIndicatorProps {
  phone: string;
  showOnlyWhenValid?: boolean;
}

export default function NetworkIndicator({ phone, showOnlyWhenValid = false }: NetworkIndicatorProps) {
  const network = detectNetwork(phone);
  const info = getNetworkInfo(network);
  const hasValidLength = isValidPhoneLength(phone);
  
  // Don't show if phone is too short (less than 3 digits for prefix detection)
  if (phone.replace(/\D/g, "").length < 3) return null;
  
  // If showOnlyWhenValid is true, only show when we have 10 digits
  if (showOnlyWhenValid && !hasValidLength) return null;
  
  if (network === "unknown") {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-gray-400">Invalid prefix</span>
      </div>
    );
  }
  
  return (
    <div className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full ${info.bgColor} border ${info.borderColor}`}>
      <div className={`w-2 h-2 rounded-full ${network === "mtn" ? "bg-yellow-400" : network === "telecel" ? "bg-red-400" : "bg-blue-400"}`} />
      <span className={`text-xs font-medium ${info.color}`}>{info.name}</span>
    </div>
  );
}
