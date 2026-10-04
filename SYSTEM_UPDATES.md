# Data Plug Store — Complete System Updates Summary

## Overview
All refund routing, admin dashboard, subagent registration, and withdrawal systems have been fixed and deployed. The system now correctly handles refunds across all network tiers (agents, subagents, sub-subagents) with proper profit accounting.

---

## 1. REFUND SYSTEM (COMPLETE REWRITE)

### How Refunds Now Work

**The Core Rule:** Refunds go to the **top-level recipient** of each order, based on where it was purchased from:

#### Refund Routing by Order Source:

| Order Source | Refund Recipient | Amount | Notes |
|---|---|---|---|
| **Direct Customer** (Packages page) | Customer wallet | Base price only | Order comes with `customer_id` set, `agent_store_id = NULL` |
| **Agent's Own Order** (Packages page) | Agent wallet | Base price only | Agent orders have BOTH `customer_id` + `agent_store_id` — system checks `agent_store_id` FIRST |
| **Agent Storefront** | Agent wallet | Base price only | Customer bought from agent's storefront |
| **Subagent Order** | Parent Agent wallet | Base price only | Admin refunds → agent wallet, agent can then refund to subagent |
| **Sub-Subagent Order** | Top-Level Agent wallet | Base price only | Admin refunds → agent wallet (who owns the chain) |

---

### Refund Flow for Each Network Tier

**TIER 1: Admin Refunds (Order from Agent)**
```
Customer paid: GHC 10
Base price: GHC 7
Admin refunds → Agent wallet: +GHC 7 (base price only)
Agent's profit (GHC 3) is LOST (order failed, no data delivered)
```

**TIER 2: Agent Refunds to Subagent**
```
Agent received from admin: GHC 7
Agent's profit on that sale: GHC 3
Agent refunds to subagent:
  Agent wallet: -GHC 10 (GHC 7 + GHC 3 profit)
  Subagent wallet: +GHC 10
  Result: Agent loses the GHC 3 profit, subagent can retry with full amount
```

**TIER 3: Subagent Refunds to Sub-Subagent**
```
Subagent received from agent: GHC 10
Subagent's profit on that sale: GHC 3
Subagent refunds to sub-subagent:
  Subagent wallet: -(GHC 10 + their profit)
  Sub-Subagent wallet: +(GHC 10 + subagent profit)
  Result: Subagent loses profit, sub-subagent gets full retry amount
```

---

### Refund Tab Features (Agent Dashboard)

✓ Shows only orders that have been refunded by admin
✓ Displays base price correctly (was showing 0.00, now fixed)
✓ Shows full subagent/sub-subagent store names (was showing partial UUID, now fixed)
✓ Removed "Customer Paid" column (not needed)
✓ No double-refunds allowed — checkbox hidden/greyed for already-refunded orders
✓ Already-refunded rows show green "Refunded to Subagent" badge

**How to Use:**
1. Select refunded orders using checkboxes
2. Click "Refund Selected"
3. Money deducted from agent wallet, credited to subagent wallet
4. Subagent can then retry or refund further down

---

### SQL Fixes Applied

**Step 1: Fixed Code Logic**
- Refund routing check: `agent_store_id` → `subagent_store_id` → `customer_id` (STRICT ORDER)
- Base price fallback: `base_price || agent_price || order.amount`

**Step 2: Retroactive Fixes (You Ran These)**

Fixed agent orders that got refunds to the wrong wallet:
```sql
-- Moved refund amounts from customer wallet → agent wallet for agents who have both accounts
-- This fixed the issue where agents lost refund money to their customer wallet instead of agent wallet
```

Fixed pure user refunds that were incorrectly deducted:
```sql
-- Restored user customer wallet balances for customers with NO agent account
-- Ensured only agents' wallets were touched in the transfer
```

---

## 2. ADMIN DASHBOARD IMPROVEMENTS

### Reverse Refund Functionality
✓ **Already Exists & Works**
- When viewing refunded orders, admin can click "Reverse" button
- Undoes the refund: money deducted from wallet, order status reset to "completed"
- Prevents accidental over-refunds

---

### Withdrawal Tab Redesign
✓ **All Withdrawals Visible**
- Shows withdrawals from agents, subagents, and sub-subagents
- Displays store name, type badge (Agent/Subagent/Sub-Subagent), amount, MoMo details, status

✓ **Visit Store Links**
- Each withdrawal row has a "Visit Store" button
- Opens agent/subagent dashboard in new tab
- Admin can instantly access any store's dashboard to verify activity

✓ **Real-Time Updates**
- New withdrawals appear automatically in the withdrawal tab
- No page refresh needed
- Admin stays in sync with live withdrawal requests

---

### Order Search Improvements
✓ **Order Status Column**
- Shows exact order status (Pending, Processing, Delivered, Failed, Refunded, etc.)
- Color-coded badges for quick identification

✓ **Reverse Refund Action**
- Click "Reverse" on any refunded order to undo the refund
- Automatically adjusts wallet balance and order status

---

## 3. SUBAGENT REGISTRATION (FIXED)

### What Was Broken
- Trigger functions had no exception handling
- `assign_subagent_role()` was inserting wrong role and failing on auth signup

### What Was Fixed
```sql
-- Both trigger functions now have proper exception handling:
-- - Wraps user_roles insert in BEGIN/EXCEPTION
-- - Prevents signup failure if role insert fails
-- - Logs errors but allows user account to be created
-- - Added ON CONFLICT to avoid duplicate key errors
```

### Subagent Redirect
✓ After successful signup, subagents now redirect to `/subagent-dashboard` instead of generic `/dashboard`
✓ They land immediately on their agent interface

---

## 4. CHATBOT KNOWLEDGE BASE (COMPLETE REWRITE)

### New Refund Entry
Explains the complete refund system covering:
- Direct customers (user wallet)
- Agents (agent wallet)
- Storefront customers (agent wallet)
- Subagent orders (agent wallet, can refund down)
- Sub-subagent orders (top-level agent wallet)
- One-refund-per-order rule
- Minimum withdrawal (GHC15)
- Processing time (<2 minutes)

### New Storefront Refund Entry
Explains agent options when storefront customers are refunded:
- Option A: Send money back to customer via MoMo directly
- Option B: Retry the order using wallet balance

---

## 5. PENDING USER AGENTS (SPECIAL CASE)

**If someone has BOTH user account + pending agent account:**
- When they buy from Packages page: order has `customer_id` set, `agent_store_id = NULL`
- Refund goes to: **User Dashboard Wallet** (NOT agent wallet yet)
- Why: They can't place orders through agent dashboard until approved
- Once approved: Future orders have `agent_store_id` set → refunds go to agent wallet

---

## Deployment Checklist

- [x] Refund routing code fixed (deployed to Git)
- [x] Base price column fixed (deployed)
- [x] Subagent/Sub-subagent names fixed (deployed)
- [x] Double-refund protection added (deployed)
- [x] Chatbot knowledge base expanded (deployed)
- [x] Admin dashboard "Visit Store" links added (deployed)
- [x] Withdrawal real-time updates added (deployed)
- [x] Reverse refund functionality verified working (deployed)
- [x] Subagent registration trigger functions fixed (deployed to SQL)
- [x] Subagent redirect to subagent-dashboard added (deployed)
- [x] Retroactive wallet transfers completed (SQL queries you ran)

---

## Testing Recommendations

### 1. Test Refund Routing
- [ ] Create agent order → refund → check agent wallet received GHC 7 (base)
- [ ] Create subagent order → admin refunds → check agent wallet got it
- [ ] Agent refunds to subagent → check subagent wallet got full amount + agent's profit

### 2. Test Admin Features
- [ ] Search for refunded order → click "Reverse" → verify wallet adjusted
- [ ] Go to Withdrawals tab → click "Visit Store" → verify dashboard opens
- [ ] Create new withdrawal → verify it appears in real-time in Withdrawals tab

### 3. Test Subagent Signup
- [ ] Go to "Become Agent" → "Create Subagent"
- [ ] Fill form and submit
- [ ] Verify: no 500 error, user lands on subagent-dashboard

### 4. Test Chatbot
- [ ] Chat: "how does refund work"
- [ ] Chat: "storefront refund"
- [ ] Verify: comprehensive explanations appear

---

## Key System Insights

**No one profits from failed orders:**
- When an order fails and is refunded, whoever sold it loses their profit
- The profit reversal happens when they choose to refund downward
- This ensures the cost flows down the chain for retry capability

**Wallet balance is the source of truth:**
- Admin refunds go to wallet as base price
- Each tier deducts profit when refunding to next tier
- Wallet balance shown is always accurate for retry capability

**Pending vs Approved matters:**
- Pending agents' orders still route through customer path
- Once approved, orders route through agent path
- This prevents complications with unapproved but signed-up agents

---

## Files Modified

1. `/src/pages/AdminDashboard.tsx` — Withdrawal links + real-time refresh
2. `/src/pages/AgentDashboard.tsx` — Refund tab UI fixes (previous chat)
3. `/src/components/SubagentRegistrationForm.tsx` — Redirect to subagent-dashboard
4. `/src/data/chatbot-knowledge-base.ts` — Complete refund system explanation
5. **Supabase SQL** — Trigger functions fixed (handle_new_user, assign_subagent_role, etc.)

---

## Next Steps (If Needed)

- Optionally: Add withdrawal request confirmation dialog before processing
- Optionally: Add refund reason/notes field to track why orders were refunded
- Optionally: Generate monthly reports showing refund losses by agent

