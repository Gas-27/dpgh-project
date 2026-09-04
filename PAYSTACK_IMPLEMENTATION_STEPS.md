# Paystack Transfer Implementation - Step by Step

## PART 1: DATABASE SETUP

### Step 1: Create Required Tables in Supabase

Go to your Supabase dashboard → SQL Editor and run these queries:

```sql
-- 1. Create transfer_recipients table
CREATE TABLE transfer_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID REFERENCES agent_stores(id) ON DELETE CASCADE,
  subagent_store_id UUID REFERENCES subagent_stores(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('bank', 'momo')),
  
  -- Bank fields
  bank_code TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  
  -- MoMo fields
  momo_network TEXT CHECK (momo_network IN ('MTN', 'VODAFONE', 'AIRTELTIGO')),
  momo_number TEXT,
  
  -- Paystack fields
  paystack_recipient_code TEXT UNIQUE NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT one_store CHECK (
    (agent_store_id IS NOT NULL AND subagent_store_id IS NULL) OR
    (agent_store_id IS NULL AND subagent_store_id IS NOT NULL)
  )
);

CREATE INDEX idx_transfer_recipients_agent ON transfer_recipients(agent_store_id);
CREATE INDEX idx_transfer_recipients_subagent ON transfer_recipients(subagent_store_id);

-- 2. Create payout_requests table
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_store_id UUID REFERENCES agent_stores(id) ON DELETE SET NULL,
  subagent_store_id UUID REFERENCES subagent_stores(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES transfer_recipients(id) ON DELETE SET NULL,
  
  amount DECIMAL(10, 2) NOT NULL,
  withdrawal_source TEXT DEFAULT 'wallet' CHECK (withdrawal_source IN ('wallet', 'subagent_commission')),
  
  transfer_code TEXT UNIQUE,
  paystack_transfer_id BIGINT,
  paystack_recipient_code TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  
  CONSTRAINT one_store CHECK (
    (agent_store_id IS NOT NULL AND subagent_store_id IS NULL) OR
    (agent_store_id IS NULL AND subagent_store_id IS NOT NULL)
  )
);

CREATE INDEX idx_payout_requests_agent ON payout_requests(agent_store_id);
CREATE INDEX idx_payout_requests_subagent ON payout_requests(subagent_store_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
```

---

## PART 2: AGENT DASHBOARD CHANGES

### Step 2: Update AgentDashboard.tsx - handleWithdraw Function

**File**: `src/pages/AgentDashboard.tsx`

**Find line 1121** (search for `const handleWithdraw = async () => {`)

**Replace the entire function with**:

```typescript
const handleWithdraw = async () => {
  if (!store) return;
  
  // Check for pending withdrawals
  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");
  if (hasPendingWithdrawal) { 
    toast({ title: "Pending withdrawal exists", description: "Wait for it to complete first", variant: "destructive" }); 
    return; 
  }
  
  const amt = parseFloat(withdrawAmount);
  if (!amt || amt < 10) { 
    toast({ title: "Minimum withdrawal is GH₵ 10.00", variant: "destructive" }); 
    return; 
  }
  
  const availableBalance = withdrawSource === "subagent_commission" 
    ? Number(store.subagent_commission_balance ?? 0) 
    : Number(store.wallet_balance ?? 0);
  
  if (amt > availableBalance) { 
    toast({ title: "Insufficient balance", variant: "destructive" }); 
    return; 
  }

  // Fetch active recipients
  const { data: recipients } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("agent_store_id", store.id)
    .eq("is_active", true)
    .limit(1);

  if (!recipients || recipients.length === 0) {
    toast({ title: "No active recipient", description: "Add a bank or MoMo recipient first", variant: "destructive" });
    return;
  }

  const recipient = recipients[0];
  setWithdrawLoading(true);

  try {
    // Call Paystack transfer edge function
    const response = await fetch(
      "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          transfer_recipient_id: recipient.paystack_recipient_code,
          agent_store_id: store.id,
          subagent_store_id: null,
          withdrawal_source: withdrawSource,
          recipient_id: recipient.id,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Transfer initialization failed");
    }

    // Deduct balance from store
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

    // Show success with transfer code
    toast({ 
      title: "Withdrawal initiated!", 
      description: `Transfer Code: ${result.transfer_code}. Processing...` 
    });
    
    setWithdrawAmount("");
    fetchAllData();
  } catch (error: any) {
    console.error("[v0] Withdrawal error:", error);
    toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
  } finally {
    setWithdrawLoading(false);
  }
};
```

---

### Step 3: Update AgentDashboard.tsx - Fetch Withdrawals

**Find line 682** (search for `supabase.from("withdrawal_requests")`)

**Replace with**:

```typescript
supabase.from("payout_requests").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false }),
```

---

## PART 3: SUBAGENT DASHBOARD CHANGES

### Step 4: Update SubagentDashboard.tsx - handleWithdraw Function

**File**: `src/pages/SubagentDashboard.tsx`

**Find the handleWithdraw function** (search for `if (!withdrawAmount || !subagentStore)`)

**Replace with**:

```typescript
const handleWithdraw = async () => {
  if (!withdrawAmount || !subagentStore) return;

  const hasPendingWithdrawal = withdrawals.some(w => w.status === "pending");
  if (hasPendingWithdrawal) {
    toast({ title: "Pending withdrawal exists", description: "Wait for it to complete first", variant: "destructive" });
    return;
  }

  const amount = parseFloat(withdrawAmount);
  if (!amount || amount < 10) {
    toast({ title: "Minimum withdrawal is GH₵ 10.00", variant: "destructive" });
    return;
  }

  const availableBalance = Number(subagentStore.wallet_balance ?? 0);
  if (amount > availableBalance) {
    toast({ title: "Insufficient balance", variant: "destructive" });
    return;
  }

  // Fetch active recipients
  const { data: recipients } = await supabase
    .from("transfer_recipients")
    .select("*")
    .eq("subagent_store_id", subagentStore.id)
    .eq("is_active", true)
    .limit(1);

  if (!recipients || recipients.length === 0) {
    toast({ title: "No active recipient", description: "Add a bank or MoMo recipient first", variant: "destructive" });
    return;
  }

  const recipient = recipients[0];
  setWithdrawLoading(true);

  try {
    // Call Paystack transfer edge function
    const response = await fetch(
      "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          transfer_recipient_id: recipient.paystack_recipient_code,
          agent_store_id: null,
          subagent_store_id: subagentStore.id,
          withdrawal_source: "wallet",
          recipient_id: recipient.id,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Transfer initialization failed");
    }

    // Deduct balance
    const newBalance = availableBalance - amount;
    await supabase
      .from("subagent_stores")
      .update({ wallet_balance: newBalance })
      .eq("id", subagentStore.id);

    toast({ 
      title: "Withdrawal initiated!", 
      description: `Transfer Code: ${result.transfer_code}` 
    });
    
    setWithdrawAmount("");
    fetchAllData();
  } catch (error: any) {
    console.error("[v0] Withdrawal error:", error);
    toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
  } finally {
    setWithdrawLoading(false);
  }
};
```

---

### Step 5: Update SubagentDashboard.tsx - Fetch Withdrawals

**Find all instances of `withdrawal_requests` in SubagentDashboard** (search for `"withdrawal_requests"`)

**Replace each with**:

```typescript
"payout_requests"
```

---

## PART 4: ADD RECIPIENT MANAGEMENT UI

### Step 6: Add Recipient Section to Agent Dashboard

**In AgentDashboard.tsx, after the withdraw card (around line 2093), ADD**:

```typescript
{activeTab === "withdraw" && (
  <Card className="border-border">
    <CardHeader>
      <CardTitle className="font-display text-lg">Withdrawal Recipients</CardTitle>
      <CardDescription>Manage where your money goes</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* List active recipients */}
      {withdrawals.some(r => r.recipient_id) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Active Recipients</p>
          {withdrawals.map((payout) => (
            <div key={payout.id} className="p-3 bg-secondary/50 rounded-lg border border-border">
              <p className="font-medium text-sm">{payout.transfer_code}</p>
              <p className="text-xs text-muted-foreground">Amount: GH₵ {payout.amount}</p>
              <Badge className={
                payout.status === "completed" 
                  ? "bg-green-500/20 text-green-400"
                  : payout.status === "pending"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              }>
                {payout.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <p className="text-xs text-muted-foreground mb-3">Add a recipient to enable withdrawals</p>
        <Button variant="outline" className="w-full">+ Add Recipient</Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

## PART 5: TESTING

### Verification Checklist

- [ ] **Database**: All 4 SQL queries executed successfully
- [ ] **Agent Dashboard**: handleWithdraw function updated
- [ ] **Agent Dashboard**: Payout history shows correctly
- [ ] **Subagent Dashboard**: handleWithdraw function updated
- [ ] **Subagent Dashboard**: Payout history shows correctly
- [ ] **Test withdrawal**: Minimum GH₵ 10 enforced
- [ ] **Test withdrawal**: Cannot withdraw without recipient
- [ ] **Test withdrawal**: Balance deducts immediately
- [ ] **Test withdrawal**: Transfer code displayed
- [ ] **Paystack**: Transfer appears in Paystack dashboard

---

## Important Notes

1. **Edge Function URL**: `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request`
2. **Minimum Withdrawal**: GH₵ 10.00
3. **Balance**: Deducted immediately when request is submitted
4. **Status**: Pending → Completed (once Paystack confirms)
5. **Recipients**: Max 2-3 per agent/subagent (configured in edge function)
6. **Refund**: If transfer fails, balance is refunded by edge function

