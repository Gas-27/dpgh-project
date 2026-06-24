"use client";

import { useEffect, useState } from "react";
import { getTransferRecipients, getAgentBalance, getSubagentBalance, createPayoutRequest, TransferRecipient, Balance } from "@/lib/withdrawal";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface WithdrawalFormProps {
  userRole: string;
  storeId: string;
  token: string;
  onSuccess: () => void;
  refreshKey: number;
}

export default function WithdrawalForm({
  userRole,
  storeId,
  token,
  onSuccess,
  refreshKey,
}: WithdrawalFormProps) {
  const [recipients, setRecipients] = useState<TransferRecipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [withdrawalSource, setWithdrawalSource] = useState("wallet_balance");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load recipients
        const recipsData = await getTransferRecipients();
        setRecipients(recipsData);
        if (recipsData.length > 0) {
          setSelectedRecipient(recipsData[0].id);
        }

        // Load balance
        let balanceData;
        if (userRole === "agent") {
          balanceData = await getAgentBalance(storeId);
        } else if (userRole === "subagent") {
          balanceData = await getSubagentBalance(storeId);
          setWithdrawalSource("wallet_balance"); // Subagents only have wallet_balance
        } else {
          throw new Error("Invalid user role");
        }
        setBalance(balanceData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userRole, storeId, refreshKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!selectedRecipient) {
        throw new Error("Please select a recipient");
      }

      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const availableBalance = withdrawalSource === "wallet_balance"
        ? balance?.wallet_balance || 0
        : balance?.subagent_commission_balance || 0;

      if (amountNum > availableBalance) {
        throw new Error(`Insufficient balance. Available: GHS ${availableBalance.toFixed(2)}`);
      }

      setSubmitting(true);

      const payload = {
        requester_type: userRole as "agent" | "subagent",
        requester_id: storeId,
        withdrawal_source: withdrawalSource,
        amount: amountNum,
        recipient_id: selectedRecipient,
      };

      const result = await createPayoutRequest(token, payload);

      if (!result.success) {
        throw new Error(result.error || "Payout request failed");
      }

      setSuccess(result);
      setAmount("");
      onSuccess();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-40">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (recipients.length === 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <p className="text-yellow-700">
            Please add a transfer recipient in the Recipients tab before requesting a withdrawal.
          </p>
        </CardContent>
      </Card>
    );
  }

  const availableBalance = withdrawalSource === "wallet_balance"
    ? balance?.wallet_balance || 0
    : balance?.subagent_commission_balance || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Withdrawal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="recipient">Transfer Recipient</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient} disabled={submitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((recipient) => (
                  <SelectItem key={recipient.id} value={recipient.id}>
                    {recipient.account_holder_name} ({recipient.bank_name || recipient.mobile_money_network})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {userRole === "agent" && (
            <div className="space-y-2">
              <Label htmlFor="source">Withdraw From</Label>
              <Select value={withdrawalSource} onValueChange={setWithdrawalSource} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet_balance">
                    Wallet Balance (GHS {(balance?.wallet_balance || 0).toFixed(2)})
                  </SelectItem>
                  <SelectItem value="subagent_commission_balance">
                    Commission Balance (GHS {(balance?.subagent_commission_balance || 0).toFixed(2)})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (GHS)</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={submitting}
                className="pl-8"
              />
              <span className="absolute left-3 top-3 text-slate-500">₵</span>
            </div>
            <p className="text-xs text-slate-500">
              Available: GHS {availableBalance.toFixed(2)}
            </p>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-600">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                ✓ {success.message} • Transfer Code: {success.transfer_code}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={submitting || !amount}
            className="w-full"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? "Processing..." : "Request Withdrawal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
