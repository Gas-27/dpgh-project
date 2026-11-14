"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import WithdrawalBalance from "@/components/WithdrawalBalance";
import RecipientManager from "@/components/RecipientManager";
import WithdrawalForm from "@/components/WithdrawalForm";
import PayoutHistory from "@/components/PayoutHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WithdrawalsPage() {
  const { user, userRole, storeId, session } = useAuth();
  const [activeTab, setActiveTab] = useState("withdraw");
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user || !storeId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please log in to access withdrawals.</p>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Withdrawals</h1>
          <p className="text-slate-600">Manage your payouts and transfer recipients</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="withdraw">Request Withdrawal</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
            <TabsTrigger value="history">Payout History</TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="space-y-6">
            <WithdrawalBalance
              userRole={userRole as string}
              storeId={storeId}
              refreshKey={refreshKey}
            />
            <WithdrawalForm
              userRole={userRole as string}
              storeId={storeId}
              token={session?.access_token || ""}
              onSuccess={handleRefresh}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="recipients">
            <RecipientManager
              token={session?.access_token || ""}
              onRefresh={handleRefresh}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="history">
            <PayoutHistory
              userRole={userRole as string}
              storeId={storeId}
              refreshKey={refreshKey}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
