# Recipient Query Fix - Using user_id Instead of Store ID

## Problem
The transfer_recipients table stores recipients by `user_id`, not by store ID. The previous queries were filtering by `agent_store_id` and `subagent_store_id`, which would never return any results.

## Solution
Updated both dashboards to query recipients using the logged-in user's ID.

## Changes Made

### AgentDashboard.tsx (Line 697)
**Before:**
```typescript
supabase.from("transfer_recipients").select("*").eq("agent_store_id", sd.id).eq("is_active", true).order("created_at", { ascending: false })
```

**After:**
```typescript
supabase.from("transfer_recipients").select("*").eq("user_id", effectiveUserId).eq("status", "active").order("created_at", { ascending: false })
```

### SubagentDashboard.tsx (Line 518)
**Before:**
```typescript
supabase.from("transfer_recipients").select("*").eq("subagent_store_id", store.id).eq("is_active", true).order("created_at", { ascending: false })
```

**After:**
```typescript
supabase.from("transfer_recipients").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false })
```

## Key Updates
1. Changed filter from store ID to `user_id`
2. Changed status filter from `is_active` to `status` (matching actual table column)
3. Both agents and subagents now query recipients by their user ID
4. Recipients display correctly based on the logged-in user

## Result
Users will now see all their saved recipients (bank accounts and mobile money) when they access the withdrawal form. Recipients are tied to the user account, not the store.
