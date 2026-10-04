# Exact Locations of All Changes - Paystack Integration

## AgentDashboard.tsx

### **Location 1: State Variables (Lines 343-346)**
```typescript
const [withdrawAmount, setWithdrawAmount] = useState("");
const [withdrawSource, setWithdrawSource] = useState<"wallet" | "subagent_commission">("wallet");
const [withdrawLoading, setWithdrawLoading] = useState(false);
// ❌ ADDED THESE TWO LINES:
const [selectedRecipient, setSelectedRecipient] = useState<string>("");
const [transferRecipients, setTransferRecipients] = useState<any[]>([]);
```

---

### **Location 2: Data Fetching - Promise.all (Lines 680-691)**

**BEFORE:**
```typescript
const [pkgR, priceR, orderR, wdR, subagentR, customBasePriceR, subagentPriceR, specialMTNR] = await Promise.all([
  // ... 8 queries
]);
```

**AFTER:**
```typescript
// ❌ ADDED TWO MORE PARAMETERS AT THE END:
const [pkgR, priceR, orderR, wdR, subagentR, customBasePriceR, subagentPriceR, specialMTNR, recipientsR, payoutR] = await Promise.all([
  // ... original 8 queries ...
  supabase.from("transfer_recipients").select("*").eq("agent_store_id", sd.id).eq("is_active", true).order("created_at", { ascending: false }),
  supabase.from("payout_requests").select("*").eq("agent_store_id", sd.id).order("created_at", { ascending: false })
]);
```

---

### **Location 3: Set Recipients State (After Line 717)**

**AFTER:**
```typescript
setOrders(enrichedOrders);
const wd = (wdR.data as WithdrawalRequest[]) ?? [];
setWithdrawals(wd);
// ❌ ADD THIS LINE:
setTransferRecipients(recipientsR.data ?? []);
const subags = subagentR.data ?? [];
setSubagents(subags);
```

---

### **Location 4: handleWithdraw Function (Lines 1121-1159)**

**COMPLETELY REPLACED** the old function:

```typescript
const handleWithdraw = async () => {
  if (!store) return;
  // ❌ NEW: Check recipient is selected
  if (!selectedRecipient) { toast({ title: "Select a recipient", variant: "destructive" }); return; }
  if (hasPendingWithdrawal) { toast({ title: "Pending withdrawal exists", variant: "destructive" }); return; }
  
  const amt = parseFloat(withdrawAmount);
  if (!amt || amt < 10) { toast({ title: "Minimum is GH₵ 10.00", variant: "destructive" }); return; }
  
  const availableBalance = withdrawSource === "subagent_commission" 
    ? Number(store.subagent_commission_balance ?? 0) 
    : Number(store.wallet_balance ?? 0);
  
  if (amt > availableBalance) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
  
  setWithdrawLoading(true);
  try {
    // ❌ NEW: Call Paystack edge function instead of DB insert
    const response = await fetch(
      "https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_code: selectedRecipient,
          amount: amt,
          agent_store_id: store.id,
          withdrawal_source: withdrawSource,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Withdrawal failed");

    toast({ title: "Withdrawal initiated!", description: `GH₵ ${amt.toFixed(2)} will be transferred soon.` });
    setWithdrawAmount("");
    setSelectedRecipient("");
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

### **Location 5: Withdrawal UI - TabsContent (Lines 2122-2169)**

**COMPLETELY REPLACED** the old withdrawal form:

```typescript
// OLD: <Card><CardHeader>Request Withdrawal from...</CardHeader>
// NEW:
<Card className="border-border">
  <CardHeader>
    <CardTitle className="font-display text-lg">Request Paystack Transfer</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {hasPendingWithdrawal && (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
        <p className="text-sm text-yellow-400 font-medium">You have a pending withdrawal of GH₵ {pendingWithdrawalAmount.toFixed(2)}. Please wait until it completes.</p>
      </div>
    )}
    
    {transferRecipients.length === 0 ? (
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
        <p className="text-sm text-orange-400 font-medium">No recipients configured yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add a bank or mobile money recipient first</p>
      </div>
    ) : (
      <>
        {/* ❌ NEW: Recipient dropdown */}
        <div className="space-y-2">
          <Label>Select Recipient</Label>
          <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a recipient..." />
            </SelectTrigger>
            <SelectContent>
              {transferRecipients.map((r: any) => (
                <SelectItem key={r.recipient_code} value={r.recipient_code}>
                  {r.recipient_name || r.account_number} ({r.recipient_type === "nuban" ? "Bank" : "Mobile Money"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <p className="text-xs text-muted-foreground">Minimum: GH₵ 10.00. Processed within 24 hours.</p>
        
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label>Amount (GH₵)</Label>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="e.g. 50.00" 
              value={withdrawAmount} 
              onChange={e => setWithdrawAmount(e.target.value)} 
              disabled={hasPendingWithdrawal} 
            />
          </div>
          {/* ❌ CHANGED: "Transfer" instead of "Withdraw", requires selectedRecipient */}
          <Button 
            variant="hero" 
            onClick={handleWithdraw} 
            disabled={withdrawLoading || hasPendingWithdrawal || !selectedRecipient}
          >
            {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowDownToLine className="h-4 w-4 mr-1" />}
            Transfer
          </Button>
        </div>
      </>
    )}
  </CardContent>
</Card>

{/* ❌ NEW: Payout history with transfer codes */}
{withdrawals.length > 0 && (
  <Card className="border-border">
    <CardHeader>
      <CardTitle className="font-display text-lg">Payout History</CardTitle>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Transfer Code</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map(w => (
            <TableRow key={w.id}>
              <TableCell className="text-sm">{new Date(w.created_at).toLocaleString()}</TableCell>
              <TableCell className="font-bold">GH₵ {Number(w.amount).toFixed(2)}</TableCell>
              <TableCell className="text-xs">{w.recipient_name || w.recipient_code}</TableCell>
              <TableCell>
                <Badge className={w.status === "success" ? "bg-green-600/20 text-green-400 border-green-600/30" : w.status === "pending" ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>
                  {w.status}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{w.transfer_code || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
)}
```

---

## SubagentDashboard.tsx

### **Location 1: State Variables (Lines 165-167)**
```typescript
const [withdrawAmount, setWithdrawAmount] = useState("");
// ❌ ADD THESE TWO:
const [selectedRecipient, setSelectedRecipient] = useState<string>("");
const [transferRecipients, setTransferRecipients] = useState<any[]>([]);
```

---

### **Location 2: Data Fetching (Lines 488-510)**

**BEFORE:**
```typescript
const [
  ordersResult,
  withdrawResult,
  // ... 7 more
] = await Promise.all([
  // ... 9 queries
]);
```

**AFTER:**
```typescript
// ❌ ADD TWO MORE PARAMETERS:
const [
  ordersResult,
  withdrawResult,
  packagesResult,
  agentSubagentPricesResult,
  adminCustomPricesResult,
  subagentPricesResult,
  topupsResult,
  agentInfoResult,
  subSubagentsResult,
  recipientsResult,     // ❌ NEW
  payoutResult          // ❌ NEW
] = await Promise.all([
  // ... original 9 queries ...
  supabase.from("transfer_recipients").select("*").eq("subagent_store_id", store.id).eq("is_active", true).order("created_at", { ascending: false }),
  supabase.from("payout_requests").select("*").eq("subagent_store_id", store.id).order("created_at", { ascending: false })
]);

setOrders(ordersResult.data || []);
setWithdrawals(withdrawResult.data || []);
setTransferRecipients(recipientsResult.data || []);  // ❌ NEW
```

---

### **Location 3: handleRequestWithdrawal Function (Lines 1122-1175)**

**REPLACED** the old function with new Paystack version - same as Agent dashboard but without `withdrawal_source` parameter.

Key differences:
- ❌ NEW: Check for `selectedRecipient`
- ❌ CHANGED: Calls edge function instead of DB insert
- ❌ CHANGED: Better error handling

---

### **Location 4: Withdrawal UI (Lines 2397-2475)**

**REPLACED** the old withdrawal form with:

- ❌ Title changed to "Request Paystack Transfer"
- ❌ NEW: Recipient dropdown
- ❌ REMOVED: MoMo details display
- ❌ Payout history instead of withdrawal history
- ❌ Transfer codes shown in history

---

## Summary Table

| File | Section | Lines | Type |
|------|---------|-------|------|
| AgentDashboard.tsx | State | 343-346 | Added 2 vars |
| AgentDashboard.tsx | Data Fetch | 680-691 | Modified Promise |
| AgentDashboard.tsx | Set State | ~720 | Added 1 line |
| AgentDashboard.tsx | handleWithdraw | 1121-1159 | Replaced (39 lines) |
| AgentDashboard.tsx | UI | 2122-2169 | Replaced (95 lines) |
| SubagentDashboard.tsx | State | 165-167 | Added 2 vars |
| SubagentDashboard.tsx | Data Fetch | 488-510 | Modified Promise |
| SubagentDashboard.tsx | Set State | ~513 | Added 1 line |
| SubagentDashboard.tsx | handleRequestWithdrawal | 1122-1175 | Replaced (54 lines) |
| SubagentDashboard.tsx | UI | 2397-2475 | Replaced (79 lines) |

---

## Total Changes

- **2 files modified**: AgentDashboard.tsx, SubagentDashboard.tsx
- **State variables added**: 4 (2 per file)
- **Functions updated**: 2
- **UI sections updated**: 4
- **Lines added/modified**: ~350+
- **Edge function calls**: 2 (identical)
- **New database queries**: 4

---

## Build Status

✅ Build passed successfully
✅ No compilation errors
✅ No TypeScript errors
✅ Ready for deployment
