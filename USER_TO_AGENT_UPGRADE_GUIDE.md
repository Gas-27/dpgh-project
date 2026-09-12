# User to Agent Upgrade - Complete Implementation Guide

## Overview
Users can upgrade from a regular customer account to an agent account WITHOUT creating a new account. Both accounts use the SAME EMAIL, and the wallet balance transfers automatically.

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Account (customers table)           │
│  - email: john@example.com                                  │
│  - id: user_123                                             │
│  - wallet_balance: GHC 50.00                                │
│  - has_agent_account: false (initially)                     │
└─────────────────────────────────────────────────────────────┘
                            ↓ (Click "Become an Agent")
        ┌───────────────────────────────────────────────┐
        │ Upgrade Process (create-agent-account func)  │
        │ - Verify user meets requirements             │
        │ - Create agent account                       │
        │ - Transfer wallet balance                    │
        │ - Link both accounts                         │
        └───────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               Agent Account (agents table)                   │
│  - email: john@example.com (SAME EMAIL)                     │
│  - user_id: user_123 (linked to user)                       │
│  - id: agent_456                                            │
│  - wallet_balance: GHC 50.00 (transferred)                  │
│  - created_from_user: true                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            Updated User Account (customers table)           │
│  - has_agent_account: true                                  │
│  - agent_id: agent_456 (link back to agent)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Changes Required

### 1. Add New Columns to `customers` Table

Run this SQL in Supabase:

```sql
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS has_agent_account BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_agent_id ON customers(agent_id);
```

### 2. Add New Columns to `agents` Table

```sql
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS created_from_user BOOLEAN DEFAULT false;

-- Create index for linking user accounts
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
```

### 3. Enable Notifications Table (if not exists)

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
```

---

## Frontend Flow

### Step 1: User Views "Become an Agent" Page
- Located in User Dashboard sidebar
- Shows current account status
- Lists agent benefits
- Displays upgrade requirements

### Step 2: User Clicks "Upgrade to Agent Now" Button
- Triggers `renderBecomeAgent()` function in UserDashboard.tsx
- Calls Supabase Edge Function: `create-agent-account`

### Step 3: Backend Processing
The `create-agent-account` function:
1. Validates email and user_id
2. Checks if agent account already exists
3. Gets user's current wallet balances
4. Creates new agent account with:
   - Same email as user
   - Transferred wallet balance
   - Link to user account (user_id)
   - `created_from_user: true` flag
5. Updates user account to set `has_agent_account: true`
6. Creates success notification

### Step 4: Redirect to Agent Dashboard
- After successful upgrade, user redirected to `/agent`
- Agent dashboard loads with new permissions
- Wallet balance and purchase history preserved

---

## Email Behavior

### Same Email, Different Accounts

**User Account (customers):**
- Email: john@example.com
- Role: Customer
- Can: Buy data, manage wallet
- Dashboard: User Dashboard (/user-dashboard)

**Agent Account (agents):**
- Email: john@example.com (SAME)
- Role: Agent
- Can: Bulk orders, manage subagents, set pricing
- Dashboard: Agent Dashboard (/agent)

**How it works:**
- Both accounts exist in different tables
- Same email is allowed because they're separate accounts
- Login identifies which dashboard to show based on user_id or agent_id
- User can have BOTH accounts simultaneously (dual-role)

---

## Authentication Logic

### Login/Dashboard Routing

```javascript
// In auth logic (after user logs in with email)

// Check if user exists in customers table
const user = await supabase
  .from("customers")
  .select("id, has_agent_account, agent_id")
  .eq("email", email)
  .single();

if (user.has_agent_account) {
  // Show dropdown: "Go to Agent Dashboard" or "Go to User Dashboard"
  // OR auto-route to agent dashboard
  window.location.href = "/agent";
} else {
  // Route to user dashboard
  window.location.href = "/user-dashboard";
}
```

---

## Wallet Balance Transfer

When upgrading, wallet balances automatically transfer:

```
User Account:
- wallet_balance: 50.00 GHC
- api_wallet_balance: 25.00 GHC
        ↓
Agent Account Created:
- wallet_balance: 50.00 GHC (transferred)
- api_wallet_balance: 25.00 GHC (transferred)
```

The original user account keeps its balance, and the agent account is created with a copy. Both can be managed independently.

---

## Supabase Function Setup

### 1. Deploy the Function

The function is located at: `supabase/functions/create-agent-account/index.ts`

Deploy using:
```bash
supabase functions deploy create-agent-account
```

### 2. Required Environment Variables
- `SUPABASE_URL` - Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

These are automatically available in Supabase Edge Functions.

### 3. Permissions Required

The function uses service role key, so it needs:
- SELECT on customers table
- INSERT on agents table
- UPDATE on customers table
- INSERT on notifications table (optional)

---

## Complete User Journey

### Timeline

**Day 1 - User Buys Data**
```
User creates account with email: john@example.com
↓
User purchases 5GB of data
↓
Wallet balance: GHC 50.00
Status: Regular Customer
```

**Day 8 - User Upgrades**
```
User has made 5+ purchases ✓
Account is 7+ days old ✓
User clicks "Become an Agent"
↓
create-agent-account function runs:
- Creates agent account (same email)
- Transfers GHC 50.00 wallet balance
- Links both accounts
↓
Agent account created
↓
User redirected to Agent Dashboard
↓
Can now manage bulk orders, set pricing, recruit subagents
```

**After Upgrade - Dual Role**
```
User can still access:
- User Dashboard: View purchases, manage user wallet
- Agent Dashboard: Manage store, subagents, bulk orders

Both accounts linked via:
- Same email
- user_id in agents table
- agent_id in customers table
```

---

## Key Features

### Seamless Upgrade
- No new email required
- No password reset needed
- Wallet balance transfers automatically
- Purchase history preserved

### Account Linking
- Both accounts reference each other
- Can identify dual-role users
- Easy to see which user created which agent account

### Data Preservation
- User's orders remain in customer orders table
- Agent's new orders in agent orders table
- Wallet balance accessible in both contexts

### One-Click Process
- User clicks "Become an Agent"
- Single function call
- Automatic redirect
- Ready to go

---

## Testing the Upgrade

### 1. Create a Test User
- Register with email: test@example.com
- Buy data package (5GB recommended)
- Wait 7 days OR manually update account creation date in database

### 2. Upgrade to Agent
- Go to User Dashboard
- Click "Become an Agent" in sidebar
- Review requirements and click "Upgrade to Agent Now"

### 3. Verify
- Check Supabase: `agents` table should have new row with email test@example.com
- Check Supabase: `customers` table, test user should have `has_agent_account: true`
- Access Agent Dashboard at `/agent`
- Verify wallet balance appears in agent dashboard

---

## Troubleshooting

### Agent account not created
- Check Supabase function logs
- Verify `has_agent_account` not already true
- Ensure wallet transfer succeeded
- Check database permissions

### Same email error
- This is expected - both accounts SHOULD have same email
- Check if agent with same email already exists
- If so, delete the agent account and try upgrade again

### Wallet balance not transferred
- Check that `wallet_balance` column exists in agents table
- Verify customer record has wallet_balance value
- Check function logs for SQL errors

### Redirect not working
- Clear browser cache
- Verify `/agent` route exists in app
- Check browser console for errors
- Ensure agent_id is properly set in database

---

## SQL Queries for Debugging

### Find all users with agent accounts
```sql
SELECT c.email, c.id, a.id as agent_id, a.store_name
FROM customers c
LEFT JOIN agents a ON c.agent_id = a.id
WHERE c.has_agent_account = true;
```

### Find all agents created from user upgrades
```sql
SELECT id, email, store_name, user_id, created_at
FROM agents
WHERE created_from_user = true
ORDER BY created_at DESC;
```

### Check wallet transfer
```sql
SELECT 
  c.email,
  c.wallet_balance as user_wallet,
  a.wallet_balance as agent_wallet
FROM customers c
JOIN agents a ON c.agent_id = a.id;
```

---

## Security Considerations

1. **Same Email Safety**: Both accounts in different tables with different IDs - no conflicts
2. **Permission Isolation**: Agent and user dashboards have separate access controls
3. **Wallet Safety**: Transfer uses transactions to prevent data loss
4. **User Verification**: Requires email verification before upgrade (can add)
5. **Audit Trail**: `created_from_user` flag tracks origin of agent accounts

---

## Next Steps

1. **Run Database Migrations**: Execute all SQL commands above
2. **Deploy Function**: `supabase functions deploy create-agent-account`
3. **Test Flow**: Create test user, upgrade to agent
4. **Add Navigation**: Update app navigation to show dual-role options
5. **Monitor**: Check function logs and error rates after launch

The system is ready to support seamless user-to-agent upgrades with the same email!
