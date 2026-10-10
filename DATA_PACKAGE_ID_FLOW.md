# Data Package ID Flow - MTN Mashup Orders

## Overview
This document explains exactly where and how `data_package_id` is being picked up and passed through the MTN Mashup order fulfillment pipeline.

## Complete Data Flow

### 1. **Initialize Payment** (`supabase/functions/initialize-payment/index.ts`)

**Where it comes from:**
- Line 295: `const { data: packageData } = await supabase.from("packages").select(...)`
- The `packages` table contains `data_package_id` field for mtn_mashup packages

**How it's passed:**
- Line 368-369: `data_package_id` is conditionally added to Paystack metadata:
```typescript
...(packageData.network === "mtn_mashup" || packageData.network === "mashup") && { 
  data_package_id: metadata?.data_package_id || packageData.data_package_id 
},
```

**What gets sent to Paystack:**
```json
{
  "metadata": {
    "package_id": "uuid",
    "network": "mtn_mashup",
    "data_package_id": "mtn_special_offer_123",  // <- CRITICAL
    "phone": "0599944920",
    "package_name": "125 mins + 0.36GB",
    // ... other fields
  }
}
```

---

### 2. **Verify Payment** (`supabase/functions/verify-payment/index.ts`)

**Where it comes from:**
- Line 313: Extracted from Paystack metadata:
```typescript
const dataPackageId = metadata.data_package_id || null;
```

**How it's stored in the order:**
- Lines 420-436: Added to the order insert with conditional spread operator:
```typescript
const orderInsert: Record<string, unknown> = {
  customer_number: phone,
  package_id: packageId,
  network,
  size_gb: sizeGb,
  amount,
  status: "paid",
  fulfillment_status: "pending",
  paystack_reference: reference,
  selling_price: sellingPrice,
  base_price: basePriceForOrder,
  profit: profitForOrder,
  profit_credited: false,
  agent_store_id: null,
  subagent_store_id: null,
  ...(dataPackageId && { data_package_id: dataPackageId }),  // <- STORED HERE
};
```

**Result in Orders Table:**
```
orders.data_package_id = "mtn_special_offer_123"
```

---

### 3. **Fulfill Order** (`supabase/functions/fulfill-order/index.ts`)

**Where it comes from:**
- Line 48: Selected directly from the orders table:
```typescript
const { data: existingOrder } = await supabase
  .from("orders")
  .select("id, fulfillment_status, status, customer_number, network, size_gb, package_id, data_package_id")  // <- SELECTED
  .eq("id", order_id)
  .single();
```

**How it's used:**
- Lines 114-126: First tries to use data_package_id from order, falls back to fetching from data_packages:
```typescript
let dataPackageId = existingOrder.data_package_id;  // <- USED FROM ORDER

if (!dataPackageId && (existingOrder.network === "mtn_mashup" || existingOrder.network === "mashup") && existingOrder.package_id) {
  // Fallback: fetch from data_packages table if not stored in order
  const { data: pkg } = await supabase
    .from("data_packages")
    .select("data_package_id, size_gb_text")
    .eq("id", existingOrder.package_id)
    .single();
  dataPackageId = pkg?.data_package_id || null;
}
```

**Sent to Datahubnet API:**
- Line 153-155: Used in the API request:
```typescript
if (existingOrder.network === "mtn_mashup" || existingOrder.network === "mashup") {
  const requestBody = {
    "phone_number": phone,
    "package_id": Number(dataPackageId),  // <- SENT TO API
  };
```

---

## Data Source Diagram

```
┌─────────────────────────────────────┐
│   packages / data_packages table    │
│      data_package_id field          │
│   e.g., "mtn_special_offer_123"     │
└──────────────┬──────────────────────┘
               │
               v
     ┌─────────────────────┐
     │ initialize-payment  │
     │ (Extracts & passes) │
     └──────────┬──────────┘
                │
                v
         Paystack metadata
      data_package_id: "mtn_..."
                │
                v
     ┌──────────────────────┐
     │  verify-payment      │
     │  (Stores in order)   │
     └──────────┬───────────┘
                │
                v
        orders.data_package_id
           "mtn_special_..."
                │
                v
     ┌──────────────────────┐
     │  fulfill-order       │
     │ (Reads from order)   │
     └──────────┬───────────┘
                │
                v
       Datahubnet API Call
       package_id: "mtn_..."
```

---

## Key Changes Made

### Fix 1: Extract dataPackageId in verify-payment
**File:** `supabase/functions/verify-payment/index.ts` (Line 313)
```typescript
const dataPackageId = metadata.data_package_id || null;
```

### Fix 2: Store dataPackageId in order
**File:** `supabase/functions/verify-payment/index.ts` (Lines 420-436)
```typescript
...(dataPackageId && { data_package_id: dataPackageId }),
```

### Fix 3: Select dataPackageId from orders table
**File:** `supabase/functions/fulfill-order/index.ts` (Line 48)
```typescript
.select("id, fulfillment_status, status, customer_number, network, size_gb, package_id, data_package_id")
```

### Fix 4: Prioritize dataPackageId from order
**File:** `supabase/functions/fulfill-order/index.ts` (Lines 114-126)
```typescript
let dataPackageId = existingOrder.data_package_id;  // PRIMARY SOURCE

if (!dataPackageId && ...) {
  // FALLBACK: Fetch from data_packages if not in order
}
```

---

## Testing the Flow

### Step 1: Create an order for mtn_mashup package
Verify that Paystack metadata includes `data_package_id`:
```json
{
  "data_package_id": "mtn_special_125mins_036gb"
}
```

### Step 2: Check orders table after payment
Query:
```sql
SELECT customer_number, network, data_package_id, fulfillment_status 
FROM orders 
WHERE network = 'mtn_mashup' 
ORDER BY created_at DESC LIMIT 1;
```

Expected output:
```
customer_number  | network     | data_package_id                | fulfillment_status
0599944920       | mtn_mashup  | mtn_special_125mins_036gb      | pending
```

### Step 3: Check API logs
Verify Datahubnet API receives the correct package_id:
```sql
SELECT request_payload, response_payload 
FROM api_error_logs 
WHERE order_id = 'ORDER_ID';
```

Expected request:
```json
{
  "phone_number": "0599944920",
  "package_id": "mtn_special_125mins_036gb"
}
```

