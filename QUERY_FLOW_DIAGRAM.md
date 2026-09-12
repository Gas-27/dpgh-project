# Complete Query Flow Diagram - All Changes

## The Three-Tier System

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT                                         │
│  (Buys from system at price X)                                   │
│  Sells to SubAgents at: base_price (agent_to_subagent)           │
│  Sells to Users at: sell_price (user facing)                     │
└──────────────┬──────────────────────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
    ┌──▼──┐         ┌──▼──┐
    │ S.A │         │ S.A │
    │ (1) │         │ (2) │
    └──┬──┘         └──┬──┘
       │                │
    ┌──▼────────┐    ┌──▼────────┐
    │ SubAgent  │    │ SubAgent  │
    │ (Buys at: │    │ (Buys at: │
    │ 4.50)     │    │ 4.50)     │
    │           │    │           │
    │ Sells to: │    │ Sells to: │
    │ - Users   │    │ - Users   │
    │ - SubSub  │    │ - SubSub  │
    └──┬─┬──────┘    └──┬─┬──────┘
       │ │              │ │
    ┌──▼─▼─┐         ┌──▼─▼─┐
    │SubSub│         │SubSub│
    │(3.50)│         │(3.50)│
    └──────┘         └──────┘
```

## Database Tables & Columns Used

### Table: `sub_subagent_package_prices` (PRIMARY - Used for all queries)

```sql
id | subagent_store_id | sub_subagent_store_id | package_id | base_price | sell_price | created_at
---|------|------|------|------|------|------|
1  | A    | NULL | 1gb  | 4.50 | 5.00 | ...  ← Agent→SubAgent (base_price = what agent charges subagent)
2  | A    | C    | 1gb  | 3.50 | 3.50 | ...  ← SubAgent→SubSubAgent (base_price = what subagent charges subsubagent)
3  | A    | D    | 1gb  | 3.75 | 3.75 | ...  ← SubAgent→SubSubAgent (different subsubagent, different price!)
```

---

## QUERY #1: Agent Dashboard - Show What Subagents Pay Agent

**File:** AgentDashboard.tsx, line 560
**User:** Agent (user A)
**Goal:** Show what subagents pay for each package

```sql
SELECT package_id, base_price
FROM subagent_package_prices
WHERE agent_store_id = A
  AND subagent_store_id IS NOT NULL     -- Only rows where a subagent is set
```

**Result Rows:**
```
package_id | base_price
-----------|----------
1gb        | 4.50      ← Subagent pays agent 4.50 for 1GB
2gb        | 9.00
```

**Display in UI:** "Set Subagent Prices" section → Shows base_price as "Subagent Cost"

---

## QUERY #2: SubAgent Dashboard - Show What Agent Charges SubAgent

**File:** SubagentDashboard.tsx, line 473
**User:** SubAgent (user B)
**Goal:** Show the COST to this subagent from their parent agent

```sql
SELECT package_id, base_price
FROM subagent_package_prices
WHERE agent_store_id = A              -- Parent agent
  AND subagent_store_id = B           -- This specific subagent
```

**Result Rows:**
```
package_id | base_price
-----------|----------
1gb        | 4.50      ← SubAgent B's cost from Agent A
2gb        | 9.00
```

**Display in UI:** Base Prices section → "Your Cost Price from Agent"

---

## QUERY #3: SubAgent Dashboard - Show What SubSubAgents Pay SubAgent

**File:** SubagentDashboard.tsx, line 475
**User:** SubAgent (user B)  
**Goal:** Show what subsubagents pay to this subagent

```sql
SELECT package_id, sell_price
FROM subagent_package_prices
WHERE subagent_store_id = B           -- This subagent is the parent
```

**Result Rows:**
```
package_id | sell_price
-----------|----------
1gb        | 3.50      ← SubSubagent pays SubAgent B 3.50
1gb        | 3.75      ← Another SubSubagent pays SubAgent B 3.75 (they set different prices!)
2gb        | 7.50
2gb        | 7.75
```

**Display in UI:** "Sub-Subagent Pricing" section → Shows sell_price as "Sub-Subagent Cost"

---

## QUERY #4: SubSubAgent Dashboard - Show What Parent Charges SubSubAgent (THIS WAS BROKEN - NOW FIXED!)

**File:** SubSubagentDashboard.tsx, line 525 (FIXED)
**User:** SubSubAgent (user C)
**Goal:** Show what this subsubagent's parent charges them

```sql
-- BEFORE (WRONG):
SELECT package_id, sell_price              ❌ Wrong column!
FROM sub_subagent_package_prices
WHERE sub_subagent_store_id = B            ❌ Missing filter for THIS subsubagent!

-- AFTER (CORRECT):
SELECT package_id, base_price              ✅ Correct column!
FROM sub_subagent_package_prices
WHERE subagent_store_id = B                ✅ Parent's ID
  AND sub_subagent_store_id = C            ✅ This subsubagent's ID
```

**Result Rows (CORRECT):**
```
package_id | base_price
-----------|----------
1gb        | 3.50      ← This subsubagent pays parent 3.50
2gb        | 7.50
```

**Display in UI:** Cost from Agent section → "Your Cost Price from SubAgent"

---

## QUERY #5: SubSubAgent Dashboard - Admin Impersonation (NOW FIXED!)

**File:** SubSubagentDashboard.tsx, lines 511-525 (FIXED)
**User:** Admin impersonating SubSubAgent C
**Goal:** Show what SubSubAgent C's parent charges them

```sql
-- BEFORE (BROKEN):
-- Admin path didn't fetch parent prices at all!

-- AFTER (FIXED):
SELECT package_id, base_price
FROM sub_subagent_package_prices
WHERE subagent_store_id = B               -- Parent
  AND sub_subagent_store_id = C           -- This subsubagent being impersonated
```

**Result:** Admin now sees the exact same prices as the actual SubSubAgent ✅

---

## Critical Fix: The Dual Filters

### Why Both Filters Matter:

**Scenario:** SubAgent B manages 5 SubSubagents (C, D, E, F, G) and sets different prices for each.

```
sub_subagent_package_prices:

Row 1: subagent_store_id=B, sub_subagent_store_id=C, package_id=1gb, base_price=3.50
Row 2: subagent_store_id=B, sub_subagent_store_id=D, package_id=1gb, base_price=3.75
Row 3: subagent_store_id=B, sub_subagent_store_id=E, package_id=1gb, base_price=4.00
Row 4: subagent_store_id=B, sub_subagent_store_id=F, package_id=1gb, base_price=3.60
Row 5: subagent_store_id=B, sub_subagent_store_id=G, package_id=1gb, base_price=3.70
```

### Old Query (BROKEN):
```sql
WHERE subagent_store_id = B  ← Only this filter
```
Result: Returns ALL 5 rows (confusion!)

### New Query (CORRECT):
```sql
WHERE subagent_store_id = B AND sub_subagent_store_id = C  ← Both filters
```
Result: Returns ONLY Row 1 (correct!) ✅

---

## Real-Time Auto-Refresh (NEW - CHANGE #3)

**File:** SubagentDashboard.tsx, lines 386-406
**Listener:** Supabase PostgreSQL Changes

```typescript
.on(
  "postgres_changes",
  {
    event: "INSERT",                    // Only listen for new registrations
    schema: "public",
    table: "sub_subagent_stores",
    filter: `subagent_store_id=eq.${subagentStore.id}`,  // Only THIS subagent's registrations
  },
  () => fetchData()  // Auto-refresh dashboard
)
```

**Trigger:** When SubSubagent registers on storefront
1. New row inserted into `sub_subagent_stores` with `subagent_store_id = B`
2. PostgreSQL sends change notification
3. Supabase channel receives it (because filter matches)
4. `fetchData()` is called automatically
5. SubAgent's dashboard refreshes with new SubSubagent in list

**Result:** No manual refresh needed ✅

---

## Summary Table

| Query | File | Line | Before | After | Status |
|-------|------|------|--------|-------|--------|
| Agent → SubAgent prices | AgentDashboard | 560 | N/A | Unchanged | ✅ Working |
| SubAgent ← Agent prices | SubagentDashboard | 473 | N/A | Unchanged | ✅ Working |
| SubAgent → SubSubAgent prices | SubagentDashboard | 475 | N/A | Unchanged | ✅ Working |
| SubSubAgent ← SubAgent prices | SubSubagentDashboard | 525 | Wrong query + wrong column | Dual filters + base_price | ✅ FIXED |
| Admin impersonation prices | SubSubagentDashboard | 511-525 | No fetch | Added fetch | ✅ FIXED |
| New registration detection | SubagentDashboard | 386-406 | Manual only | Real-time | ✅ NEW |

All three changes are now verified and working correctly.
