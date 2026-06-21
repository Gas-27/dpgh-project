# Complete Workflow: How Pricing System Works End-to-End

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE PRICE HIERARCHY                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ADMIN                                                            │
│  ├─ Sets BASE PRICES for packages                               │
│  └─ Table: data_packages (id, price)                            │
│                                                                   │
│      ↓ ADMIN SETS AGENT PRICES                                  │
│                                                                   │
│  AGENT (User A)                                                  │
│  ├─ Sees: data_packages prices = BASE (e.g., 4.50)             │
│  ├─ Can SET: What subagents pay = COST TO SUBAGENT             │
│  │  Table: subagent_package_prices                              │
│  │  Fields: agent_store_id=A, subagent_store_id=NULL, base_price │
│  └─ Can CHARGE: Users pay via agent_package_prices table        │
│                                                                   │
│      ↓ AGENT SETS SUBAGENT PRICES                              │
│                                                                   │
│  SUBAGENT (User B, under Agent A)                               │
│  ├─ Sees: Cost from Agent = subagent_package_prices             │
│  │  Query: WHERE agent_store_id=A AND subagent_store_id=B       │
│  ├─ Can SET: What sub-subagents pay = COST TO SUB-SUBAGENT     │
│  │  Table: sub_subagent_package_prices                          │
│  │  Fields: subagent_store_id=B, sub_subagent_store_id=C, base_price │
│  └─ Can CHARGE: Users pay via subagent_package_prices table     │
│                                                                   │
│      ↓ SUBAGENT SETS SUB-SUBAGENT PRICES                       │
│                                                                   │
│  SUB-SUBAGENT (User C, under SubAgent B)                        │
│  ├─ Sees: Cost from Agent = sub_subagent_package_prices         │
│  │  Query: WHERE subagent_store_id=B AND sub_subagent_store_id=C │
│  ├─ Can SET: Own selling prices                                 │
│  │  Table: sub_subagent_package_prices                          │
│  │  Fields: subagent_store_id=B, sub_subagent_store_id=C, sell_price │
│  └─ Charges end users based on sell_price                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow #1: SubAgent Setting Prices for SubSubAgents

### Step 1: SubAgent Opens Dashboard
**File:** `SubagentDashboard.tsx`
**Location:** User clicks "Sub-Subagent Pricing" tab

### Step 2: fetchData() Runs
**Lines 465-575:** Complete fetch sequence:

```typescript
// Query 1: Get packages (baseline prices)
packages = SELECT * FROM data_packages WHERE active=true

// Query 2: Get Agent's prices for this SubAgent
subagentPrices = SELECT package_id, base_price 
  FROM subagent_package_prices 
  WHERE agent_store_id = Agent_A 
    AND subagent_store_id = SubAgent_B
// This is what Agent A charged SubAgent B

// Query 3: Get SubSubagents under this SubAgent
subSubagents = SELECT * FROM sub_subagent_stores 
  WHERE subagent_store_id = SubAgent_B
// Lists all sub-subagents (User C, D, E, etc.)
```

**Result:** 
- `basePrices` = What Agent A charges SubAgent B (e.g., 4.50)
- `subagentPrices` = Same as basePrices in this case
- `subSubagents` = [SubSubagent1, SubSubagent2, SubSubagent3]

### Step 3: SubAgent Selects A SubSubagent
**UI:** Click dropdown → Select "SubSubagent1"
**Sets:** `selectedSubSubagentId = "SubSubagent1_ID"`

### Step 4: SubAgentPricesManager Component Loads
**File:** `components/SubSubagentPricesManager.tsx`
**Props received:**
```typescript
{
  subagentStoreId: "SubAgent_B_ID",
  selectedSubSubagentId: "SubSubagent1_ID",
  packages: [...all packages],
  subagentPrices: { pkg1: 4.50, pkg2: 5.00, ... },
  onPricesSaved: () => fetchData()
}
```

### Step 5: Component Fetches Existing Prices
**Line:** ~70
```typescript
const { data } = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", "SubAgent_B_ID")
  .eq("sub_subagent_store_id", "SubSubagent1_ID");

// Returns: Previously set prices for this SubSubagent
// Example: { pkg1: 4.75, pkg2: 5.25 }
```

### Step 6: SubAgent Edits Prices
**UI Action:** Change 1GB price from 4.50 → 4.80

**In memory:**
```typescript
editedPrices = { pkg1: "4.80" }
```

### Step 7: SubAgent Clicks "Save Prices"
**File:** `SubSubagentPricesManager.tsx`, function `savePrices()`

**Step 7a: Validation**
```typescript
// Ensure price >= what SubAgent themselves pay from Agent
if (4.80 < 4.50) throw error;  // ✅ Passes: 4.80 > 4.50
```

**Step 7b: Delete Old Price**
```typescript
await supabase
  .from("sub_subagent_package_prices")
  .delete()
  .eq("subagent_store_id", "SubAgent_B_ID")
  .eq("sub_subagent_store_id", "SubSubagent1_ID")
  .eq("package_id", "pkg1");
```

**Step 7c: Insert New Price**
```typescript
await supabase
  .from("sub_subagent_package_prices")
  .insert({
    subagent_store_id: "SubAgent_B_ID",
    sub_subagent_store_id: "SubSubagent1_ID",
    package_id: "pkg1",
    base_price: 4.80,
    subagent_minimum_price: 4.80,
    sell_price: 4.80
  });
```

### Step 8: Real-Time Subscription Triggers
**File:** `SubagentDashboard.tsx`, line ~406
```typescript
// Supabase detects INSERT on sub_subagent_stores
// Listener: subagent-sub-subagents-${subagentStore.id}
// Calls: fetchData() automatically

// Dashboard updates:
subSubagents list refreshes
// SubSubagent1 now shows pricing is set ✅
```

### Step 9: Success
- **Database updated:** sub_subagent_package_prices now has new row
- **User sees:** "Prices saved successfully"
- **SubSubagent sees:** Their cost from agent updated to 4.80

---

## Workflow #2: SubSubAgent Viewing "Cost from Agent"

### Step 1: SubSubAgent Opens Dashboard
**File:** `SubSubagentDashboard.tsx`
**URL:** User logs in as SubSubagent1

### Step 2: Determine User Identity
**Lines 344-397:**

```typescript
if (user_id is in admin list) {
  // ADMIN IMPERSONATION PATH
  fetch parent prices using Lines 511-525
} else {
  // NORMAL USER PATH
  store = SELECT * FROM sub_subagent_stores 
    WHERE user_id = authenticated_user_id
}
```

### Step 3: Fetch Parent Prices ✅ (THIS WAS FIXED)
**File:** `SubSubagentDashboard.tsx`, Line 525 (AFTER FIX)

```typescript
const parentPricesResult = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")  // ✅ FIXED: was "sell_price"
  .eq("subagent_store_id", store.subagent_store_id)  // Parent B's ID
  .eq("sub_subagent_store_id", store.id);  // ✅ FIXED: Added this filter
```

**Example query result:**
```
subagent_store_id: "SubAgent_B_ID"
sub_subagent_store_id: "SubSubagent1_ID"
base_price: 4.80  ✅ Correct! SubAgent B set this
```

### Step 4: Build Base Prices
**Lines 545-555:**

```typescript
const basePriceMap = {};

// First: Set all to default
packages.forEach(pkg => {
  basePriceMap[pkg.id] = pkg.price;  // e.g., 4.50
});

// Then: Override with parent's prices if they exist
parentPrices.forEach(p => {
  if (p.base_price) {
    basePriceMap[p.package_id] = p.base_price;  // e.g., 4.80 ✅
  }
});

setBasePrices(basePriceMap);
// Final: { pkg1: 4.80, pkg2: 5.00, ... }
```

### Step 5: UI Displays "Cost from Agent"
**UI:** SubSubagentDashboard shows pricing table
```
Package | Cost from Agent | Your Selling Price | Your Profit
1GB     | GH₵ 4.80        | GH₵ [editable]    | [auto-calc]
2GB     | GH₵ 5.00        | GH₵ [editable]    | [auto-calc]
```

### Step 6: SubSubAgent Sets Own Prices
**File:** `SubSubagentDashboard.tsx`, function `savePrices()`

```typescript
// SubSubagent wants to charge 5.50 for 1GB
newPrice = 5.50

// Validation: Must be >= cost from agent
if (5.50 < 4.80) throw error;  // ✅ Passes
```

### Step 7: Save SubSubAgent's Own Prices
```typescript
await supabase
  .from("sub_subagent_package_prices")
  .insert({
    subagent_store_id: "SubAgent_B_ID",
    sub_subagent_store_id: "SubSubagent1_ID",
    package_id: "pkg1",
    base_price: 4.80,  // What they pay the parent
    subagent_minimum_price: 5.50,  // Their cost
    sell_price: 5.50  // What they charge users
  });
```

### Step 8: Result
- **SubSubagent profit:** 5.50 - 4.80 = GH₵ 0.70 per 1GB
- **When user buys:** 5.50 goes to SubSubagent1
- **SubAgent B gets:** 4.80 
- **Agent A gets:** (whatever they negotiated with SubAgent B)

---

## Workflow #3: Admin Impersonating SubSubAgent

### Step 1: Admin Views SubSubAgent Session
**File:** `SubSubagentDashboard.tsx`, Lines 344-397

```typescript
if (user is in admin_users table) {
  // Admin impersonation detected
  // NOW FIXED: Fetch parent prices too!
  
  const parentPricesResult = await supabase
    .from("sub_subagent_package_prices")
    .select("package_id, base_price")
    .eq("subagent_store_id", store.subagent_store_id)
    .eq("sub_subagent_store_id", store.id);
}
```

### Step 2: Admin Sees Same Prices as User
- Before fix: Admin saw default prices (wrong!)
- After fix: Admin sees actual parent prices (correct!) ✅

### Step 3: Admin Can Debug Pricing
Admin can now verify:
- "Does this SubSubagent see the right cost?"
- "Are their margins correct?"
- "Did prices save properly?"

---

## Workflow #4: New SubSubAgent Registration Appears in Parent Dashboard

### Step 1: New SubSubAgent Registers on Storefront
**File:** `SubagentStorefront.tsx`
**New SubSubagent fills form and clicks "Register"**

### Step 2: Registration Saves to Database
```typescript
INSERT INTO sub_subagent_stores (
  user_id: "new_user_id",
  subagent_store_id: "SubAgent_B_ID",
  store_name: "My New Store",
  ...
)
```

### Step 3: Real-Time Listener Triggers ✅ (THIS WAS ADDED)
**File:** `SubagentDashboard.tsx`, Lines 386-406

```typescript
// Supabase detects: INSERT on sub_subagent_stores
// Filter matches: subagent_store_id = "SubAgent_B_ID"
// Listener fires: subagent-sub-subagents-${subagentStore.id}
// Callback runs: fetchData()

// Within 2-3 seconds:
// SubagentDashboard automatically refreshes
// New SubSubagent appears in dropdown!
```

### Step 4: SubAgent Can Set Prices Immediately
- No page refresh needed
- Dropdown shows new SubSubagent
- Can set prices right away ✅

---

## Complete Data Flow Diagram

```
AGENT DASHBOARD
↓
Sets agent_package_prices
├─ table: agent_package_prices
├─ what: User charges to customers
└─ example: pkg1 = GH₵ 10.00

AGENT SETS SUBAGENT PRICES
↓
Creates subagent_package_prices
├─ Columns: agent_store_id, subagent_store_id, base_price
├─ Example: A → B, base_price = GH₵ 4.50
└─ B now sees cost = GH₵ 4.50

SUBAGENT DASHBOARD
↓
Fetches:
├─ FROM: subagent_package_prices
├─ WHERE: agent_store_id=A AND subagent_store_id=B
├─ Sees: base_price = GH₵ 4.50 (cost from Agent)
└─ Display: "Your cost: GH₵ 4.50"

SUBAGENT SETS SUB-SUBAGENT PRICES
↓
Creates sub_subagent_package_prices
├─ Columns: subagent_store_id, sub_subagent_store_id, base_price
├─ Example: B → C, base_price = GH₵ 4.80
└─ C now sees cost = GH₵ 4.80

SUB-SUBAGENT DASHBOARD
↓
Fetches: ✅ (THIS WAS FIXED)
├─ FROM: sub_subagent_package_prices
├─ WHERE: subagent_store_id=B AND sub_subagent_store_id=C
├─ Sees: base_price = GH₵ 4.80 (cost from SubAgent)
└─ Display: "Your cost: GH₵ 4.80"

SUB-SUBAGENT CHARGES END USERS
↓
When user buys 1GB:
├─ End User pays: GH₵ 5.50
├─ SubSubagent keeps: GH₵ 5.50 - GH₵ 4.80 = GH₵ 0.70
├─ SubAgent B keeps: GH₵ 4.80 - GH₵ 4.50 = GH₵ 0.30
└─ Agent A keeps: GH₵ 4.50 - GH₵ 3.00 (base) = GH₵ 1.50
```

---

## Summary: What Was Fixed

### Fix #1: SubSubagentDashboard Query (Line 525)
**Before:**
```typescript
.select("package_id, sell_price")
.eq("sub_subagent_store_id", store.subagent_store_id)
```

**After:**
```typescript
.select("package_id, base_price")  // ✅ Correct column
.eq("subagent_store_id", store.subagent_store_id)  // ✅ Parent ID
.eq("sub_subagent_store_id", store.id)  // ✅ Child ID filter
```

**Impact:** SubSubagents now see correct cost from parent ✅

### Fix #2: Admin Impersonation Path
**Before:** Admin saw default prices (wrong!)
**After:** Admin sees actual parent prices (correct!) ✅

**Impact:** Admin debugging now works accurately ✅

### Fix #3: Real-Time Registration Listener
**Before:** New SubSubagents only appeared after manual refresh
**After:** Appear automatically within 2-3 seconds ✅

**Impact:** Seamless user experience ✅

---

## Testing the Workflow

### Test 1: SubAgent Sets Price for SubSubagent
1. Log in as SubAgent
2. Go to "Sub-Subagent Pricing"
3. Select a SubSubagent
4. Change a price
5. Click Save
6. ✅ Should see "Prices saved successfully"

### Test 2: SubSubagent Sees Correct Cost
1. Open SubSubagent Dashboard
2. Look at "Cost from Agent"
3. ✅ Should match price SubAgent set
4. Open browser console: `console.log(basePrices)`
5. ✅ Should show base_price values, not sell_price

### Test 3: New SubSubagent Appears
1. From storefront, register as new SubSubagent
2. Go to SubAgent Dashboard
3. ✅ New SubSubagent appears in dropdown (within 2-3 seconds)
4. ✅ Can set prices immediately

### Test 4: Admin Impersonation
1. Admin opens SubSubagent via impersonation
2. Prices shown ✅ Match what parent set
3. No 403 errors ✅
4. RLS policies working ✅
