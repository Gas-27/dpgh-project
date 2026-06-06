# AFA Registration System - Complete Guide

## Overview
The AFA (Agricultural Farmers Association) registration system allows users to register and pay for membership bundles. Settings are controlled from the Admin Dashboard and reflect in real-time across the site.

## Admin Dashboard - Settings

### Location
**Admin → AFA → Settings Tab**

### What You Can Control

1. **Base Registration Fee**
   - The minimum price for AFA registration
   - Example: Set to GH₵50
   - Agents can add their own markup on top of this
   - Changes reflect instantly on all storefronts

2. **Registration Status**
   - **Enabled**: Customers can see and register for AFA
   - **Disabled**: Shows "AFA Registration is currently disabled" message
   - Users cannot register when disabled
   - Changes take effect immediately

### How to Save Settings

1. Enter the registration fee amount
2. Toggle registration on/off with the button
3. Click **"Save Settings"** button
4. You'll see a success message confirming the save

### Important Notes

- Settings are stored in a single database record with UUID: `550e8400-e29b-41d4-a716-446655440000`
- Changes are broadcast in real-time to all users viewing the site
- If save fails, you'll see an error message - check browser console for details

## Where Changes Appear

### Packages Page
- Shows "AFA Bundle Registration" pricing
- Displays the base price you set
- Shows "AFA Registration is Temporarily Closed" when disabled

### Agent Dashboard
- Shows minimum price (what you set as base)
- Agents can set their own selling price above the minimum
- Agents see their markup amount

### Agent Storefront
- Customers see the agent's price (base + agent markup)
- Registration button only works if AFA is enabled
- Shows disabled message if admin has turned it off

### Customer Registration Form
- Only appears if AFA is enabled
- After form submission, redirects to Paystack payment
- All form data is sent with payment metadata

## Registrations Tab

### View All Registrations
Click the **"Registrations"** tab to see:
- Customer names and phone numbers
- Ghana Card numbers
- Region and crop type
- Registration status (Pending/Approved/Rejected)
- Registration date

### Manage Registrations
- **Pending**: Click Approve or Reject
- **Approved/Rejected**: Status is locked

### Download Records
Click **"Download CSV"** to export all registrations as a CSV file

## Real-Time Updates

The system uses Supabase real-time subscriptions. When you change settings:

1. Admin saves setting
2. Database is updated
3. Real-time event is broadcast
4. All connected clients receive update
5. UI updates instantly (no page refresh needed)

### What Updates in Real-Time
- ✅ Registration fee changes
- ✅ Enable/Disable toggle
- ✅ Agent pricing changes
- ✅ New registrations appear immediately

## Troubleshooting

### Settings Don't Save
1. Check browser console for error messages
2. Verify the amount is a valid number
3. Try refreshing the page and saving again
4. Check your internet connection

### Changes Don't Show on Storefront
1. Settings use real-time subscriptions - check if they're enabled
2. Wait a few seconds - there might be a small delay
3. Refresh the page (Cmd/Ctrl + R)
4. Check the console for connection errors

### Admin Dashboard Shows Error "Failed to load resource: 401"
This usually means:
1. The afa_settings record doesn't exist in database
2. Run the initialization SQL provided below

### Registrations Tab is Empty
1. No one has registered yet - this is normal
2. Check that AFA is enabled
3. Verify the Paystack payment endpoint is working

## Database Initialization

If you're having issues, run this SQL in your Supabase console once:

```sql
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.afa_settings (
  id UUID PRIMARY KEY,
  registration_fee DECIMAL(10, 2) DEFAULT 50.00,
  bundle_price DECIMAL(10, 2) DEFAULT 50.00,
  registration_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default record
INSERT INTO public.afa_settings (
  id,
  registration_fee,
  bundle_price,
  registration_enabled,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  50.00,
  50.00,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.afa_settings;
```

## Payment Flow

1. Customer fills AFA registration form
2. Customer clicks "Register (GH₵ amount)"
3. Form data sent to Paystack initialization endpoint
4. User redirected to Paystack checkout page
5. Customer completes payment
6. Paystack webhook creates registration record
7. Customer sees confirmation

## Key Concepts

**Base Price**: The minimum price set by admin (e.g., GH₵50)

**Agent Price**: What agents charge customers (e.g., GH₵60)

**Agent Markup**: Difference between agent price and base price (e.g., GH₵10)

Payment flow:
- Customer pays agent price to agent
- Agent keeps their markup
- Admin gets the base price
- Rest goes to payment processor fees

---

**Last Updated**: 2026
**System**: AFA Registration v1.0
