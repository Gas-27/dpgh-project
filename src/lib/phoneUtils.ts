// Phone number utilities for network detection and validation

export type NetworkType = "mtn" | "mtn_express" | "telecel" | "airteltigo" | "unknown";

// Network prefixes
const MTN_PREFIXES = ["024", "025", "053", "054", "055", "059"];
const TELECEL_PREFIXES = ["020", "050"];
const AIRTELTIGO_PREFIXES = ["026", "027", "056", "057"];

/**
 * Normalize phone number to 10-digit format starting with 0
 */
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return "0" + digits.slice(3);
  }
  if (digits.length === 9 && !digits.startsWith("0")) {
    return "0" + digits;
  }
  return digits;
};

/**
 * Detect network from phone number prefix
 */
export const detectNetwork = (phone: string): NetworkType => {
  const normalized = normalizePhone(phone);
  if (normalized.length < 3) return "unknown";
  
  const prefix = normalized.substring(0, 3);
  
  if (MTN_PREFIXES.includes(prefix)) return "mtn";
  if (TELECEL_PREFIXES.includes(prefix)) return "telecel";
  if (AIRTELTIGO_PREFIXES.includes(prefix)) return "airteltigo";
  
  return "unknown";
};

/**
 * Get network display info
 */
export const getNetworkInfo = (network: NetworkType): { 
  name: string; 
  color: string; 
  bgColor: string; 
  borderColor: string;
} => {
  switch (network) {
    case "mtn":
      return { 
        name: "MTN", 
        color: "text-yellow-400", 
        bgColor: "bg-yellow-500/20", 
        borderColor: "border-yellow-500/50" 
      };
    case "telecel":
      return { 
        name: "Telecel", 
        color: "text-red-400", 
        bgColor: "bg-red-500/20", 
        borderColor: "border-red-500/50" 
      };
    case "airteltigo":
      return { 
        name: "AirtelTigo", 
        color: "text-blue-400", 
        bgColor: "bg-blue-500/20", 
        borderColor: "border-blue-500/50" 
      };
    default:
      return { 
        name: "Unknown", 
        color: "text-gray-400", 
        bgColor: "bg-gray-500/20", 
        borderColor: "border-gray-500/50" 
      };
  }
};

/**
 * Check if phone number matches expected network
 */
export const phoneMatchesNetwork = (phone: string, expectedNetwork: string): boolean => {
  const detectedNetwork = detectNetwork(phone);
  if (detectedNetwork === "unknown") return true; // Don't block if we can't detect
  
  const normalizedExpected = expectedNetwork.toLowerCase();
  
  // Handle variations of network names
  if (normalizedExpected === "at" || normalizedExpected === "airtel-tigo") {
    return detectedNetwork === "airteltigo";
  }
  
  // MTN numbers work for both MTN and MTN Express
  if (normalizedExpected === "mtn_express") {
    return detectedNetwork === "mtn";
  }
  
  return detectedNetwork === normalizedExpected;
};

/**
 * Validate phone number is exactly 10 digits
 */
export const isValidPhoneLength = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  return normalized.length === 10;
};

/**
 * Validate phone number format (starts with valid prefix)
 */
export const isValidPhone = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  return /^0[235]\d{8}$/.test(normalized);
};

/**
 * Get all valid prefixes for a network
 */
export const getPrefixesForNetwork = (network: string): string[] => {
  const normalizedNetwork = network.toLowerCase();
  
  if (normalizedNetwork === "mtn" || normalizedNetwork === "mtn_express") return MTN_PREFIXES;
  if (normalizedNetwork === "telecel") return TELECEL_PREFIXES;
  if (normalizedNetwork === "airteltigo" || normalizedNetwork === "at" || normalizedNetwork === "airtel-tigo") {
    return AIRTELTIGO_PREFIXES;
  }
  
  return [];
};
