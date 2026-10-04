# Paystack Transfer Integration Guide

## Overview
Replace the old `withdrawal_requests` system with Paystack transfers using:
- **Edge Function**: `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request`
- **Tables**: `transfer_recipients`, `payout_requests`
- **Recipient Types**: Bank Account, Mobile Money (MoMo)

---

## AGENT DASHBOARD CHANGES

### Step 1: Update handleWithdraw Function

**Location**: `AgentDashboard.tsx` line 1121

**Current Code**:
```typescript
const handleWithdraw = async () => {
  if (!store) return;
  if (hasPendingWithdrawal) { toast({ title: "Pending withdrawal exists", variant: "destructive" }); return; }
  const amt = parseFloat(withdrawAmount);
  if (!amt || amt < 10) { toast({ title: "Minimum is GH₵ 10.00", variant: "destructive" }); return; }
  
  const availableBalance = withdrawSource === "subagent_commission" 
    ? Number(store.subagent_commission_balance ?? 0) 
    : Number(store.wallet_balance ?? 0);
  
  if (amt > availableBalance) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
  setWithdrawLoading(true);
  const { error } = await supabase.from("withdrawal_requests").insert({ 
    agent_store_id: store.id, 
    amount: amt,
    withdrawal_source: withdrawSource
  });
  if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  else { toast({ title: "Withdrawal requested!" }); setWithdrawAmount(""); fetchAllData(); }
  setWithdrawLoading(false);
};
```

**Replace With**:
```typescript
const handleWithdraw = async () => {
  if (!store) return;
  if (hasPendingWithdrawal) { 
    toast({ title: "Pending withdrawal exists", variant: "destructive" }); 
    return; 
  }
  
  const amt = parseFloat(withdrawAmount);
  if (!amt || amt < 10) { 
    toast({ title: "Minimum is GH₵ 10.00", variant: "destructive" }); 
    return; 
  }
  
  const availableBalance = withdrawSource === "subagent_commission" 
    ? Number(store.subagent_commission_balance ?? 0) 
    : Number(store.wallet_balance ?? 0);
  
  if (amt > availableBalance) { 
    toast({ title: "Insufficient balance", variant: "destructive" }); 
    return; 
  }

  // Fetch recipients for this agent
  const { data: recipients } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("agent_store_id", store.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!recipients) {
    toast({ title: "No active recipient", description: "Add a recipient first", variant: "destructive" });
    return;
  }

  setWithdrawLoading(true);

  try {
    // Call edge function to initiate Paystack transfer
    const response = await fetch(
      "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          transfer_recipient_id: recipients.paystack_recipient_code,
          agent_store_id: store.id,
          subagent_store_id: null,
          withdrawal_source: withdrawSource,
          recipient_id: recipients.id,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Transfer initialization failed");
    }

    // Deduct from balance immediately
    const newBalance = availableBalance - amt;
    if (withdrawSource === "subagent_commission") {
      await supabase
        .from("agent_stores")
        .update({ subagent_commission_balance: newBalance })
        .eq("id", store.id);
    } else {
      await supabase
        .from("agent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", store.id);
    }

    toast({ title: "Withdrawal initiated!", description: `Transfer code: ${result.transfer_code}` });
    setWithdrawAmount("");
    fetchAllData();
  } catch (error: any) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  } finally {
    setWithdrawLoading(false);
  }
};
```

---

### Step 2: Add Recipient Management UI

**Add after the Withdraw section in AgentDashboard** (around line 2093):

```typescript
{activeTab === "withdraw" && (
  <Card className="border-border">
    <CardHeader>
      <CardTitle className="font-display text-lg">Manage Recipients</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Add a bank account or mobile money number for withdrawals.</p>
      
      {/* Show existing recipients */}
      {withdrawals.filter(r => r.recipient_type).length > 0 && (
        <div className="space-y-2">
          {withdrawals.map((recipient) => (
            <div key={recipient.id} className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
              <div>
                <p className="font-medium">{recipient.recipient_name}</p>
                <p className="text-xs text-muted-foreground">
                  {recipient.recipient_type === "bank" 
                    ? `${recipient.bank_name} - ${recipient.account_number}`
                    : `${recipient.momo_network} - ${recipient.momo_number}`}
                </p>
              </div>
              <Badge className="bg-green-600/20 text-green-400">Active</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Add new recipient form */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-medium">Add New Recipient</p>
        <div className="space-y-2">
          <Label>Recipient Type</Label>
          <select className="w-full border border-border rounded-lg p-2 bg-secondary">
            <option value="bank">Bank Account</option>
            <option value="momo">Mobile Money</option>
          </select>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

---

## SUBAGENT DASHBOARD CHANGES

### Step 1: Update handleWithdraw Function in SubagentDashboard

**Location**: `SubagentDashboard.tsx` around line 1123

Follow the same pattern as Agent Dashboard but use:
- `subagent_store_id` instead of `agent_store_id`
- Only `wallet_balance` (no commission balance for subagents)

```typescript
const handleWithdraw = async () => {
  if (!subagentStore) return;
  if (hasPendingWithdrawal) { 
    toast({ title: "Pending withdrawal exists", variant: "destructive" }); 
    return; 
  }
  
  const amt = parseFloat(withdrawAmount);
  if (!amt || amt < 10) { 
    toast({ title: "Minimum is GH₵ 10.00", variant: "destructive" }); 
    return; 
  }
  
  const availableBalance = Number(subagentStore.wallet_balance ?? 0);
  
  if (amt > availableBalance) { 
    toast({ title: "Insufficient balance", variant: "destructive" }); 
    return; 
  }

  // Fetch recipients
  const { data: recipients } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("subagent_store_id", subagentStore.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!recipients) {
    toast({ title: "No active recipient", description: "Add a recipient first", variant: "destructive" });
    return;
  }

  setWithdrawLoading(true);

  try {
    const response = await fetch(
      "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          transfer_recipient_id: recipients.paystack_recipient_code,
          agent_store_id: null,
          subagent_store_id: subagentStore.id,
          withdrawal_source: "wallet",
          recipient_id: recipients.id,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Transfer initialization failed");
    }

    // Deduct from balance
    const newBalance = availableBalance - amt;
    await supabase
      .from("subagent_stores")
      .update({ wallet_balance: newBalance })
      .eq("id", subagentStore.id);

    toast({ title: "Withdrawal initiated!", description: `Transfer code: ${result.transfer_code}` });
    setWithdrawAmount("");
    fetchAllData();
  } catch (error: any) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  } finally {
    setWithdrawLoading(false);
  }
};
```

---

## Database Tables Required

### `transfer_recipients` table
```sql
CREATE TABLE transfer_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID REFERENCES agent_stores(id) ON DELETE CASCADE,
  subagent_store_id UUID REFERENCES subagent_stores(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_type TEXT NOT NULL, -- 'bank' or 'momo'
  
  -- Bank fields
  bank_code TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  
  -- MoMo fields
  momo_network TEXT, -- 'MTN', 'VODAFONE', 'AIRTELTIGO'
  momo_number TEXT,
  
  -- Paystack fields
  paystack_recipient_code TEXT UNIQUE NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT one_store CHECK (
    (agent_store_id IS NOT NULL AND subagent_store_id IS NULL) OR
    (agent_store_id IS NULL AND subagent_store_id IS NOT NULL)
  )
);
```

### `payout_requests` table
```sql
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
  subagent_store_id UUID REFERENCES subagent_stores(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES transfer_recipients(id) ON DELETE SET NULL,
  
  amount DECIMAL(10, 2) NOT NULL,
  withdrawal_source TEXT, -- 'wallet' or 'subagent_commission'
  
  transfer_code TEXT UNIQUE,
  paystack_transfer_id BIGINT,
  paystack_recipient_code TEXT,
  
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);
```

---

## Key Changes Summary

| Aspect | Old System | New System |
|--------|-----------|-----------|
| **Table** | `withdrawal_requests` | `payout_requests` + `transfer_recipients` |
| **Initiation** | Direct DB insert | Call edge function |
| **Balance Deduction** | Manual after success | Automatic (edge function handles) |
| **Recipient Setup** | MoMo from store settings | Flexible recipients table |
| **Processing** | Manual admin | Automated Paystack API |
| **Webhook** | None | Paystack webhook confirms |

---

## Testing Checklist

- [ ] Agent can add recipient (bank or MoMo)
- [ ] Agent can request withdrawal with active recipient
- [ ] Balance deducts immediately
- [ ] Paystack transfer completes successfully
- [ ] Payout request shows in history
- [ ] Same for Subagent
- [ ] Failed transfer refunds balance
- [ ] Cannot withdraw without active recipient
- [ ] Minimum GH₵ 10 enforced
