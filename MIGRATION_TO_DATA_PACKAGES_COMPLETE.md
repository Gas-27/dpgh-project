# Special MTN Mashup Migration to data_packages - Complete

## Summary
All Special MTN Mashup pricing data has been migrated from `afa_settings` table to `data_packages` table. The code now fetches Special MTN packages directly from `data_packages` instead of `afa_settings`.

## Files Updated

### 1. AdminDashboard.tsx
- **Function**: `fetchSpecialMTNPricing()`
- **Change**: Fetches 4 Special MTN packages from `data_packages` table by querying:
  - network = "mtn"
  - package_name LIKE "Special MTN Mashup%"
  - Ordered by mins (ascending)
- **Result**: Admin can view and manage pricing from the dashboard

### 2. SpecialMTNMashupPricingManager.tsx
- **Function**: `useEffect()` - initial load
- **Change**: Loads Special MTN packages from `data_packages` table and stores package IDs in window.specialMTNPackageIds
- **Function**: `handleSave()`
- **Change**: Updates each of the 4 tier packages individually in `data_packages` by ID with new user_price, agent_price, and is_active values
- **Result**: Admin can save pricing changes directly to `data_packages`

### 3. Packages.tsx
- **Function**: `fetchSpecialMTNPricing()` useEffect
- **Change**: Fetches Special MTN user prices from `data_packages` table ordered by mins
- **Result**: Customer-facing Packages page displays current pricing from `data_packages`

### 4. AgentStorefront.tsx
- **Function**: `fetchSpecialMTNPricing()` useEffect
- **Change**: First tries agent-specific pricing from `agent_special_mtn_mashup_pricing`, falls back to `data_packages` for admin pricing
- **Result**: Agent storefront displays correct pricing (agent-specific or admin default)

## Data Structure
Special MTN packages in `data_packages` table:
```
{
  network: "mtn",
  package_name: "Special MTN Mashup - Tier 1", // "Tier 2", "Tier 3", "Tier 4"
  size_gb: "125 mins + 0.36GB", // "360 mins + 0.87GB", etc (text format)
  mins: 125, // 360, 700, 1000
  user_price: 6.00, // Variable
  agent_price: 6.00, // Variable
  is_active: true // Toggle to enable/disable
}
```

## Migration Flow
1. **Database**: SQL migration moved all 4 tiers from `afa_settings` to `data_packages`
2. **Admin Dashboard**: Fetches and manages pricing from `data_packages`
3. **Packages Page**: Displays pricing from `data_packages` to customers
4. **Agent Storefront**: Falls back to `data_packages` for pricing
5. **Purchases**: Package IDs now use "special-mtn-package" (not tier-specific IDs)

## Testing
- ✅ Admin can view Special MTN pricing in dashboard
- ✅ Admin can edit prices and toggle enabled/disabled
- ✅ Changes persist to `data_packages` table
- ✅ Packages page displays updated pricing
- ✅ Agent storefront shows correct pricing
- ✅ Build succeeds with no errors

## Notes
- `afa_settings` table Special MTN columns are no longer used but not deleted
- Package IDs are automatically handled by Supabase UUID generation
- Pricing can now be managed through a single `data_packages` table
- Future enhancement: Could add more Special MTN tiers without schema changes
