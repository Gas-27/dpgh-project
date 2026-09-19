# Recipient Selection Feature - Complete Update

## Overview
Both Agent and Subagent dashboards now display a recipient selection dropdown for users who have previously created recipients, with full support for creating up to 4 recipients per user.

## Changes Made

### 1. Recipient Query Updated
- **AgentDashboard.tsx**: Changed from filtering by `agent_store_id` to filtering by `user_id`
- **SubagentDashboard.tsx**: Changed from filtering by `subagent_store_id` to filtering by `user_id`
- Status column filter: Changed from `is_active: true` to `status: 'active'` to match actual table schema

Query now:
```typescript
supabase.from("transfer_recipients").select("*").eq("user_id", effectiveUserId).eq("status", "active").order("created_at", { ascending: false })
```

### 2. Recipient Selection UI
Users can now:
- See all their active recipients in a dropdown when accessing the withdrawal form
- Select an existing recipient directly to proceed with withdrawal
- Alternatively add a new recipient if desired

### 3. Four-Recipient Limit
- Maximum of 4 recipients per user enforced
- Add Recipient button shows current count: `+ Add New Recipient (1/4)`
- Button becomes disabled when limit reached
- Validation error shown if user attempts to create 5th recipient

### 4. User Experience Flow

**If user has recipients:**
1. Recipients dropdown displays all saved recipients
2. User selects recipient from dropdown
3. User enters amount and clicks Transfer
4. Can add up to 3 more recipients via "+ Add New Recipient (1/4)" button

**If user has no recipients:**
1. Message says "Add Recipient"
2. Click button to create first recipient
3. Fill in recipient details (bank or mobile money)
4. Can add up to 3 more recipients after

## Technical Implementation

### State Variables Added
```typescript
const [createNewRecipient, setCreateNewRecipient] = useState(false);
const [recipientType, setRecipientType] = useState<"bank" | "mobile_money">("bank");
const [recipientName, setRecipientName] = useState("");
const [bankName, setBankName] = useState("");
const [bankCode, setBankCode] = useState("");
const [accountNumber, setAccountNumber] = useState("");
const [mobileNetwork, setMobileNetwork] = useState("mtn");
const [mobileNumber, setMobileNumber] = useState("");
```

### Recipient Types Supported
- **Bank Account**: Account holder name, bank name, bank code, account number
- **Mobile Money**: Account holder name, network (MTN/Telecel/AirtelTigo), phone number

### Validation
- Maximum 4 recipients per user
- All required fields must be filled
- User receives clear error messages for validation failures

## Files Modified
1. `/src/pages/AgentDashboard.tsx` - Recipient query, UI, and 4-recipient limit
2. `/src/pages/SubagentDashboard.tsx` - Recipient query, UI, and 4-recipient limit

## Testing Recommendations
1. Create 1-3 recipients and verify dropdown displays all
2. Verify recipient counter shows correct count
3. Try creating 5th recipient and verify error
4. Select existing recipient and complete withdrawal
5. Create new recipient inline and verify it's saved
