# Complete SubAgent → SubSubAgent Pricing Architecture Fix

## PATTERN DISCOVERED: The Exact Logic

### Agent → SubAgent (WORKING)
1. **AgentDashboard (fetchAllData)**
   - Fetches from `subagent_package_prices` table
   - Query: `.eq("agent_store_id", sd.id)` - gets all base prices agent set for all subagents
   - Stores in `subagentBasePrices` state variable

2. **SubagentPricesManager Component**
   - Takes `agentStoreId` as prop
   - Fetches from `subagent_package_prices` WHERE `agent_store_id = agentStoreId`
   - Saves to `subagent_package_prices` table with `agent_store_id`
   - Column used: `base_price` (what agent charges subagent)

3. **SubagentDashboard (fetchData)**
   - Query: `.eq("agent_store_id", store.agent_store_id)` line 597
   - Reads `base_price` from `subagent_package_prices`
   - This becomes the basePrices for the subagent
   - Subagent then sets their own sell_price above this base

---

## THE BUG: SubAgent → SubSubAgent (BROKEN)

### What's Wrong:
1. SubagentDashboard tries to manage sub-subagent prices with OLD UI (line 3212) 
2. It doesn't select WHICH sub-subagent to set prices for
3. SubagentPricesManager saves only 3 fields, missing `sub_subagent_store_id`
4. SubSubagentDashboard fetches parent prices with WRONG column (`sell_price` instead of `base_price`)
5. SubSubagentDashboard line 452 uses WRONG query - not filtering by `sub_subagent_store_id`

---

## THE FIX: Apply Exact Same Pattern

### Table Schema Required:
```
sub_subagent_package_prices
- subagent_store_id (WHO is setting the price - the parent)
- sub_subagent_store_id (WHO is this price for - the child)
- package_id 
- base_price (what parent charges this sub-subagent)
- subagent_minimum_price (optional)
- sell_price (what sub-subagent charges customers)
```

### SubagentDashboard Changes:
1. Add dropdown to SELECT which sub-subagent to edit
2. Pass `selectedSubSubagentId` to SubSubagentPricesManager component
3. Use the rewritten SubSubagentPricesManager

### SubSubagentPricesManager Changes (NEW COMPONENT - Mirror of SubagentPricesManager):
```
Props:
- subagentStoreId: string (who is setting it)
- selectedSubSubagentId: string (who is it for)
- packages: array
- subagentPrices: record of what subagent is currently selling at

Save Logic:
1. Delete from `sub_subagent_package_prices` WHERE subagent_store_id = subagentStoreId AND sub_subagent_store_id = selectedSubSubagentId AND package_id = packageId
2. Insert with BOTH IDs and base_price

Fetch Logic:
1. Query: `sub_subagent_package_prices.select("package_id, base_price").eq("subagent_store_id", subagentStoreId).eq("sub_subagent_store_id", selectedSubSubagentId)`
```

### SubSubagentDashboard Changes:
1. Change line 514 query from `sell_price` to `base_price`
2. Query should be: `.select("package_id, base_price").eq("subagent_store_id", store.subagent_store_id).eq("sub_subagent_store_id", store.id)`
3. Read `p.base_price` when building basePriceMap, not `p.sell_price`

### SubagentDashboard.tsx - Sub-SubAgent Registration Issue:
- When sub-subagent registers, SubagentDashboard needs to call `fetchData()` to refresh the sub-subagents list
- The registration endpoint should work, but SubagentDashboard's refresh might not be wired up

---

## QUERY COMPARISON

### AGENT → SUBAGENT (Correct):
```sql
-- Agent sets base prices for all subagents
SELECT * FROM subagent_package_prices 
WHERE agent_store_id = 'agent-123'

-- Subagent reads their base price
SELECT * FROM subagent_package_prices 
WHERE agent_store_id = 'agent-123' 
  AND subagent_store_id = 'subagent-456'
```

### SUBAGENT → SUBSUBAGENT (What we need):
```sql
-- Subagent sets base prices for all sub-subagents
SELECT * FROM sub_subagent_package_prices 
WHERE subagent_store_id = 'subagent-456'

-- Subagent edits specific sub-subagent price
SELECT * FROM sub_subagent_package_prices 
WHERE subagent_store_id = 'subagent-456' 
  AND sub_subagent_store_id = 'subsubagent-789'

-- SubSubagent reads their parent's price
SELECT * FROM sub_subagent_package_prices 
WHERE subagent_store_id = 'subagent-456' 
  AND sub_subagent_store_id = store.id
```

---

## Files to Fix (In Order):

1. **SubSubagentPricesManager.tsx** - Rewrite to mirror SubagentPricesManager exactly
2. **SubagentDashboard.tsx** - Replace old sub-subagent-pricing tab with selector + component
3. **SubSubagentDashboard.tsx** - Fix parent price fetch query (line 514) and basePriceMap logic
4. **Test** - Verify sub-subagent registration appears immediately in SubagentDashboard

