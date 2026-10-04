# SubSubagent Fetch Diagnostic

## Question: Where is SubagentDashboard fetching newly registered SubSubAgents from?

### Answer: Line 478 of SubagentDashboard.tsx

```typescript
supabase.from("sub_subagent_stores")
  .select("*")
  .eq("subagent_store_id", store.id)
  .order("created_at", { ascending: false })
```

This query:
1. **Table:** `sub_subagent_stores` (not subagent_stores, not users)
2. **Filter:** `subagent_store_id = store.id` (only shows SubSubAgents under THIS SubAgent)
3. **Sorting:** By creation date (newest first)

---

## Critical Question: Where was your new SubSubAgent inserted?

### CORRECT Path (Storefront Registration):
1. Go to SubAgent's **public storefront** page
2. Click "Register as Sub-Subagent"
3. Fill form and submit
4. System inserts into `sub_subagent_stores` table with:
   - `subagent_store_id` = The SubAgent's ID ✅
   - `user_id` = The new user's ID
   - `store_name` = What they entered
   - `approved` = true (auto-approved)
5. Query at Line 478 finds it ✅

### INCORRECT Path (If it doesn't show):
- If you registered them from somewhere else without setting `subagent_store_id`
- If the table doesn't have a `subagent_store_id` column (RLS issue)
- If the filter is wrong (looking at wrong subagent_store_id)

---

## How to Verify:

### Step 1: Check if SubSubAgent was inserted correctly
```sql
SELECT * FROM sub_subagent_stores
WHERE subagent_store_id = '[YOUR_SUBAGENT_ID]'
ORDER BY created_at DESC;
```

**Result should show:** Your newly registered SubSubAgent with the correct `subagent_store_id`

### Step 2: Check if SubagentDashboard is using correct subagent_store_id
- Log in as SubAgent
- Open browser console
- Look for logs: `[v0] Loaded store:` should show your SubAgent's ID
- Check if that ID matches what's in the database

### Step 3: Check RLS Policies
- Is there an RLS policy blocking the read?
- Does the authenticated user have permission to read `sub_subagent_stores`?

---

## The Complete Fetch Flow:

### When SubagentDashboard loads:

1. **Line 568-571:** Query SubAgent store by user_id
   ```typescript
   .from("subagent_stores")
   .eq("user_id", effectiveUserId)  // User must own this store
   ```
   Result: Gets THIS SubAgent's store info

2. **Line 478:** Query all SubSubAgents under THIS SubAgent
   ```typescript
   .from("sub_subagent_stores")
   .eq("subagent_store_id", store.id)  // Get SubSubAgents of THIS SubAgent
   ```
   Result: Gets all SubSubAgents

3. **Line 488-489:** Store SubSubAgents in state
   ```typescript
   const subSubagentsData = subSubagentsResult.data || [];
   setSubSubagents(subSubagentsData);
   ```

---

## Real-Time Listener Added:

```typescript
// Line 386-406: Listens for new registrations
const subSubagentChannel = supabase
  .channel(`subagent-sub-subagents-${subagentStore.id}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",  // Listen for NEW registrations
      schema: "public",
      table: "sub_subagent_stores",
      filter: `subagent_store_id=eq.${subagentStore.id}`,  // Only THIS SubAgent's
    },
    () => {
      console.log("[v0] New sub-subagent registered, refreshing list...");
      fetchData();  // Auto-refresh dashboard
    }
  )
  .subscribe();
```

This listener auto-refreshes within 2-3 seconds when new registration is detected.

---

## Troubleshooting Checklist:

### If new SubSubAgent doesn't show up:

[ ] **Check 1:** Did you register from the SubAgent's PUBLIC storefront?
   - Get the storefront URL from SubAgent's dashboard
   - Make sure you're registering as a SubSubAgent (not a SubAgent)

[ ] **Check 2:** Is the `subagent_store_id` correct in the database?
   ```sql
   SELECT id, subagent_store_id, store_name, created_at 
   FROM sub_subagent_stores 
   LIMIT 5;
   ```

[ ] **Check 3:** Is the SubAgent looking at the correct subagent_store_id?
   - Log in as SubAgent
   - Check browser console for: `[v0] Loaded store: [STORE_NAME] with id: [ID]`
   - Verify that ID matches the subagent_store_id in database

[ ] **Check 4:** Is the query returning results?
   - Add console.log: `console.log("[v0] subSubagentsResult:", subSubagentsResult.data);`
   - See if the data comes back

[ ] **Check 5:** Are RLS policies preventing the read?
   - Check `pg_policies` table for `sub_subagent_stores` policies
   - Verify authenticated user can SELECT

---

## The Exact Table Structure:

`sub_subagent_stores` table should have:
- `id` (UUID, primary key)
- `subagent_store_id` (UUID, foreign key) ← **CRITICAL FOR FILTERING**
- `user_id` (UUID, who owns this store)
- `store_name` (text)
- `approved` (boolean)
- `created_at` (timestamp)
- Other fields (momo_number, etc.)

The query on **Line 478** filters by `subagent_store_id`, so this column MUST exist and be populated correctly.

---

## Summary:

**Where SubSubAgents are fetched from:**
- **Table:** `sub_subagent_stores`
- **Filter:** `subagent_store_id = [current subagent's ID]`
- **Query:** Line 478 of SubagentDashboard.tsx
- **Auto-refresh:** Lines 386-406 (real-time listener)

**Where they are inserted:**
- **Only place:** SubSubagentRegistrationForm.tsx, Line 235-250
- **Must have:** `subagent_store_id` set to the SubAgent's ID
- **Must happen:** Via public storefront registration

If new SubSubAgents don't show up, check:
1. Are they being inserted into the right table with the right `subagent_store_id`?
2. Is the SubAgent using the correct dashboard (not admin impersonation)?
3. Are RLS policies allowing the read?
