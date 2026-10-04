"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface AddRecipientFormProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const BANK_CODES: Record<string, string> = {
  "123": "GCB Bank",
  "026": "Zenith Bank",
  "050": "EcoBank",
  "058": "Guaranty Trust Bank",
  "999": "Other Bank",
};

const MOBILE_MONEY_NETWORKS = ["mtn", "telecel", "airteltigo"];

export default function AddRecipientForm({ token, onSuccess, onCancel }: AddRecipientFormProps) {
  const [providerType, setProviderType] = useState<"bank" | "mobile_money">("bank");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankCode, setBankCode] = useState("123");
  const [bankName, setBankName] = useState("GCB Bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [mobileNetwork, setMobileNetwork] = useState("mtn");
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);

      if (!accountHolder.trim()) {
        throw new Error("Account holder name is required");
      }

      let payload: Record<string, any> = {
        requester_type: "agent", // Will be determined by backend based on auth
        requester_id: "will-be-filled", // Placeholder
        amount: 0, // Not needed for recipient creation
        withdrawal_source: "wallet_balance",
        recipient_details: {
          account_holder_name: accountHolder,
          provider_type: providerType,
        },
      };

      if (providerType === "bank") {
        if (!accountNumber.trim() || accountNumber.length < 10) {
          throw new Error("Valid account number is required (10+ digits)");
        }
        payload.recipient_details = {
          ...payload.recipient_details,
          bank_name: bankName,
          bank_code: bankCode,
          account_number: accountNumber,
        };
      } else {
        if (!mobileNumber.trim() || mobileNumber.length < 9) {
          throw new Error("Valid mobile number is required");
        }
        payload.recipient_details = {
          ...payload.recipient_details,
          mobile_money_network: mobileNetwork,
          mobile_money_number: mobileNumber,
        };
      }

      const response = await fetch("https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create recipient");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Recipient</CardTitle>
      </CardHeader>
      <CardContent className="pb-20">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Recipient Type</Label>
            <Select value={providerType} onValueChange={(v) => setProviderType(v as "bank" | "mobile_money")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Account</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="holder">Account Holder Name</Label>
            <Input
              id="holder"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Full name"
              disabled={loading}
            />
          </div>

          {providerType === "bank" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="bank">Bank</Label>
                <Select value={bankCode} onValueChange={(v) => {
                  setBankCode(v);
                  setBankName(BANK_CODES[v] || "Other Bank");
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BANK_CODES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account">Account Number</Label>
                <Input
                  id="account"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-16 digit account number"
                  disabled={loading}
                  maxLength={16}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Mobile Money Network</Label>
                <Select value={mobileNetwork} onValueChange={setMobileNetwork}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOBILE_MONEY_NETWORKS.map((network) => (
                      <SelectItem key={network} value={network}>
                        {network.charAt(0).toUpperCase() + network.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="024XXXXXXX or similar"
                  disabled={loading}
                  maxLength={12}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="sticky bottom-0 -mx-6 -mb-6 bg-slate-950 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={loading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button disabled={loading} type="submit" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? "Saving..." : "Save Recipient"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
