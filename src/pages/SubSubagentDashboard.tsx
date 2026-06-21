'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SubagentStore {
  id: string;
  store_name: string;
  user_id: string;
  subagent_store_id: string;
  created_at: string;
  whatsapp_number?: string;
  support_number?: string;
  whatsapp_group?: string;
  momo_number?: string;
  momo_name?: string;
  momo_network?: string;
  wallet_balance?: number;
  [key: string]: any;
}

export default function SubSubagentDashboard() {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const [store, setStore] = useState<SubagentStore | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storeId = searchParams.get("store_id");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let storeData: SubagentStore | null = null;

      if (storeId) {
        // Admin impersonation
        console.log("[v0] Fetching store with ID:", storeId);
        const { data: result, error: err } = await supabase
          .from("sub_subagent_stores")
          .select("*")
          .eq("id", storeId)
          .single();

        if (err || !result) {
          console.error("[v0] Error fetching store:", err);
          setError("Store not found. Please check the store ID and try again.");
          setLoading(false);
          return;
        }
        storeData = result;
      } else {
        // Regular user - fetch their store
        if (!user?.id) {
          setError("Please log in to access your dashboard.");
          setLoading(false);
          return;
        }

        console.log("[v0] Fetching store for user:", user.id);
        const { data: result, error: err } = await supabase
          .from("sub_subagent_stores")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (err || !result) {
          console.error("[v0] Error fetching store:", err);
          setError("No store found for your account. Please complete registration first.");
          setLoading(false);
          return;
        }
        storeData = result;
      }

      setStore(storeData);

      // Fetch orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .eq("sub_subagent_store_id", storeData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!ordersErr && ordersData) {
        setOrders(ordersData);
      }

      setLoading(false);
    } catch (err) {
      console.error("[v0] Error loading dashboard:", err);
      setError("An error occurred while loading your dashboard.");
      setLoading(false);
    }
  }, [user?.id, storeId]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6 mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-bold text-lg mb-2">Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => navigate("/sub-subagent-login")}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6 mt-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">Store information not available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Store Header */}
        <div className="bg-card border border-border rounded-lg p-8 mb-8">
          <h1 className="text-4xl font-bold mb-2">{store.store_name}</h1>
          <p className="text-muted-foreground">Sub-Subagent Dashboard</p>
        </div>

        {/* Store Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Store ID</h3>
            <p className="text-lg font-mono text-foreground">{store.id}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Parent Agent Store</h3>
            <p className="text-lg font-mono text-foreground">{store.subagent_store_id}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Created</h3>
            <p className="text-lg text-foreground">{new Date(store.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Contact Information</h2>
            {store.whatsapp_number && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="text-foreground font-mono">{store.whatsapp_number}</p>
              </div>
            )}
            {store.support_number && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">Support Number</p>
                <p className="text-foreground font-mono">{store.support_number}</p>
              </div>
            )}
            {store.whatsapp_group && (
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp Group</p>
                <p className="text-foreground">{store.whatsapp_group}</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Payment Methods</h2>
            {store.momo_name && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">MoMo Account Name</p>
                <p className="text-foreground">{store.momo_name}</p>
              </div>
            )}
            {store.momo_number && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">MoMo Number</p>
                <p className="text-foreground font-mono">{store.momo_number}</p>
              </div>
            )}
            {store.momo_network && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">MoMo Network</p>
                <p className="text-foreground">{store.momo_network}</p>
              </div>
            )}
            {store.wallet_balance !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                <p className="text-lg font-bold text-primary">{store.wallet_balance?.toLocaleString() || '0'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Recent Orders</h2>
          
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold">Order ID</th>
                    <th className="text-left py-3 px-4 font-semibold">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-xs">{order.id?.substring(0, 8)}...</td>
                      <td className="py-3 px-4">${Number(order.order_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
