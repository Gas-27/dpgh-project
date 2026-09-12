# Database State Tracking: What Gets Saved Where

## Three Critical Database Tables

### Table 1: `subagent_package_prices`
**Purpose:** What Agent charges SubAgents (and what SubAgents charge SubSubAgents... wait no!)

**IMPORTANT:** This table is used for TWO different purposes:
1. **Agent → SubAgent pricing:** `agent_store_id` + `subagent_store_id` filled
2. **SubAgent → SubSubAgent pricing:** Uses DIFFERENT table!

```sql
CREATE TABLE subagent_package_prices (
  id UUID PRIMARY KEY,
  agent_store_id UUID,           -- Who is charging
  subagent_store_id UUID,        -- Who is being charged (if Agent→SubAgent)
  package_id UUID,
  base_price DECIMAL,            -- Cost to the buyer
  subagent_minimum_price DECIMAL, -- Minimum they must charge
  sell_price DECIMAL,            -- What they charge end users
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Table 2: `sub_subagent_package_prices` 
**Purpose:** What SubAgents charge SubSubAgents (AND what SubSubAgents charge end users)

```sql
CREATE TABLE sub_subagent_package_prices (
  id UUID PRIMARY KEY,
  subagent_store_id UUID,        -- Who is charging (the SubAgent)
  sub_subagent_store_id UUID,    -- Who is being charged (the SubSubAgent)
  package_id UUID,
  base_price DECIMAL,            -- Cost from SubAgent to SubSubAgent
  subagent_minimum_price DECIMAL,-- Minimum SubSubAgent must charge
  sell_price DECIMAL,            -- What SubSubAgent charges end users
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Table 3: `data_packages`
**Purpose:** Default/base package prices set by admin

```sql
CREATE TABLE data_packages (
  id UUID PRIMARY KEY,
  size_gb INT,                   -- e.g., 1, 2, 5, 10
  price DECIMAL,                 -- e.g., 4.00
  active BOOLEAN,
  created_at TIMESTAMP
);
```

---

## Complete Database State Example

### Initial State: Admin Sets Base Prices

```
data_packages table:
┌──────────┬─────────┐
│ id       │ price   │
├──────────┼─────────┤
│ pkg_1gb  │ 4.00    │ ← Admin says 1GB costs GH₵ 4.00
│ pkg_2gb  │ 8.00    │ ← Admin says 2GB costs GH₵ 8.00
│ pkg_5gb  │ 15.00   │ ← Admin says 5GB costs GH₵ 15.00
└──────────┴─────────┘

subagent_package_prices table: (EMPTY - no one has bought yet)

sub_subagent_package_prices table: (EMPTY - no one has bought yet)
```

---

### Step 1: Agent A Sets SubAgent B's Prices

**Action:** Agent A opens dashboard → Goes to "Store Prices" tab → Sets 1GB = GH₵ 4.50

**Database Insert:**
```
subagent_package_prices table (NEW ROW):
┌─────────────────────────────────────┐
│ agent_store_id: "Agent_A_ID"        │
│ subagent_store_id: "SubAgent_B_ID"  │
│ package_id: "pkg_1gb"               │
│ base_price: 4.50                    │ ← Cost to SubAgent B
│ subagent_minimum_price: 4.50        │
│ sell_price: 4.50                    │ (not used yet)
│ created_at: 2024-06-21T10:00:00     │
└─────────────────────────────────────┘
```

**Now SubAgent B sees:**
- When SubAgent B logs in and goes to dashboard
- Query runs: `SELECT base_price FROM subagent_package_prices WHERE agent_store_id='Agent_A_ID' AND subagent_store_id='SubAgent_B_ID'`
- Result: base_price = 4.50
- Display: "Your cost from Agent: GH₵ 4.50" ✅

---

### Step 2: SubAgent B Registers SubSubagent C

**Action:** SubSubagent C registers on storefront

**Database Insert:**
```
sub_subagent_stores table (NEW ROW):
┌─────────────────────────────────────┐
│ id: "SubSubagent_C_ID"              │
│ user_id: "User_C_UUID"              │
│ subagent_store_id: "SubAgent_B_ID"  │ ← Link to parent
│ store_name: "My Store C"            │
│ created_at: 2024-06-21T11:00:00     │
└─────────────────────────────────────┘
```

**Real-time listener triggers:**
- SubAgent B's dashboard detects NEW sub_subagent_stores insertion
- Calls `fetchData()`
- SubSubagent C now appears in dropdown ✅

---

### Step 3: SubAgent B Sets SubSubagent C's Prices

**Action:** SubAgent B opens dashboard → Selects "SubSubagent C" → Sets 1GB = GH₵ 4.80

**Database Insert:**
```
sub_subagent_package_prices table (NEW ROW):
┌──────────────────────────────────────────┐
│ subagent_store_id: "SubAgent_B_ID"       │ ← Who is charging
│ sub_subagent_store_id: "SubSubagent_C_ID"│ ← Who is being charged
│ package_id: "pkg_1gb"                    │
│ base_price: 4.80                         │ ← Cost from B to C
│ subagent_minimum_price: 4.80             │
│ sell_price: 4.80                         │ (SubAgent B's own price)
│ created_at: 2024-06-21T12:00:00          │
└──────────────────────────────────────────┘
```

**Database now shows:**
```
subagent_package_prices:
┌──────────────────────────────────────┐
│ Agent_A → SubAgent_B = 4.50          │ ← A's price for B
└──────────────────────────────────────┘

sub_subagent_package_prices:
┌──────────────────────────────────────┐
│ SubAgent_B → SubSubagent_C = 4.80    │ ← B's price for C
└──────────────────────────────────────┘
```

---

### Step 4: SubSubagent C Logs In and Sees "Cost from Agent"

**Action:** SubSubagent C opens dashboard

**Database Query (Line 525 - FIXED):**
```typescript
const parentPrices = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", "SubAgent_B_ID")         // ✅ Parent ID
  .eq("sub_subagent_store_id", "SubSubagent_C_ID"); // ✅ My ID
```

**Query Result:**
```
Returns rows where:
- subagent_store_id = SubAgent_B_ID (yes, found!)
- sub_subagent_store_id = SubSubagent_C_ID (yes, found!)
- Returns: base_price = 4.80

✅ CORRECT! SubSubagent C sees they pay GH₵ 4.80 from their parent
```

**Display:**
```
Package | Cost from Agent | Your Selling Price | Your Profit
1GB     | GH₵ 4.80        | GH₵ [empty]        | GH₵ [calc]
```

---

### Step 5: SubSubagent C Sets Their Own Selling Price

**Action:** SubSubagent C enters GH₵ 5.50 for 1GB and clicks Save

**Validation:**
```typescript
if (5.50 < 4.80) {
  error!  // Can't charge less than cost
} else {
  // ✅ Valid - can proceed
}
```

**Database Update:**
```
sub_subagent_package_prices table (UPDATE same row):
┌──────────────────────────────────────────┐
│ subagent_store_id: "SubAgent_B_ID"       │
│ sub_subagent_store_id: "SubSubagent_C_ID"│
│ package_id: "pkg_1gb"                    │
│ base_price: 4.80                         │ ← Unchanged (cost from B)
│ subagent_minimum_price: 5.50             │ ← Updated
│ sell_price: 5.50                         │ ← Updated (what C charges users)
└──────────────────────────────────────────┘
```

---

### Step 6: End User Buys 1GB from SubSubagent C

**Action:** End user sees price GH₵ 5.50 on SubSubagent C's store

**Money Flow:**
```
End User pays: GH₵ 5.50
      ↓
Sub SubAgent C receives: GH₵ 5.50
      ├─ Keeps: GH₵ 5.50 - GH₵ 4.80 = GH₵ 0.70 PROFIT ✅
      └─ Pays to SubAgent B: GH₵ 4.80
            ↓
            SubAgent B receives: GH₵ 4.80
            ├─ Keeps: GH₵ 4.80 - GH₵ 4.50 = GH₵ 0.30 PROFIT ✅
            └─ Pays to Agent A: GH₵ 4.50
                  ↓
                  Agent A receives: GH₵ 4.50
                  ├─ Keeps: GH₵ 4.50 - GH₵ 4.00 = GH₵ 0.50 PROFIT ✅
                  └─ Pays to Admin: GH₵ 4.00 (base cost)
```

**Complete Trail:**
```
End User      → SubSubagent C  → SubAgent B  → Agent A  → Admin
GH₵ 5.50      GH₵ 4.80        GH₵ 4.50      GH₵ 4.00
```

---

## Query Examples

### Query 1: SubAgent B Getting Their Cost from Agent A
```sql
SELECT package_id, base_price 
FROM subagent_package_prices 
WHERE agent_store_id = 'Agent_A_ID' 
  AND subagent_store_id = 'SubAgent_B_ID';

Returns:
┌─────────────┬────────────┐
│ package_id  │ base_price │
├─────────────┼────────────┤
│ pkg_1gb     │ 4.50       │ ✅
│ pkg_2gb     │ 8.50       │ ✅
└─────────────┴────────────┘
```

### Query 2: SubSubagent C Getting Their Cost from SubAgent B (FIXED)
```sql
SELECT package_id, base_price 
FROM sub_subagent_package_prices 
WHERE subagent_store_id = 'SubAgent_B_ID' 
  AND sub_subagent_store_id = 'SubSubagent_C_ID';

Returns:
┌─────────────┬────────────┐
│ package_id  │ base_price │
├─────────────┼────────────┤
│ pkg_1gb     │ 4.80       │ ✅ FIXED! Was missing filter before
│ pkg_2gb     │ 9.20       │ ✅
└─────────────┴────────────┘
```

### Query 3: Wrong Query (What Was Broken - Line 525)
```sql
-- BEFORE FIX (WRONG):
SELECT package_id, sell_price 
FROM sub_subagent_package_prices 
WHERE sub_subagent_store_id = 'SubAgent_B_ID';  -- Only ONE filter!

Returns: ALL prices from SubAgent B's table (wrong SubSubagent!)
┌─────────────┬───────────┐
│ package_id  │ sell_price│
├─────────────┼───────────┤
│ pkg_1gb     │ 5.50      │ ✗ WRONG! This is SubSubagent C's selling price
│ pkg_2gb     │ 10.00     │ ✗ WRONG! Not their cost!
└─────────────┴───────────┘

-- AFTER FIX (CORRECT):
SELECT package_id, base_price 
FROM sub_subagent_package_prices 
WHERE subagent_store_id = 'SubAgent_B_ID' 
  AND sub_subagent_store_id = 'SubSubagent_C_ID';

Returns: Correct cost for THIS SubSubagent
┌─────────────┬────────────┐
│ package_id  │ base_price │
├─────────────┼────────────┤
│ pkg_1gb     │ 4.80       │ ✅ CORRECT!
│ pkg_2gb     │ 9.20       │ ✅ CORRECT!
└─────────────┴────────────┘
```

---

## RLS Policies in Action

### When SubAgent B Saves SubSubagent C Prices
```sql
INSERT INTO sub_subagent_package_prices 
VALUES (subagent_store_id='SubAgent_B_ID', ...)

-- RLS Policy Checks:
1. Is user_id logged in? ✅
2. Does user own SubAgent_B_ID? 
   SELECT user_id FROM subagent_stores WHERE id='SubAgent_B_ID'
   ✅ Matches! Permission granted
3. INSERT allowed! ✅
```

### When SubSubagent C Reads Their Cost
```sql
SELECT base_price FROM sub_subagent_package_prices 
WHERE subagent_store_id='SubAgent_B_ID' 
  AND sub_subagent_store_id='SubSubagent_C_ID'

-- RLS Policy Checks:
1. Is user_id logged in? ✅
2. Can they view this data?
   SELECT id FROM sub_subagent_stores 
   WHERE id='SubSubagent_C_ID' AND user_id=current_user
   ✅ Matches! Permission granted
3. SELECT allowed! ✅
```

---

## What Changed (The Fix)

### Before Fix
```
SubSubagent C opens dashboard
     ↓
Query runs (WRONG):
SELECT base_price FROM sub_subagent_package_prices 
WHERE sub_subagent_store_id = 'SubAgent_B_ID'  ← WRONG! This is parent ID
     ↓
Returns ALL rows from SubAgent B (could be many SubSubagents' prices!)
     ↓
Shows: Wrong prices or default prices
     ↓
Result: ✗ SubSubagent sees incorrect cost
```

### After Fix
```
SubSubagent C opens dashboard
     ↓
Query runs (CORRECT):
SELECT base_price FROM sub_subagent_package_prices 
WHERE subagent_store_id = 'SubAgent_B_ID'       ← Parent ID
  AND sub_subagent_store_id = 'SubSubagent_C_ID'  ← My ID (new!)
     ↓
Returns ONLY rows for this specific SubSubagent
     ↓
Shows: Correct prices parent set for me
     ↓
Result: ✅ SubSubagent sees correct cost
```

---

## Summary

**Database is working correctly now because:**

1. ✅ SubAgent B sets prices in `sub_subagent_package_prices` with dual IDs
2. ✅ SubSubagent C queries with BOTH filters to get only their prices
3. ✅ Column is correct (`base_price` not `sell_price`)
4. ✅ Admin impersonation uses same logic
5. ✅ Real-time listener auto-refreshes parent dashboard

**Everything flows correctly now!**
