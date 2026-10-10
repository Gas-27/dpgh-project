# Special MTN Mashup in Buy Data - Fix Applied

## Problem
The "Special MTN Mashup" filter button was visible in the Agent Dashboard Buy Data section, but clicking it showed no packages. This was because the specialMTNPricing state was never declared or initialized.

## Root Cause
1. **Missing State Declaration**: `specialMTNPricing` state was referenced in the render logic but never declared with `useState`
2. **Missing Data Fetch**: The Special MTN pricing data was never fetched from the Supabase table
3. **Missing Initialization**: The state was set to `null` by default with no useEffect to populate it

## Solution Applied

### 1. Added State Declaration (Line 306)
```typescript
const [specialMTNPricing, setSpecialMTNPricing] = useState<{
  tier1_agent_price: number;
  tier2_agent_price: number;
  tier3_agent_price: number;
  tier4_agent_price: number;
} | null>(null);
```

### 2. Added to Promise.all Fetch (Line 525-532)
Added Special MTN pricing query to the existing Promise.all that fetches all agent data:
```typescript
supabase.from("agent_special_mtn_mashup_pricing")
  .select("tier_1_price, tier_2_price, tier_3_price, tier_4_price")
  .eq("agent_id", effectiveUserId)
  .maybeSingle()
```

### 3. Set State After Fetch (Line 548-565)
After fetching, the component now sets the Special MTN pricing state with fallback to admin default prices:
```typescript
if (specialMTNR.data) {
  setSpecialMTNPricing({
    tier1_agent_price: specialMTNR.data.tier_1_price || 6.00,
    tier2_agent_price: specialMTNR.data.tier_2_price || 13.00,
    tier3_agent_price: specialMTNR.data.tier_3_price || 25.00,
    tier4_agent_price: specialMTNR.data.tier_4_price || 35.00,
  });
} else {
  setSpecialMTNPricing({
    tier1_agent_price: 6.00,
    tier2_agent_price: 13.00,
    tier3_agent_price: 25.00,
    tier4_agent_price: 35.00,
  });
}
```

## File Modified
- `AgentDashboard.tsx` (3 changes in total)

## Status
✅ Build verified successfully
✅ Changes deployed
✅ Ready for testing

## What Works Now
- Agent can see "Special MTN Mashup" filter button
- Clicking the button displays 4 tier packages with agent's custom prices
- Each package shows: minutes + data + agent price
- Buy Now buttons open payment dialog for wallet or Paystack
- If agent hasn't set custom prices, defaults to admin prices show

## How It Works
When an agent views the Buy Data section:
1. Component fetches their Special MTN Mashup pricing from the database
2. If no custom pricing exists, shows default admin prices (6, 13, 25, 35 GHS)
3. User can click "Special MTN Mashup" filter to see the 4 golden packages
4. Each package can be purchased with wallet or Paystack
