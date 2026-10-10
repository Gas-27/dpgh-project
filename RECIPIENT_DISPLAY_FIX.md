# Recipient Display Fix

## Problem
The recipient dropdown was only showing "(mobile money)" without displaying the account holder name, phone number, or account details.

## Solution
Updated both AgentDashboard and SubagentDashboard to properly display recipient information using the correct table column names.

## Changes Made

### AgentDashboard.tsx (Line 2214-2218)
```jsx
// Before:
{r.recipient_name || r.account_number} ({r.recipient_type === "nuban" ? "Bank" : "Mobile Money"})

// After:
{r.account_holder_name} • {r.provider_type === "mobile_money" ? `${r.mobile_money_network?.toUpperCase()}: ${r.mobile_money_number}` : `Bank: ${r.account_number}`}
```

### SubagentDashboard.tsx (Line 2488-2492)
```jsx
// Before:
{r.recipient_name || r.account_number} ({r.recipient_type === "nuban" ? "Bank" : "Mobile Money"})

// After:
{r.account_holder_name} • {r.provider_type === "mobile_money" ? `${r.mobile_money_network?.toUpperCase()}: ${r.mobile_money_number}` : `Bank: ${r.account_number}`}
```

## Display Format

### Mobile Money Recipients
Example: `George Agyemang • MTN: 0599449202`

### Bank Recipients
Example: `John Doe • Bank: 1234567890`

## Table Columns Used
- `account_holder_name` - The name of the recipient account holder
- `provider_type` - Either "bank" or "mobile_money"
- `mobile_money_network` - Network name (MTN, Telecel, AirtelTigo)
- `mobile_money_number` - Phone number for mobile money
- `account_number` - Bank account number
- `recipient_code` - Unique identifier for the recipient

## Build Status
✅ Build successful - No compilation errors
