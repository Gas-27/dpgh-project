"use client";

import { useEffect, useState } from "react";
import { getTransferRecipients, TransferRecipient, deactivateRecipient } from "@/lib/withdrawal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, ChevronDown } from "lucide-react";
import AddRecipientForm from "@/components/AddRecipientForm";

interface RecipientManagerProps {
  token: string;
  onRefresh: () => void;
  refreshKey: number;
}

export default function RecipientManager({ token, onRefresh, refreshKey }: RecipientManagerProps) {
  const [recipients, setRecipients] = useState<TransferRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getTransferRecipients();
        setRecipients(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load recipients");
      } finally {
        setLoading(false);
      }
    };

    fetchRecipients();
  }, [refreshKey]);

  const handleDelete = async (recipientId: string) => {
    if (!confirm("Are you sure you want to remove this recipient?")) return;

    try {
      setDeleting(recipientId);
      await deactivateRecipient(recipientId);
      setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete recipient");
    } finally {
      setDeleting(null);
    }
  };

  const formatBankRecipient = (r: TransferRecipient) => (
    <div className="space-y-1">
      <p className="font-medium text-slate-900">{r.account_holder_name}</p>
      <p className="text-sm text-slate-600">{r.bank_name}</p>
      <p className="text-xs text-slate-500">Account: {r.account_number}</p>
    </div>
  );

  const formatMobileMoneyRecipient = (r: TransferRecipient) => (
    <div className="space-y-1">
      <p className="font-medium text-slate-900">{r.account_holder_name}</p>
      <p className="text-sm text-slate-600 capitalize">{r.mobile_money_network} Money</p>
      <p className="text-xs text-slate-500">Number: {r.mobile_money_number}</p>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-40">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Transfer Recipients</h2>
        {recipients.length < 2 && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Recipient
          </Button>
        )}
      </div>

      {showForm && (
        <AddRecipientForm
          token={token}
          onSuccess={() => {
            setShowForm(false);
            onRefresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {recipients.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-slate-600">
            <p>No recipients added yet. Add one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recipients.map((recipient) => (
            <Card key={recipient.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex-1">
                  {recipient.provider_type === "bank"
                    ? formatBankRecipient(recipient)
                    : formatMobileMoneyRecipient(recipient)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(recipient.id)}
                  disabled={deleting === recipient.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deleting === recipient.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recipients.length >= 2 && (
        <p className="text-xs text-slate-500 text-center">
          Maximum 2 recipients allowed. Remove one to add another.
        </p>
      )}
    </div>
  );
}
