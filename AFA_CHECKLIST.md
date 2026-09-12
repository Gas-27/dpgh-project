# AFA Registration System - Quick Reference Checklist

## Phase 1: Initial Setup ✓

- [ ] **Database**: Run SUPABASE_SETUP.sql to create AFA tables
  ```sql
  - afa_packages
  - agent_afa_prices
  - subagent_afa_prices
  - afa_registrations
  ```

- [ ] **Environment Variables**: Set up `.env.local`
  ```
  VITE_AFA_API_KEY=...
  VITE_AFA_API_URL=...
  VITE_AFA_WEBHOOK_SECRET=...
  ```

- [ ] **Vercel**: Add environment variables for production/preview/dev
  - Go to Settings → Environment Variables
  - Add each variable for all environments
  - Redeploy

## Phase 2: Admin Configuration ✓

- [ ] **Add to AdminDashboard.tsx**:
  ```tsx
  import AdminAFAManagement from "@/components/AdminAFAManagement";
  // Add TabsTrigger and TabsContent for AFA Management
  ```

- [ ] **Create Initial Packages**:
  - Go to Admin Dashboard → AFA Management
  - Create test package (e.g., "Standard AFA" - 50 GHS)
  - Create production packages

- [ ] **Set Base Prices**: Admin defines base price for each package

- [ ] **Set Commission %**: Default commission per package

- [ ] **Set Price Limits**: Min/max prices agents can set (optional)

## Phase 3: Agent Integration ✓

- [ ] **Add to AgentDashboard.tsx**:
  ```tsx
  import AFAPriceManager from "@/components/AFAPriceManager";
  // Add component to dashboard
  ```

- [ ] **Agents Configure Prices**:
  - Each agent logs in → Dashboard → AFA Pricing
  - Agents set sell price for each package
  - Commission calculated automatically

## Phase 4: Subagent Integration ✓

- [ ] **Add to SubagentDashboard.tsx**:
  ```tsx
  import AFAPriceManager from "@/components/AFAPriceManager";
  // Add component to dashboard
  ```

- [ ] **Subagents Configure Prices**: Same as agents

## Phase 5: Storefront Registration ✓

- [ ] **Add to Index.tsx** (Main Storefront):
  ```tsx
  import AFARegistrationForm from "@/components/AFARegistrationForm";
  // Display AFA packages and registration form
  ```

- [ ] **Add to AgentStorefront.tsx**:
  ```tsx
  // Show AFA registration with agent's prices
  ```

- [ ] **Add to SubagentStorefront.tsx**:
  ```tsx
  // Show AFA registration with subagent's prices
  ```

## Phase 6: Payment Integration ✓

- [ ] **Implement Payment Handler**:
  - [ ] Connect Stripe/PayPal/Mobile Money
  - [ ] Process payment on registration
  - [ ] Update payment_status in database

- [ ] **Handle Success Response**:
  - [ ] Confirm payment in database
  - [ ] Send confirmation to customer
  - [ ] Trigger AFA provider registration

## Phase 7: Webhook Configuration ✓

- [ ] **Webhook Handler Created**: `/api/webhooks/afa.ts`

- [ ] **Configure AFA Provider Webhook**:
  - [ ] Set webhook URL: `https://your-domain.com/api/webhooks/afa`
  - [ ] Set webhook secret (same as VITE_AFA_WEBHOOK_SECRET)
  - [ ] Enable events: registration_verified, registration_active, registration_rejected
  - [ ] Test connection

- [ ] **Monitor Webhooks**:
  - [ ] Check browser console for `[Webhook]` logs
  - [ ] Verify registration_status updates in database

## Phase 8: Testing ✓

- [ ] **Local Testing**:
  ```bash
  npm run dev
  # Test with sandbox credentials
  ```

- [ ] **Admin Test**:
  - [ ] Login as admin
  - [ ] Create test AFA package
  - [ ] Verify in database

- [ ] **Agent Test**:
  - [ ] Login as agent
  - [ ] Set custom price for package
  - [ ] Verify price shows in agent storefront

- [ ] **Customer Test**:
  - [ ] Go to storefront
  - [ ] Fill AFA registration form
  - [ ] Submit and verify in database
  - [ ] Check payment processing

- [ ] **Webhook Test**:
  - [ ] Simulate webhook callback
  - [ ] Verify registration_status updates
  - [ ] Check logs

## Phase 9: Production Deployment ✓

- [ ] **Get Production Credentials**:
  - [ ] Request from AFA provider
  - [ ] Test in staging first

- [ ] **Update Environment Variables**:
  - [ ] Replace sandbox with production keys
  - [ ] Redeploy to production

- [ ] **Configure Production Webhook**:
  - [ ] Update webhook URL in AFA provider dashboard
  - [ ] Use production domain
  - [ ] Test connection

- [ ] **Monitor Live**:
  - [ ] Check registration success rate
  - [ ] Monitor payment processing
  - [ ] Track commission calculations

## Phase 10: Maintenance ✓

- [ ] **Regular Checks**:
  - [ ] Review pending registrations
  - [ ] Monitor failed payments
  - [ ] Check webhook delivery

- [ ] **Analytics**:
  ```sql
  -- Registration rate
  SELECT DATE(created_at), COUNT(*) 
  FROM afa_registrations 
  GROUP BY DATE(created_at);

  -- Success rate
  SELECT 
    registration_status, 
    COUNT(*) 
  FROM afa_registrations 
  GROUP BY registration_status;

  -- Revenue
  SELECT 
    afa_package_id, 
    SUM(amount_paid) 
  FROM afa_registrations 
  GROUP BY afa_package_id;
  ```

- [ ] **Support**:
  - [ ] Document common issues
  - [ ] Setup support ticket system
  - [ ] Monitor error logs

---

## Database Queries

### View All Registrations
```sql
SELECT * FROM afa_registrations ORDER BY created_at DESC;
```

### View Pending Registrations
```sql
SELECT * FROM afa_registrations 
WHERE registration_status = 'pending' 
ORDER BY created_at DESC;
```

### View Agent Prices
```sql
SELECT 
  a.store_name,
  p.name,
  ap.sell_price,
  ap.commission_amount
FROM agent_afa_prices ap
JOIN agent_stores a ON ap.agent_store_id = a.id
JOIN afa_packages p ON ap.afa_package_id = p.id;
```

### Calculate Revenue
```sql
SELECT 
  p.name,
  COUNT(*) as registrations,
  SUM(ar.amount_paid) as total_revenue,
  SUM(ap.commission_amount) as total_commission
FROM afa_registrations ar
JOIN afa_packages p ON ar.afa_package_id = p.id
JOIN agent_afa_prices ap ON ap.afa_package_id = p.id
WHERE ar.payment_status = 'completed'
GROUP BY p.id;
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| API Key not working | Verify in Vercel → Settings → Env Vars |
| Webhook not received | Check webhook URL is public, verify secret matches |
| Prices not saving | Check RLS policies in Supabase |
| Registration failing | Check API provider is online, verify credentials |
| Payment not processing | Verify payment provider integration |
| Commission calculating wrong | Check base_price vs sell_price calculation |

---

## Support

- **Documentation**: See AFA_SETUP_GUIDE.md
- **Code**: Check `/src/services/afa-service.ts`
- **Components**: `/src/components/AFA*.tsx`
- **API**: `/src/pages/api/webhooks/afa.ts`

For more help, contact your AFA provider support team.
