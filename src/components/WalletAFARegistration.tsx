'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { GHANA_REGIONS } from '@/lib/ghanaRegions';
import { Loader2, Wallet } from 'lucide-react';
import AFAHistory from '@/components/AFAHistory';

export type AFAStoreKind = 'agent' | 'subagent' | 'subsubagent';

interface WalletAFARegistrationProps {
  kind: AFAStoreKind;
  storeId: string;
  walletBalance: number;
  onSuccess?: () => void;
}

const emptyForm = {
  customer_name: '',
  customer_phone: '',
  customer_id: '',
  date_of_birth: '',
  town: '',
  occupation: '',
  region: '',
  crop: '',
};

export default function WalletAFARegistration({ kind, storeId, walletBalance, onSuccess }: WalletAFARegistrationProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [price, setPrice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('afa_wallet_price' as any, { p_kind: kind, p_store_id: storeId }).then(({ data }) => {
      if (!cancelled && data !== null && data !== undefined) setPrice(Number(data));
    });
    return () => {
      cancelled = true;
    };
  }, [kind, storeId, historyKey]);

  const update = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^0\d{9}$/.test(form.customer_phone)) {
      toast({ title: 'Invalid phone number', description: 'Enter a 10-digit number starting with 0.', variant: 'destructive' });
      return;
    }
    if (!form.customer_name.trim() || !form.customer_id.trim()) {
      toast({ title: 'Missing details', description: 'Name and Ghana card number are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('register_afa_from_wallet' as any, {
      p_kind: kind,
      p_store_id: storeId,
      p_customer_name: form.customer_name,
      p_customer_phone: form.customer_phone,
      p_customer_id: form.customer_id,
      p_date_of_birth: form.date_of_birth || null,
      p_town: form.town,
      p_occupation: form.occupation,
      p_region: form.region,
      p_crop: form.crop,
    });
    setSubmitting(false);

    const result = data as { success?: boolean; message?: string } | null;
    if (error || !result?.success) {
      toast({
        title: 'Registration failed',
        description: result?.message || 'Something went wrong. Your wallet was not charged.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'AFA registration submitted', description: `GHC ${price?.toFixed(2) ?? ''} deducted from your wallet.` });
    setForm(emptyForm);
    setHistoryKey((k) => k + 1);
    onSuccess?.();
  };

  const insufficient = price !== null && walletBalance < price;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Register for AFA from your wallet</CardTitle>
          <CardDescription>The registration fee is deducted from your wallet balance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              Wallet balance: <span className="font-semibold">GHC {walletBalance.toFixed(2)}</span>
            </div>
            <div className="text-sm">
              Registration fee: <span className="font-semibold">{price === null ? '...' : `GHC ${price.toFixed(2)}`}</span>
            </div>
          </div>

          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="afa-name">Full name</Label>
              <Input id="afa-name" value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-phone">Phone number</Label>
              <Input
                id="afa-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="0XXXXXXXXX"
                value={form.customer_phone}
                onChange={(e) => update('customer_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-card">Ghana card number</Label>
              <Input id="afa-card" placeholder="GHA-XXXXXXXXX-X" value={form.customer_id} onChange={(e) => update('customer_id', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-dob">Date of birth</Label>
              <Input id="afa-dob" type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-region">Region</Label>
              <select
                id="afa-region"
                value={form.region}
                onChange={(e) => update('region', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select region</option>
                {GHANA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-town">Town</Label>
              <Input id="afa-town" value={form.town} onChange={(e) => update('town', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-occ">Occupation</Label>
              <Input id="afa-occ" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="afa-crop">Crop produce</Label>
              <Input id="afa-crop" value={form.crop} onChange={(e) => update('crop', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              {insufficient && (
                <p className="mb-2 text-sm text-destructive">Your wallet balance is lower than the registration fee. Top up to continue.</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting || insufficient}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {price === null ? 'Register' : `Register for GHC ${price.toFixed(2)}`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AFAHistory refreshKey={historyKey} />
    </div>
  );
}
