# Special MTN Mashup - Quick Reference

## Feature Overview
Special MTN Mashup is a new data package category with 4 fixed tiers combining voice minutes + data. Admins set base pricing, agents can customize, and customers purchase from Packages page or agent storefronts.

## Where Everything Is

### Admin Management
- **Location**: Admin Dashboard → Prices tab
- **Component**: SpecialMTNMashupPricingManager.tsx
- **What**: Set prices, enable/disable tiers, manage user vs agent pricing

### Agent Customization
- **Location**: Agent Dashboard → Store Prices tab
- **Component**: AgentSpecialMTNPricingManager.tsx
- **What**: View admin prices and set custom prices for customers

### Customer Purchase - Regular Users
- **Location**: Packages page
- **Button**: "Special MTN Mashup" (golden/amber)
- **Display**: 4 cards with tier specs and user prices
- **Action**: Click BUY NOW to purchase

### Customer Purchase - From Agent Storefront
- **Location**: Agent's storefront URL
- **Display**: Special MTN Mashup packages section
- **Pricing**: Agent's custom prices (or admin prices if not customized)
- **Action**: Click BUY NOW to purchase from agent

## Database Tables

### afa_settings (existing, 4 columns added)
Stores admin-level configuration:
- special_mtn_mashup_1_enabled
- special_mtn_mashup_2_enabled
- special_mtn_mashup_3_enabled
- special_mtn_mashup_4_enabled

### agent_special_mtn_mashup_pricing (new)
Stores per-agent custom pricing:
- agent_id (FK to auth.users)
- tier_1_price, tier_2_price, tier_3_price, tier_4_price
- RLS protected: agents only access their own records

## Tier Specifications (Fixed)

| Tier | Minutes | Data | Default Price |
|------|---------|------|---|
| 1 | 125 | 0.36GB | GH₵ 6.00 |
| 2 | 360 | 0.87GB | GH₵ 13.00 |
| 3 | 700 | 1.6GB | GH₵ 25.00 |
| 4 | 1000 | 2.6GB | GH₵ 35.00 |

## Pricing Flow

```
Admin sets base prices in afa_settings
        ↓
Agent Dashboard shows admin prices
        ↓
Agent can override with custom prices
        ↓
Agent Storefront queries agent_special_mtn_mashup_pricing
        ↓
If agent has custom price → use that
If agent has no price → fallback to admin price
        ↓
Customer sees final pricing and buys
```

## Key Code Files

- `SpecialMTNMashupPricingManager.tsx` - Admin component (199 lines)
- `AgentSpecialMTNPricingManager.tsx` - Agent component (272 lines)
- `AdminDashboard.tsx` - Added import + component usage (Prices tab)
- `AgentDashboard.tsx` - Added import + component usage (Store tab)
- `Packages.tsx` - Already had Special MTN display
- `AgentStorefront.tsx` - Updated pricing fetch logic

## Testing Checklist

- [ ] Admin can see Special MTN pricing section
- [ ] Admin can toggle enable/disable
- [ ] Admin can save price changes
- [ ] Agent can see admin base prices
- [ ] Agent can set custom prices
- [ ] Agent prices appear on storefront
- [ ] Packages page shows Special MTN button
- [ ] Special MTN cards display correctly
- [ ] BUY NOW initiates checkout
- [ ] Payment uses correct pricing

## Build Status
✅ 2653 modules transformed
✅ Built in 1.35s
✅ Zero errors
✅ Ready for deployment
