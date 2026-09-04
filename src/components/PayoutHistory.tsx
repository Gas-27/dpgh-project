"use client";

import { useEffect, useState } from "react";
import { getPayoutHistory, PayoutRequest } from "@/lib/withdrawal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface PayoutHistoryProps {
  userRole: string;
  storeId: string;
  refreshKey: number;
}

export default function PayoutHistory({ userRole, storeId, refreshKey }: PayoutHistoryProps) {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPayoutHistory(userRole, storeId);
        setPayouts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [userRole, storeId, refreshKey]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "processing":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200";
      case "processing":
        return "bg-blue-50 border-blue-200";
      case "failed":
        return "bg-red-50 border-red-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const formatRecipient = (payout: PayoutRequest) => {
    const recipient = payout.transfer_recipients;
    if (recipient.provider_type === "bank") {
      return `${recipient.account_holder_name} • ${recipient.bank_name}`;
    } else {
      return `${recipient.account_holder_name} • ${recipient.mobile_money_network?.toUpperCase()}`;
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

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (payouts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-slate-600">
          <p>No payout requests yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {payouts.map((payout) => (
        <Card key={payout.id} className={`border-2 ${getStatusColor(payout.status)}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  {getStatusIcon(payout.status)}
                  <div>
                    <p className="font-semibold text-slate-900">GHS {payout.amount.toFixed(2)}</p>
                    <p className="text-sm text-slate-600 capitalize">{payout.status}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-700">{formatRecipient(payout)}</p>
                {payout.failure_reason && (
                  <p className="text-sm text-red-600">Reason: {payout.failure_reason}</p>
                )}
                <p className="text-xs text-slate-500">
                  {format(new Date(payout.created_at), "PPp")}
                </p>
              </div>

              <div className="text-right space-y-2 text-sm">
                {payout.transfer_code && (
                  <div>
                    <p className="text-xs text-slate-500">Transfer Code</p>
                    <p className="font-mono text-slate-900">{payout.transfer_code}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500">Balance After</p>
                  <p className="font-semibold text-slate-900">GHS {payout.source_balance_after.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
