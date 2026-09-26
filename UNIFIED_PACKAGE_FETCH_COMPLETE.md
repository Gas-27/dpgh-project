# Unified Package Fetching - All Packages from data_packages Table

## Summary
All packages (including Special MTN Mashup) are now fetched from the same `data_packages` table. Special MTN Mashup packages have `network = "mtn_mashup"` and use a new `size_gb_text` column for display text.

## Database Schema

### Regular Packages (MTN, AirtelTigo, Telecel)
```
{
  network: "mtn" | "airteltigo" | "telecel",
  size_gb: numeric,        // e.g., 2, 5, 10
  price: numeric,
  active: boolean
}
```

### Special MTN Mashup Packages
```
{
  network: "mtn_mashup",
  size_gb: numeric,        // Base numeric value (0.36, 0.87, 1.6, 2.6)
  size_gb_text: text,      // Display text: "125 mins + 0.36GB", "360 mins + 0.87GB", etc.
  mins: integer,           // 125, 360, 700, 1000
  user_price: numeric,
  agent_price: numeric,
  is_active: boolean
}
```

## Files Updated

### 1. Packages.tsx (Customer Page)
- **DataPackage interface**: Added `size_gb_text` and `mins` optional fields
- **Fetch queries**: Updated to include `size_gb_text` column
- **Display logic**: Shows `size_gb_text` if available, otherwise `size_gb + "GB"`
- **Special MTN packages**: Dynamically fetched from `data_packages` where `network = "mtn_mashup"`
- **Buy buttons**: Use actual fetched package data instead of hardcoded values

### 2. PaymentDialog.tsx (Payment Initialization)
- **Paystack metadata**: Added `sizeGbText` field for `mtn_mashup` packages
- **Package name**: Displays full text like "125 mins + 0.36GB" for special packages

### 3. AgentDashboard.tsx (Agent Purchases)
- **Wallet order**: Uses actual `package_id` and adds `size_gb_text` for mtn_mashup
- **Paystack metadata**: Includes `sizeGbText` when `network = "mtn_mashup"`
- **Bulk orders**: Same handling for mtn_mashup packages

### 4. SubagentDashboard.tsx (Subagent Purchases)
- **Wallet order**: Same updates as AgentDashboard
- **Bulk orders**: Same handling for mtn_mashup packages

## API Payload Changes

### Regular Packages
```json
{
  "package_id": "uuid-12345",
  "network": "mtn",
  "package_name": "2GB - GH₵ 10.00",
  "size_gb": 2
}
```

### Special MTN Mashup Packages
```json
{
  "package_id": "uuid-54321",
  "network": "mtn_mashup",
  "package_name": "125 mins + 0.36GB",
  "sizeGbText": "125 mins + 0.36GB",
  "size_gb": 0.36,
  "mins": 125
}
```

## Order Table Updates
Orders now include:
- `size_gb_text`: Populated for mtn_mashup packages, NULL for others
- `package_id`: Direct UUID reference (no special identifiers needed)
- `network`: "mtn_mashup" for special packages

## Benefits
- ✅ Single source of truth for all packages (data_packages table)
- ✅ Display text for special packages is centralized and editable
- ✅ Package IDs are properly tracked in orders
- ✅ API receives complete context via sizeGbText field
- ✅ Future special packages can be added without code changes

## Migration Notes
The old approach using `special_mtn_mashup_*` columns in `afa_settings` is deprecated but not deleted. You can safely remove those columns when ready.

