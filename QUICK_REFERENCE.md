# Quick Reference - SubAgent → SubSubAgent Fixes

## TL;DR - What Was Fixed

### Bug #1: SubSubagentDashboard reading wrong parent prices
- **File:** `SubSubagentDashboard.tsx`
- **Line:** 452
- **Was:** Using `sell_price` column (wrong) and not filtering by `sub_subagent_store_id`
- **Now:** Uses `base_price` column (correct) and filters by BOTH `subagent_store_id` AND `sub_subagent_store_id`
- **Impact:** Sub-subagents now see correct cost prices from their parent

### Bug #2: Admin impersonation missing parent prices
- **File:** `SubSubagentDashboard.tsx`
- **Lines:** 360-397
- **Was:** Admin path didn't fetch parent prices at all
- **Now:** Added parent price query to admin path (matching normal flow)
- **Impact:** Admin sees same data as actual user

### Bug #3: New sub-subagents not appearing in parent's dashboard
- **File:** `SubagentDashboard.tsx`
- **Lines:** 386-406
- **Was:** No real-time listener for new registrations
- **Now:** Added Supabase real-time subscription for INSERT events
- **Impact:** New registrations appear instantly in parent's dashboard

---

## The Three Queries You Need to Know

### Query 1: SubAgent reading sub-subagent prices they set
```typescript
const { data } = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", subagentStore.id);
  // Returns: ALL prices subagent set for ALL their sub-subagents
```

### Query 2: SubAgent reading prices for ONE sub-subagent
```typescript
const { data } = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", subagentStore.id)
  .eq("sub_subagent_store_id", selectedSubSubagentId);
  // Returns: Prices set for this specific child
```

### Query 3: Sub-Subagent reading parent's prices for them
```typescript
const { data } = await supabase
  .from("sub_subagent_package_prices")
  .select("package_id, base_price")
  .eq("subagent_store_id", store.subagent_store_id)  // Parent ID
  .eq("sub_subagent_store_id", store.id);            // My ID
  // Returns: What my parent charges me
```

---

## The Three Tables You Need to Know

| Table | What It Stores | Parent ID Column | Child ID Column |
|-------|---|---|---|
| `subagent_package_prices` | What agent charges subagent | `agent_store_id` | (implicit) |
| `sub_subagent_package_prices` | What subagent charges sub-subagent | `subagent_store_id` | `sub_subagent_store_id` |
| `sub_subagent_package_prices` | What sub-subagent charges customers | N/A (filtered by `sub_subagent_store_id`) | `sell_price` column |

---

## The Exact Fix (Copy-Paste)

### In SubSubagentDashboard.tsx around line 452
Change:
```typescript
supabase.from("sub_subagent_package_prices").select("package_id, sell_price").eq("sub_subagent_store_id", store.subagent_store_id)
```

To:
```typescript
supabase.from("sub_subagent_package_prices").select("package_id, base_price").eq("subagent_store_id", store.subagent_store_id).eq("sub_subagent_store_id", store.id)
```

---

## Testing Checklist

- [ ] Subagent can set prices for sub-subagent → prices save
- [ ] Sub-subagent sees those prices as "Your Cost Price"
- [ ] Admin impersonation shows same prices
- [ ] New sub-subagent registration auto-appears in parent's list
- [ ] Price changes immediately reflect in all dashboards

---

## Debug Logs to Watch

```bash
# In browser console:
[v0] New sub-subagent registered, refreshing list...
# = Real-time listener worked
```

---

## Most Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Sub-subagent sees wrong cost price | Wrong parent price query | Use `base_price` column |
| Sub-subagent sees default price instead of custom | Not filtering by `sub_subagent_store_id` | Add second WHERE clause |
| Admin sees different prices than user | Admin path missing parent fetch | Add parent price query to admin section |
| New registration not showing in list | No real-time listener | Subscribe to INSERT events |
| Can't set prices for sub-subagent | No selector for which sub-subagent | Use the dropdown to select first |

---

## File Changes Summary

```
SubSubagentDashboard.tsx
├─ Line 452: Fixed parent price query
├─ Lines 360-397: Fixed admin impersonation path  
├─ Lines 536-541: Added parent prices to basePriceMap

SubagentDashboard.tsx
├─ Line 386-406: Added real-time listener for sub-subagent INSERT

SubSubagentPricesManager.tsx
└─ (No changes - already correct)
```

---

## The Payment Model (For Reference)

```
Customer buys from Sub-Subagent:
├─ Customer pays: GH₵ 4.65 (Sub-Subagent's selling price)
├─ Sub-Subagent pays Subagent: GH₵ 4.40 (Base price Subagent set)
├─ Sub-Subagent profit: 4.65 - 4.40 = GH₵ 0.25
│
├─ Subagent pays Agent: GH₵ 4.30 (Base price Agent set)
├─ Subagent profit: 4.40 - 4.30 = GH₵ 0.10
│
└─ Agent pays Platform: GH₵ 4.10 (Base platform price)
   └─ Agent profit: 4.30 - 4.10 = GH₵ 0.20
```

All prices auto-calculate. No manual intervention needed after initial pricing.
