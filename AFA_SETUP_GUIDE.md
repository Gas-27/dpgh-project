# AFA (Airtime for Airtime) Registration System - Complete Setup Guide

## Overview
This guide walks you through setting up the complete AFA Registration system for your platform. It includes database schema, API integration, admin management, agent pricing, and customer registration.

---

## Step 1: Database Setup

### 1.1 Run the Database Migration

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Create a new query and copy the entire content from `SUPABASE_SETUP.sql`
4. Click **Run** to execute the migration

This creates:
- `afa_packages` - Packages managed by admin
- `agent_afa_prices` - Agent custom pricing
- `subagent_afa_prices` - Subagent custom pricing
- `afa_registrations` - Customer registrations
- Row Level Security (RLS) policies

### 1.2 Verify the Tables

Run these queries to confirm tables were created:

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'afa_packages' AND table_schema = 'public'
);

SELECT COUNT(*) FROM afa_packages;
SELECT COUNT(*) FROM afa_registrations;
```

---

## Step 2: Environment Variables Configuration

### 2.1 Get Your AFA Provider Credentials

Contact your AFA provider and request:
- **API Key**: Your authentication key
- **API URL**: Base URL for their API (e.g., `https://api.afa-provider.com`)
- **Webhook Secret**: For validating callbacks
- **Test Mode Credentials**: For testing before going live

### 2.2 Add Environment Variables

Add these to your `.env.local` or project environment variables:

```bash
# AFA API Configuration
VITE_AFA_API_KEY=your_api_key_here
VITE_AFA_API_URL=https://api.afa-provider.com
VITE_AFA_WEBHOOK_SECRET=your_webhook_secret_here
```

For Vercel deployment, go to:
1. Project Settings → **Environment Variables**
2. Add each variable for production and preview environments
3. Redeploy for changes to take effect

---

## Step 3: AFA Provider API Integration

### 3.1 Understanding the API Endpoints

The system expects your AFA provider to support these endpoints:

#### Register Endpoint
```
POST /register
Headers:
  Authorization: Bearer {API_KEY}
  Content-Type: application/json
  X-Store-ID: {store_id}
  X-Store-Type: agent|subagent

Body:
{
  "name": "John Doe",
  "phone": "+233501234567",
  "id_number": "GH-123456789",
  "dob": "1990-05-15",
  "town": "Accra",
  "occupation": "Farmer",
  "region": "Greater Accra",
  "crop": "Maize",
  "package_id": "uuid",
  "amount": 50.00,
  "timestamp": "2024-01-15T10:30:00Z"
}

Response:
{
  "success": true,
  "ref_id": "AFA-2024-001234",
  "message": "Registration successful"
}
```

#### Verify Endpoint
```
GET /verify/{ref_id}
Headers:
  Authorization: Bearer {API_KEY}

Response:
{
  "status": "verified|pending|rejected|active",
  "verified": true|false,
  "message": "Registration verified"
}
```

#### Webhook Callback
```
POST /api/webhooks/afa (your app)
Headers:
  X-AFA-Signature: {hmac_sha256_signature}

Body:
{
  "ref_id": "AFA-2024-001234",
  "status": "verified|active|rejected",
  "verified": true|false,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### 3.2 Configure Webhook URL

1. Log in to your AFA provider dashboard
2. Find **Webhook Settings** or **Callbacks**
3. Set the webhook URL to: `https://your-domain.com/api/webhooks/afa`
4. Set webhook secret (use same value as `VITE_AFA_WEBHOOK_SECRET`)
5. Select events to receive: `registration_verified`, `registration_active`, `registration_rejected`
6. Test the webhook connection

---

## Step 4: Admin Dashboard Setup

### 4.1 Add AFA Management Tab to Admin Dashboard

In `src/pages/AdminDashboard.tsx`, add the AFA management tab:

```tsx
import AdminAFAManagement from "@/components/AdminAFAManagement";

// In the TabsList, add:
<TabsTrigger value="afa">AFA Management</TabsTrigger>

// In the TabsContent, add:
<TabsContent value="afa">
  <AdminAFAManagement />
</TabsContent>
```

### 4.2 Create Initial AFA Packages

1. Go to **Admin Dashboard** → **AFA Management**
2. Click **New Package**
3. Fill in details:
   - **Package Name**: e.g., "Standard AFA", "Premium AFA"
   - **Base Price**: e.g., 50.00 GHS
   - **Description**: Brief description
   - **Min Price**: Minimum agents can set (optional)
   - **Max Price**: Maximum agents can set (optional)
   - **Commission %**: Default commission (e.g., 10%)
4. Click **Create Package**

### 4.3 Manage Packages

- **Edit**: Click edit icon to modify package details
- **Delete**: Click trash icon to remove (careful - deletes all related prices!)
- **Deactivate**: Toggle `is_active` to disable package

---

## Step 5: Agent Pricing Configuration

### 5.1 Add AFA Pricing to Agent Dashboard

In `src/pages/AgentDashboard.tsx`, add AFA pricing section:

```tsx
import AFAPriceManager from "@/components/AFAPriceManager";

// In the agent dashboard, add a new section:
{currentUser && (
  <AFAPriceManager 
    storeId={currentUser.id} 
    storeType="agent" 
  />
)}
```

### 5.2 Agents Set Custom Prices

1. Agents log into their **Dashboard**
2. Navigate to **AFA Pricing**
3. For each package:
   - Click **Edit** button
   - Enter desired **Sell Price**
   - Commission automatically calculates
   - Click **Save**

The commission = Sell Price - Base Price

**Example:**
- Base Price: 50.00 GHS
- Agent sets Sell Price: 55.00 GHS
- Agent's Commission: 5.00 GHS (10% margin)

---

## Step 6: Subagent Pricing Configuration

### 6.1 Add AFA Pricing to Subagent Dashboard

In `src/pages/SubagentDashboard.tsx`, add:

```tsx
import AFAPriceManager from "@/components/AFAPriceManager";

// Add to subagent dashboard:
{currentSubagent && (
  <AFAPriceManager 
    storeId={currentSubagent.id} 
    storeType="subagent" 
  />
)}
```

### 6.2 Subagents Configure Prices

Same process as agents - they can set custom prices per package.

---

## Step 7: Storefront AFA Registration

### 7.1 Add AFA Section to Storefront

In your main storefront page (e.g., `src/pages/Index.tsx`), add:

```tsx
import AFARegistrationForm from "@/components/AFARegistrationForm";
import { getAFAPackages } from "@/services/afa-service";

// Fetch available packages:
const afaPackages = await getAFAPackages();

// Display packages with registration form:
{afaPackages.map((pkg) => (
  <div key={pkg.id} className="border rounded-lg p-4">
    <h3>{pkg.name}</h3>
    <p>Price: GHS {pkg.sell_price.toFixed(2)}</p>
    <AFARegistrationForm
      storeId={currentStore?.id || 'main'}
      storeType="agent"
      packageId={pkg.id}
      packageName={pkg.name}
      amount={pkg.sell_price}
      onSuccess={() => {
        // Handle successful registration
        toast({ title: "Registration submitted" });
      }}
    />
  </div>
))}
```

### 7.2 Add AFA to Agent Store

In `src/pages/AgentStorefront.tsx`:

```tsx
import AFARegistrationForm from "@/components/AFARegistrationForm";

// Fetch AFA packages for this agent:
const afaPackages = await getAFAPackages(store.id, 'agent');

// Display in agent storefront
<AFARegistrationForm
  storeId={store.id}
  storeType="agent"
  packageId={selectedPackage.id}
  packageName={selectedPackage.name}
  amount={selectedPackage.sell_price}
/>
```

---

## Step 8: Payment Integration

### 8.1 Connect to Payment Provider

When customer submits AFA registration form, you need to process payment:

```tsx
// In AFARegistrationForm or parent component:
const handlePayment = async (registrationId: string, amount: number) => {
  // Option 1: Stripe Integration
  const session = await stripe.checkout.sessions.create({
    line_items: [{
      price_data: {
        currency: 'ghs',
        product_data: { name: `AFA Registration - ${packageName}` },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${window.location.origin}/success?registration_id=${registrationId}`,
    cancel_url: `${window.location.origin}/cancel`,
  });

  // Option 2: Mobile Money (MTN, Airtel, Telecel)
  // Call your mobile money API endpoint
  
  // Option 3: Direct API to AFA provider
  // Some providers handle payment themselves
};
```

### 8.2 Update Registration on Payment Success

After payment succeeds:

```tsx
// Update registration status in database:
await supabase
  .from('afa_registrations')
  .update({
    payment_status: 'completed',
    amount_paid: amount,
    updated_at: new Date().toISOString(),
  })
  .eq('id', registrationId);
```

---

## Step 9: Webhook Testing

### 9.1 Test Webhook Locally

Use ngrok to expose your local server:

```bash
npm install -g ngrok
ngrok http 3000
# Copy the URL: https://xxxxx.ngrok.io
```

### 9.2 Simulate Webhook Call

```bash
curl -X POST http://localhost:3000/api/webhooks/afa \
  -H "Content-Type: application/json" \
  -H "X-AFA-Signature: your_test_signature" \
  -d '{
    "ref_id": "AFA-2024-001234",
    "status": "verified",
    "verified": true
  }'
```

### 9.3 Check Webhook Logs

Monitor these in your browser console:
- `[Webhook]` - Incoming webhook
- `[AFA]` - AFA service logs
- Database updates in Supabase

---

## Step 10: Monitoring and Debugging

### 10.1 View AFA Registrations

```sql
-- Get all AFA registrations
SELECT 
  id, 
  customer_name, 
  customer_phone,
  registration_status,
  payment_status,
  created_at
FROM afa_registrations
ORDER BY created_at DESC;

-- Get by status
SELECT * FROM afa_registrations 
WHERE registration_status = 'pending';

-- Get by agent
SELECT * FROM afa_registrations 
WHERE agent_store_id = 'agent-uuid';
```

### 10.2 Monitor Pricing History

```sql
-- Track agent price changes
SELECT 
  agent_store_id,
  afa_package_id,
  sell_price,
  commission_amount,
  updated_at
FROM agent_afa_prices
ORDER BY updated_at DESC;
```

### 10.3 Enable Debug Logging

Add to your code:
```tsx
// Services
console.log("[AFA] Action:", data);

// Components
console.log("[v0] Registration form submitted");
```

---

## Troubleshooting

### Issue: "API Key not found"
- Solution: Check environment variables are set in Vercel/deployment
- Verify: `console.log(process.env.VITE_AFA_API_KEY)` (only logs ✓ if set)

### Issue: "Webhook signature validation failed"
- Solution: Ensure webhook secret matches between provider and `.env`
- Check: AFA provider sending correct signature header

### Issue: "Registration stuck on pending"
- Solution: Check if AFA provider webhook is being sent
- Verify: Webhook URL is publicly accessible
- Test: Use ngrok to simulate locally

### Issue: "Agents can't save custom prices"
- Solution: Check RLS policies in Supabase
- Verify: Agent is authenticated with correct user_id

### Issue: "Customer registration form not showing"
- Solution: Import component and add to page
- Check: AFA packages exist in database
- Verify: getAFAPackages() returns data

---

## Security Considerations

1. **API Key Protection**: Never expose in frontend code
2. **Webhook Validation**: Always validate signature
3. **RLS Policies**: Verify agents can only edit their own prices
4. **Input Sanitization**: Validate phone numbers and IDs
5. **Rate Limiting**: Implement on registration endpoint
6. **HTTPS Only**: Ensure all endpoints use HTTPS
7. **Data Encryption**: Consider encrypting sensitive customer data

---

## Next Steps

1. ✅ Database tables created
2. ✅ Environment variables configured
3. ✅ API integration tested
4. ✅ Admin can manage packages
5. ✅ Agents set custom prices
6. ✅ Customers register through storefront
7. ✅ Payments processed
8. ✅ Webhooks receiving updates

**You're ready to go live!** 🚀
