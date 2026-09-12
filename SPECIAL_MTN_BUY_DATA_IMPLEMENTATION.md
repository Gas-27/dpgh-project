# Special MTN Mashup - Buy Data Integration

## What Was Added

### 1. Special MTN Filter Button
Added a new filter button in the "Buy Data" tab alongside MTN, AirtelTigo, and Telecel:
- Button label: "Special MTN Mashup"
- Color: Amber/Yellow theme (matching Special MTN branding)
- Functionality: Filters packages grid to show Special MTN options

### 2. Special MTN Package Cards
When the "Special MTN Mashup" filter is selected, displays 4 special cards:
- **Tier 1**: 125 mins + 0.36GB @ agent's custom price
- **Tier 2**: 360 mins + 0.87GB @ agent's custom price
- **Tier 3**: 700 mins + 1.6GB @ agent's custom price
- **Tier 4**: 1000 mins + 2.6GB @ agent's custom price

Each card features:
- Lightning bolt icon (⚡) in amber color
- "Special Mashup" label
- Clear tier specifications (mins + data)
- Agent's custom pricing (or fallback to admin pricing)
- Amber color scheme (bg-amber-50/5, border-amber-600/50)
- Buy Now button styled with amber background

### 3. Payment Options
When agent clicks "Buy Now" on Special MTN package:
- Can pay with **Wallet** (deducted from balance)
- Can pay with **Paystack** (+ transaction charges)
- Same validation as regular packages:
  - Pending withdrawal protection
  - Balance verification
  - Phone number not required for Special MTN (agent purchasing for own wallet)

### 4. Buy Dialog Updates
Dialog title and content updated to handle Special MTN:
- Title: "Buy Special MTN Mashup (0.36GB)" for clarity
- Shows "minutes + data" instead of just "data"
- Displays package specifications clearly
- Payment method selection works identically

## Technical Implementation

### Files Modified
- `/src/pages/AgentDashboard.tsx`

### Key Changes
1. **Line 1484**: Added "special" to network filter buttons
2. **Lines 1486-1527**: Added conditional rendering for Special MTN packages
3. **Line 2263**: Updated dialog title to handle Special MTN display
4. **Lines 2265-2273**: Updated dialog details display for Special MTN

### How It Works
```typescript
// When networkFilter === "special", displays Special MTN packages
// Fetches prices from specialMTNPricing state (agent's custom prices)
// Falls back to admin base prices if agent hasn't customized
// Each tier maps to a card with buy functionality
```

## User Flow

1. **Agent navigates to "Buy Data" tab**
2. **Clicks "Special MTN Mashup" button** (new filter)
3. **Sees 4 special package cards** with amber color theme
4. **Clicks "Buy Now"** on desired tier
5. **Selects payment method**:
   - **Wallet**: Deducts from balance immediately
   - **Paystack**: Initiates payment via Paystack gateway
6. **Purchase completes** and order is created

## Features

✅ Agent can buy Special MTN Mashup packages for themselves
✅ Uses agent's custom prices (or admin fallback)
✅ Supports both wallet and Paystack payment
✅ Pending withdrawal protection applies
✅ Consistent UI with other packages
✅ Clear labeling and visual hierarchy
✅ Amber/golden color scheme for Special MTN differentiation

## Database Integration

- Fetches agent's custom prices from `agent_special_mtn_mashup_pricing` table
- Falls back to admin prices from `afa_settings` table
- All prices already RLS-protected

## Payment Processing

- **Wallet**: Direct deduction (instant)
- **Paystack**: Same flow as regular packages
- Order created with network: "special-mtn"
- Amount = agent's custom price or admin base price

## Status

✅ Build successful
✅ Ready for testing
✅ All features implemented
✅ RLS policies fixed (from SQL earlier)
