import { normalizePhone, isValidPhone } from "@/lib/phoneUtils";

export function normalizeApprovalNumber(value: string) {
  return normalizePhone(value);
}

export function validateApprovalNumber(value: string) {
  const normalized = normalizeApprovalNumber(value);
  if (!isValidPhone(normalized) || normalized.length !== 10) {
    return { normalized, error: "Enter a valid 10-digit Ghana number, for example 0242206542." };
  }
  return { normalized, error: null };
}

export function formatApprovalNumber(value: string) {
  const normalized = normalizeApprovalNumber(value);
  return normalized.length === 10
    ? `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`
    : normalized;
}
