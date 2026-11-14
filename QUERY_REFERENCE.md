# Query Reference: Agent→SubAgent vs SubAgent→SubSubAgent

## How Agent Sets Prices for SubAgent (Working Pattern)

### Agent Dashboard - Saves prices for subagents:
```typescript
// SubagentPricesManager.tsx
const { error } = await supabase
  .from("subagent_package_prices")
  .insert({
    agent_store_id: agentStoreId,      // WHO is setting the price
    package_id: packageId,              // WHICH package
    base_price: price                   // THE PRICE
  });
```

### SubAgent Dashboard - Fetches prices from agent:
```typescript
// SubagentDashboard.tsx (line 453)
const { data, error } = await supabase
  .from("subagent_package_prices")
  .select("package_id, base_price")
  .eq("agent_store_id", store.agent_store_id);  // Get MY parent's prices

// Then use it:
(agentSubagentPricesResult.data || []).forEach((p: any) => {
  if (p.base_price !== null && p.base_price !== undefined) {
    agentSubagentPriceMap[p.package_id] = Number(p.base_price);  // Use base_price
  }
});
```

---

## How SubAgent Should Set Prices for SubSubAgent (NOW FIXED)

### SubAgent Dashboard - Saves prices for sub-subagents:
```typescript
// SubSubagentPricesManager.tsx
const { error } = await supabase
  .from("sub_subagent_package_prices")
  .insert({
    subagent_store_id: subagentStoreId,           // WHO is setting the price
    sub_subagent_store_id: selectedSubSubagentId, // FOR WHOM
    package_id: packageId,                        // WHICH package
    base_price: price                             // THE PRICE
  });
```

### SubSubAgent Dashboard - Fetches prices from subagent:
```typescript
// SubSubagentDashboard.tsx (line 514 - FIXED)
const { data, error } = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", store.subagent_store_id)      // Get MY parent's prices
  .eq("sub_subagent_store_id", store.id);                // Specifically FOR ME

// Then use it:
(parentPricesResult.data || []).forEach((p: any) => {
  if (p.base_price !== null && p.base_price !== undefined) {
    basePriceMap[p.package_id] = Number(p.base_price);   // Use base_price (FIXED)
  }
});
```

---

## The Key Insight

Both follow the exact same pattern:

1. **Who sets the price** - Identified by their store_id in the first filter
2. **Who it's for** - Second filter for sub-subagent (if needed)
3. **The column** - Always read `base_price` for "what they charge me"
4. **What's allowed** - Sub-subagent must set prices ≥ base_price

---

## Common Query Structure

```typescript
// General pattern for fetching "Cost from My Parent"
WHERE {parent_id_column} = my_parent_store_id
AND {my_id_column} = my_store_id (if applicable)
SELECT base_price  // Always use base_price for cost
```

---

## RLS Policy Structure (Database Level)

Both tables use the same policy pattern:

```sql
-- For agent_store_id based queries
CREATE POLICY "agents_can_set_subagent_prices" ON subagent_package_prices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM agent_stores WHERE id = agent_store_id AND user_id = auth.uid())
  );

-- For subagent_store_id based queries
CREATE POLICY "subagents_can_set_sub_subagent_prices" ON sub_subagent_package_prices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM subagent_stores WHERE id = subagent_store_id AND user_id = auth.uid())
  );
```

---

## Testing Queries

### To verify SubAgent set prices for specific SubSubAgent:
```sql
SELECT * FROM sub_subagent_package_prices
WHERE subagent_store_id = '{subagent_id}'
AND sub_subagent_store_id = '{sub_subagent_id}';
```

### To verify SubSubAgent can see what parent set:
```sql
SELECT * FROM sub_subagent_package_prices
WHERE subagent_store_id = '{their_parent_id}'
AND sub_subagent_store_id = '{their_id}';
```

### To verify SubSubAgent's own prices:
```sql
SELECT * FROM sub_subagent_package_prices
WHERE sub_subagent_store_id = '{their_id}'
ORDER BY package_id;
```

---

## Why This Pattern Works

1. **Clarity** - Always clear who is setting and who it's for
2. **Scalability** - Extends easily to more levels (e.g., SubSubSubAgent)
3. **Performance** - Indexes on foreign keys make filtering fast
4. **Security** - RLS policies can validate the relationship
5. **Multi-select** - Easy to update multiple at once
6. **Flexibility** - Can set different prices for different recipients
