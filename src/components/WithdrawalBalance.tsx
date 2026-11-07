"use client";

import { useEffect, useState } from "react";
import { getAgentBalance, getSubagentBalance, Balance } from "@/lib/withdrawal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface WithdrawalBalanceProps {
  userRole: string;
  storeId: string;
  refreshKey: number;
}

export default function WithdrawalBalance({ userRole, storeId, refreshKey }: WithdrawalBalanceProps) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        let data;

        if (userRole === "agent") {
          data = await getAgentBalance(storeId);
        } else if (userRole === "subagent") {
          data = await getSubagentBalance(storeId);
        } else {
          throw new Error("Invalid user role");
        }

        setBalance(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load balance");
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [userRole, storeId, refreshKey]);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-600">Wallet Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-slate-900">
            GHS {(balance?.wallet_balance || 0).toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Available for withdrawal</p>
        </CardContent>
      </Card>

      {userRole === "agent" && balance?.subagent_commission_balance !== undefined && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Commission Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              GHS {(balance.subagent_commission_balance || 0).toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">From subagent sales</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
