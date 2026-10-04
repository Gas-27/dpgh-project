# Complete Subagent System Implementation Guide

## Overview
The DataPlug Subagent System is now fully implemented with automatic approval, seamless integration, and comprehensive admin controls. Subagents work under agents and can earn revenue by selling data packages.

## Key Features Implemented

### 1. Agent Dashboard - Subagents Tab
- **Location:** Agent Dashboard → Subagents Tab
- **Features:**
  - Toggle to enable/disable "Become a Subagent" button on storefront
  - View minimum pricing requirements for all data packages
  - See subagent registration settings

### 2. Agent Storefront - Subagent Registration
- **Appearance:** Shows when agent enables subagent registration
- **Form Fields:**
  - Email address
  - Password (min 6 characters)
  - Store name
  - Support contact number
  - WhatsApp number
  - MoMo account name
  - MoMo phone number
  - MoMo network (MTN, AirtelTigo, Telecel)
- **Post-Registration:** User automatically redirected to SubagentDashboard
- **Approval:** Automatic (no manual approval needed)

### 3. Subagent Dashboard
- **Routes:** `/subagent`
- **Tabs:**
  - Overview: Revenue, pending orders, store info
  - Orders: View customer purchases
  - Withdrawals: Request money withdrawals (no topup section)
  - Settings: Store details and preferences
- **Access:** Only accessible to users with "subagent" role
- **Revenue:** Tracked in wallet_balance

### 4. Admin Dashboard - Subagents Tab
- **Display:** Shows all subagents with:
  - Store name (prominent)
  - Parent agent they're linked to
  - Revenue earned (wallet_balance)
  - WhatsApp and support contacts
  - MoMo account details
  - Status (All shown as "Active" - auto-approved)
- **Features:**
  - Search functionality for quick lookup
  - Clean, organized card-based display
  - No manual approval/suspension (automatic)

## Database Tables

### subagent_stores
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Link to auth.users (unique) |
| agent_store_id | uuid | Parent agent reference |
| store_name | text | Subagent's store name |
| whatsapp_number | text | Customer support WhatsApp |
| support_number | text | Customer support phone |
| whatsapp_group | text | Optional WhatsApp group link |
| momo_number | text | MoMo phone for payouts |
| momo_name | text | MoMo account holder name |
| momo_network | text | 'mtn', 'airteltigo', or 'telecel' |
| wallet_balance | numeric | Revenue earned (default 0) |
| approved | boolean | **DEFAULT TRUE** (auto-approved) |
| allow_registration | boolean | Can register sub-subagents (future) |
| created_at | timestamp | Account creation time |

### subagent_package_prices
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| subagent_store_id | uuid | Foreign key to subagent_stores |
| package_id | uuid | Data package reference |
| agent_minimum_price | numeric | Minimum selling price |
| sell_price | numeric | Subagent's selling price |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

### Modified Tables
- **orders:** Added `subagent_store_id` column (nullable)
- **wallet_topups:** Added `subagent_store_id` column
- **withdrawal_requests:** Added `subagent_store_id` column
- **agent_stores:** Added `allow_subagent_registration` column (boolean, default false)

## User Roles & Permissions

### New Role: "subagent"
- Can access SubagentDashboard
- Can view/manage own store
- Can process customer orders
- Can request withdrawals
- Cannot do topups (earn-only model)
- Auto-approved on creation

### Existing Roles - Updates
- **Agent:** Can now:
  - Toggle subagent registration on/off
  - View subagent pricing requirements
  - Monitor subagents (via admin if admin role)
- **Admin:** Can now:
  - View all subagents tab in dashboard
  - See subagent details and revenue
  - Monitor subagent accounts
  - View parent agent relationships

## Row Level Security (RLS) Policies

### subagent_stores
- Subagents can view/manage their own store only
- Agents can view subagents linked to their stores
- Admins can view all subagents
- Insert policy validates parent agent allows registration

### subagent_package_prices
- Subagents can manage prices for their own store
- Agents can view subagent pricing
- Admins have full access
- Constraint ensures sell_price >= agent_minimum_price

### orders, wallet_topups, withdrawal_requests
- Subagents can view/create only their own records
- Agents can view subagent records
- Admins have full access

## API Integration

### Automatic Flows
1. **Subagent Registration:**
   - User fills form → System creates auth.users account
   - System creates subagent_stores record (approved=true)
   - User redirected to /subagent dashboard
   - No email confirmation needed

2. **Order Processing:**
   - Customer orders from subagent storefront
   - Order recorded with subagent_store_id
   - Revenue added to subagent wallet_balance

3. **Withdrawal:**
   - Subagent requests withdrawal
   - Admin approves (manual process)
   - Funds transferred to MoMo

## File Changes Summary

### New Files Created
- `/src/pages/SubagentDashboard.tsx` - Subagent user dashboard
- `/src/components/SubagentRegistrationForm.tsx` - Inline registration form
- `/supabase/migrations/20260516000000_add_subagent_system.sql` - Database schema

### Files Modified
- `/src/pages/AgentDashboard.tsx` - Added Subagents management tab
- `/src/pages/AgentStorefront.tsx` - Added subagent registration section
- `/src/pages/AdminDashboard.tsx` - Added Subagents tab with full display
- `/src/hooks/useAuth.ts` - Added isSubagent property and /subagent route
- `/src/integrations/supabase/types.ts` - Added subagent tables and role

## How to Deploy

### Step 1: Run Database Migration
Execute all SQL in `/supabase/migrations/20260516000000_add_subagent_system.sql` in your Supabase SQL Editor:

```sql
-- Copy all content from SUBAGENT_SETUP.md and execute in Supabase SQL Editor
```

### Step 2: Update User Roles
If you have existing users, assign "subagent" role via:
```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('user-id-here', 'subagent');
```

### Step 3: Deploy Code
- Push changes to your repository
- Deploy to production via Vercel

### Step 4: Test the Flow
1. Log in as Agent
2. Go to Subagents tab
3. Enable "Allow Subagent Registration"
4. Go to your storefront
5. Scroll to "Become a Subagent" section
6. Fill registration form
7. Should be redirected to SubagentDashboard automatically

## Troubleshooting

### Subagents Tab Not Showing in Admin Dashboard
- Verify "subagents" is in currentUserSections permissions
- Check that user has admin role
- Clear browser cache and reload

### Registration Form Not Submitting
- Check all required fields are filled
- Verify Supabase connection
- Check browser console for errors
- Ensure agentStoreId is valid

### Subagent Dashboard Empty
- Verify user has "subagent" role in database
- Check subagent_stores record exists
- Verify subagent_store_id matches user session

## Future Enhancements

1. **Nested Subagents:** Allow subagents to recruit sub-subagents
2. **Commission Settings:** Agents can set custom commissions
3. **Performance Analytics:** Dashboard metrics for subagent performance
4. **Bulk Pricing:** Set multiple package prices at once
5. **Payout Automation:** Automatic monthly withdrawals based on thresholds

---

**Last Updated:** May 16, 2026
**Status:** Production Ready ✅
