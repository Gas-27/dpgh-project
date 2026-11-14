# SubAgent → SubSubAgent Architecture Reference

## Complete Data Flow - Agent → SubAgent → SubSubAgent

### Three-Tier Hierarchy

```
Agent Store (e.g., "DataPlug Ghana")
  ↓
  └─ SubAgent Store 1 (e.g., "Kofi's Data Shop")
      ↓
      └─ SubSubAgent Store 1a (e.g., "Nana's Mobile Data")
      └─ SubSubAgent Store 1b (e.g., "Kwame's Internet Café")
  
  └─ SubAgent Store 2 (e.g., "Ama's Teledata")
      ↓
      └─ SubSubAgent Store 2a
```

---

## Price Hierarchy

### 1. **Agent → SubAgent Pricing**

**Agent Sets:** Agent's cost price for packages (what agent pays the platform)
- Table: `data_packages`
- Column: `agent_price` (or overridden by `agent_custom_base_prices`)
- Example: MTN 1GB = GH₵ 4.10

**Agent Sets:** Base price for subagents (what subagent costs to agent)
- Table: `subagent_package_prices`
- Columns: `agent_store_id`, `package_id`, `base_price`
- Example: Subagent pays GH₵ 4.30 per 1GB
- Query: `WHERE agent_store_id = agent.id`

**SubAgent Sets:** Their selling price to customers
- Table: `agent_package_prices` (called "subagent_package_prices" in SubagentDashboard)
- Columns: `subagent_store_id`, `package_id`, `sell_price`
- Example: SubAgent sells 1GB for GH₵ 4.50 to customers
- Query: `WHERE subagent_store_id = subagent.id`

**SubAgent Profit:** `sell_price - base_price` = GH₵ 4.50 - GH₵ 4.30 = GH₵ 0.20

---

### 2. **SubAgent → SubSubAgent Pricing** (THE COMPLEX PART)

**SubAgent Sets:** Base price for each sub-subagent (what each sub-subagent costs subagent)
- Table: `sub_subagent_package_prices`
- Columns: `subagent_store_id` (parent), `sub_subagent_store_id` (child), `package_id`, `base_price`
- Example: SubAgent sets specific prices for Nana's Sub-Sub: 1GB = GH₵ 4.40
- Query: `WHERE subagent_store_id = subagent.id AND sub_subagent_store_id = specific_subsubagent.id`

**SubSubAgent Sets:** Their selling price to customers
- Table: `sub_subagent_package_prices`
- Columns: `sub_subagent_store_id`, `package_id`, `sell_price`
- Example: Sub-Subagent sells 1GB for GH₵ 4.65 to customers
- Query: `WHERE sub_subagent_store_id = subsubagent.id`

**SubSubAgent Profit:** `sell_price - base_price` = GH₵ 4.65 - GH₵ 4.40 = GH₵ 0.25

**SubAgent Profit:** `base_price_set_for_subsubagent - cost_to_subagent` = GH₵ 4.40 - GH₵ 4.30 = GH₵ 0.10

---

## Database Tables - The Complete Schema

### `sub_subagent_package_prices`
```
id                        | UUID (Primary Key)
subagent_store_id         | UUID - WHO is setting the price (the parent subagent)
sub_subagent_store_id     | UUID - WHO is this price for (the child sub-subagent)
package_id                | UUID - Which package
base_price                | DECIMAL - What parent charges child (CRITICAL)
subagent_minimum_price    | DECIMAL - Optional: Minimum floor price
sell_price                | DECIMAL - What sub-subagent charges customers
created_at                | TIMESTAMP
updated_at                | TIMESTAMP
```

**Key Insight:** This table has TWO ID columns because it's a many-to-many relationship:
- One subagent can set prices for MANY sub-subagents
- Each sub-subagent can have prices set by only ONE subagent (parent)

---

## Code Implementation

### SubAgentDashboard.tsx
```typescript
// Line 3212: Tab for managing sub-subagent prices
<TabsContent value="sub-subagent-pricing" className="space-y-4 mt-0">
  {/* User selects which sub-subagent to manage */}
  <Select value={selectedSubSubagentId || ""} onValueChange={setSelectedSubSubagentId}>
    <SelectTrigger className="w-full max-w-xs">
      <SelectValue placeholder="Choose a sub-subagent" />
    </SelectTrigger>
    <SelectContent>
      {subSubagents.map(subsubagent => (
        <SelectItem key={subsubagent.id} value={subsubagent.id}>
          {subsubagent.store_name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* User sets prices for selected sub-subagent */}
  {selectedSubSubagentId && (
    <SubSubagentPricesManager
      subagentStoreId={subagentStore?.id}           // Who is setting (parent)
      selectedSubSubagentId={selectedSubSubagentId} // Who is it for (child)
      packages={packages}
      subagentPrices={subagentPrices}               // What subagent is selling at
      onPricesSaved={() => fetchData()}             // Refresh after save
    />
  )}
</TabsContent>
```

### SubSubagentPricesManager.tsx
```typescript
// Fetch what subagent has already set for this specific sub-subagent
const { data } = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", subagentStoreId)         // Parent ID
  .eq("sub_subagent_store_id", selectedSubSubagentId); // Child ID

// When saving, delete old + insert new
await supabase
  .from("sub_subagent_package_prices")
  .delete()
  .eq("subagent_store_id", subagentStoreId)
  .eq("sub_subagent_store_id", selectedSubSubagentId)
  .eq("package_id", packageId);

await supabase
  .from("sub_subagent_package_prices")
  .insert({
    subagent_store_id: subagentStoreId,
    sub_subagent_store_id: selectedSubSubagentId,
    package_id: packageId,
    base_price: price  // ← CRITICAL: What parent charges child
  });
```

### SubSubagentDashboard.tsx
```typescript
// Fetch what parent set for THIS sub-subagent
const parentPricesResult = store.subagent_store_id 
  ? supabase
    .from("sub_subagent_package_prices")
    .select("package_id, base_price")           // Get what parent set
    .eq("subagent_store_id", store.subagent_store_id)  // Parent ID
    .eq("sub_subagent_store_id", store.id)     // THIS child ID
  : Promise.resolve({ data: null, error: null });

// Build base prices from parent's custom prices
const basePriceMap: Record<string, number> = {};

// First set all to default
(packagesResult.data || []).forEach((p: any) => {
  basePriceMap[p.id] = p.price;
});

// Then override with parent's prices
(parentPricesResult.data || []).forEach((p: any) => {
  if (p.base_price !== null && p.base_price !== undefined) {
    basePriceMap[p.package_id] = Number(p.base_price);  // ← Use parent's price
  }
});

setBasePrices(basePriceMap);
```

---

## Real-Time Synchronization

### When Sub-Subagent Registers
SubAgentDashboard now automatically refreshes:
```typescript
// Listen for new sub-subagent registrations
const subSubagentChannel = supabase
  .channel(`subagent-sub-subagents-${subagentStore.id}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "sub_subagent_stores",
      filter: `subagent_store_id=eq.${subagentStore.id}`,
    },
    () => {
      console.log("[v0] New sub-subagent registered, refreshing list...");
      fetchData();  // ← Automatically shows new sub-subagent
    }
  )
  .subscribe();
```

---

## Query Patterns Summary

### SubAgent Managing Sub-Subagent Prices
```sql
-- Read current prices for one sub-subagent
SELECT package_id, base_price 
FROM sub_subagent_package_prices
WHERE subagent_store_id = '<subagent_id>'
AND sub_subagent_store_id = '<subsubagent_id>';

-- Write new price
INSERT INTO sub_subagent_package_prices 
(subagent_store_id, sub_subagent_store_id, package_id, base_price, ...)
VALUES ('<subagent_id>', '<subsubagent_id>', '<package_id>', 4.40, ...);
```

### Sub-Subagent Reading Their Cost Price
```sql
-- What did my parent charge me?
SELECT package_id, base_price 
FROM sub_subagent_package_prices
WHERE subagent_store_id = '<my_parent_subagent_id>'
AND sub_subagent_store_id = '<my_store_id>';
```

### Admin Viewing Sub-Subagent's Prices
```sql
-- Same query as above - uses store_id not user_id
-- This is why we fixed the admin impersonation path
```

---

## Key Differences from Agent → SubAgent

| Aspect | Agent → SubAgent | SubAgent → SubSubAgent |
|--------|-----------------|----------------------|
| **Price Table** | `subagent_package_prices` | `sub_subagent_package_prices` |
| **Parent ID Column** | `agent_store_id` | `subagent_store_id` |
| **Child ID Column** | N/A (implicit in subagent_store_id) | `sub_subagent_store_id` |
| **Base Price Column** | `base_price` | `base_price` |
| **UI Component** | `SubagentPricesManager` | `SubSubagentPricesManager` |
| **Dashboard** | `AgentDashboard` | `SubagentDashboard` |
| **Recipient Dashboard** | `SubagentDashboard` | `SubSubagentDashboard` |
| **Selection Required** | NO (one store per agent) | YES (one subagent has many sub-subagents) |

---

## The Bug That Was Fixed

The bug was that line 452 in SubSubagentDashboard.tsx didn't properly filter parent prices:

### ❌ BEFORE (WRONG)
```typescript
supabase.from("sub_subagent_package_prices")
  .select("package_id, sell_price")  // WRONG: sell_price is what sub-subagent charges
  .eq("sub_subagent_store_id", store.subagent_store_id)  // WRONG: Missing sub_subagent_store_id filter
```

### ✅ AFTER (CORRECT)
```typescript
supabase.from("sub_subagent_package_prices")
  .select("package_id, base_price")  // CORRECT: base_price is what parent charges
  .eq("subagent_store_id", store.subagent_store_id)  // Parent ID
  .eq("sub_subagent_store_id", store.id)  // THIS child's ID
```

---

## Testing the Fix

1. **Create test data:**
   - Subagent: "Kofi's Data"
   - Sub-Subagent: "Nana's Shop" (registered under Kofi)

2. **SubAgent sets prices for Sub-Subagent:**
   - Go to SubagentDashboard → Sub-Subagent Pricing
   - Select "Nana's Shop"
   - Set 1GB = GH₵ 4.40
   - Click Save

3. **Sub-Subagent sees the price:**
   - Log in as Sub-Subagent (Nana)
   - View SubSubagentDashboard
   - "Your Cost Price" for 1GB should be GH₵ 4.40 (not default)
   - Set selling price to GH₵ 4.65
   - Profit = GH₵ 0.25

4. **Admin can see same thing:**
   - Admin impersonates Sub-Subagent
   - Sees same "Your Cost Price" = GH₵ 4.40

5. **New registration auto-refreshes:**
   - Keep SubagentDashboard open
   - Register new Sub-Subagent on storefront
   - Within 2-3 seconds, new one appears in dashboard list

