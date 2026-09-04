# Debugging Why Sub-Subagents Don't Show in Dropdown

## The Problem
The Sub-Subagent Pricing tab shows "You don't have any sub-subagents yet" even though sub-subagents may have registered.

## Root Cause Analysis

### Possible Causes:
1. **No sub-subagents in database** - They never registered
2. **Wrong subagent_store_id** - They registered with incorrect parent ID
3. **RLS Policy blocking read** - Security policy prevents access
4. **Query filtering wrong** - The query uses wrong filter

## How to Debug

### Step 1: Check Browser Console
1. Open SubAgent Dashboard
2. Go to "Sub-Sub-Agent Pricing" tab
3. Open Dev Tools (F12)
4. Look for console.log that shows:
   ```
   [v0] SubagentDashboard fetchData - subSubagents fetched: {
     count: ?,
     subagentStoreId: "???",
     data: [...]
   }
   ```

### Step 2: Check Database Directly
Run the SQL query in `check-subsubagents.sql` to see:
- All sub-subagents in the system
- Their `subagent_store_id` values
- Your current subagent's ID

**Compare:**
- Your Subagent ID from dashboard = ?
- Sub-subagent's subagent_store_id = ?
- Do they match? YES/NO

### Step 3: Verify Registration Flow
When sub-subagent registers on storefront:
1. They should see dropdown with your subagent's name
2. When they submit form, it should save with your subagent_store_id
3. Check SubSubagentRegistrationForm.tsx line 237 - is subagentStoreId being passed correctly?

### Step 4: Check RLS Policies
If query returns 0 results even though data exists in DB:
- Check RLS policy on `sub_subagent_stores` table
- Does policy allow reading rows where subagent_store_id matches current_user_id?

## What the Query Should Do

```typescript
// Line 523:
supabase
  .from("sub_subagent_stores")
  .select("*")
  .eq("subagent_store_id", store.id)  // YOUR subagent's ID
  .order("created_at", { ascending: false })
```

This fetches ALL sub-subagents where:
- subagent_store_id = Your current SubAgent ID
- Ordered by newest first

## Next Steps
1. Check browser console for debug log
2. Run SQL query to verify data
3. Compare IDs - do they match?
4. If no data in DB, sub-subagents never registered
5. If data exists but not showing, check RLS or query
