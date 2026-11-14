# AFA System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                             │
├─────────────────────────────────────────────────────────────────────┤
│                   AdminAFAManagement Component                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • Create/Edit/Delete AFA Packages                           │   │
│  │ • Set Base Prices (e.g., 50 GHS)                            │   │
│  │ • Set Commission Percentage (e.g., 10%)                     │   │
│  │ • Set Min/Max Price Limits                                  │   │
│  │ • Activate/Deactivate Packages                              │   │
│  └──────────────┬──────────────────────────────────────────────┘   │
└─────────────────┼──────────────────────────────────────────────────┘
                  │
                  │ (Stores in)
                  ▼
        ┌────────────────────┐
        │  afa_packages      │
        │  (Base Config)     │
        └─────────┬──────────┘
                  │
        ┌─────────┴───────────────────────┐
        │                                 │
        ▼                                 ▼
    ┌──────────────────┐         ┌──────────────────┐
    │ AGENT DASHBOARD  │         │ SUBAGENT DASHBOARD│
    ├──────────────────┤         ├──────────────────┤
    │AFAPriceManager   │         │AFAPriceManager   │
    │ • Set Sell Price │         │ • Set Sell Price │
    │ • View Commission│         │ • View Commission│
    │ • Edit Prices    │         │ • Edit Prices    │
    └────────┬─────────┘         └────────┬─────────┘
             │                           │
             │ (Stores in)               │ (Stores in)
             ▼                           ▼
    ┌────────────────────┐     ┌────────────────────┐
    │agent_afa_prices    │     │subagent_afa_prices │
    │(Custom Pricing)    │     │(Custom Pricing)    │
    └────────┬───────────┘     └────────┬───────────┘
             │                         │
             └───────────┬─────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   STOREFRONT / AGENT STORE     │
        ├────────────────────────────────┤
        │ • Display AFA Packages         │
        │ • Show Agent's Custom Prices   │
        │ • Display Sell Price to Customer
        └────────┬─────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │  AFARegistrationForm Component │
        ├────────────────────────────────┤
        │ Customer enters:                │
        │ • Name, Phone, ID              │
        │ • DOB, Town, Occupation        │
        │ • Region, Crop                 │
        └────────┬─────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │   registerAFA() Service Call   │
        ├────────────────────────────────┤
        │ • Validate customer data       │
        │ • Call AFA Provider API        │
        │ • Get ref_id from provider     │
        └────────┬─────────────────────┘
                 │
                 ├─────────────────┬─────────────────┐
                 │ (Saves to)      │                 │
                 ▼                 ▼                 ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌─────┐
        │afa_registrations │  │AFA Provider API  │  │Pay. │
        │ • Status:pending │  │ • Register user  │  │Gway │
        │ • Phone, Name    │  │ • Verify details │  │     │
        │ • ref_id         │  │ • Return ref_id  │  │     │
        └──────────────────┘  └──────────────────┘  └─────┘
                 │                                     │
                 │                              Payment Processing
                 │                                     │
                 └────────────┬──────────────────────┘
                              │
                        Customer Pays (50-55 GHS)
                              │
                              ▼
                    ┌─────────────────┐
                    │ Payment Success │
                    └────────┬────────┘
                             │
                    Update payment_status
                             │
                             ▼
                ┌──────────────────────────┐
                │ AFA Provider Webhook     │
                │ (Webhook Handler)        │
                ├──────────────────────────┤
                │ • Receives update from   │
                │   AFA provider           │
                │ • Validates signature    │
                │ • Updates reg. status    │
                └────────┬─────────────────┘
                         │
                 Update registration_status
                    (pending → verified)
                         │
                         ▼
                ┌──────────────────────────┐
                │ afa_registrations        │
                │ • Status: verified       │
                │ • Registration confirmed │
                └──────────────────────────┘
```

---

## Data Flow: From Admin to Customer Payment

```
STEP 1: Admin Creates Package
   Admin Dashboard → AdminAFAManagement
   ↓
   afa_packages table
   ├─ id: uuid
   ├─ name: "Standard AFA"
   ├─ base_price: 50.00
   ├─ commission_percent: 10
   └─ is_active: true

STEP 2: Agent Sets Custom Price
   Agent Dashboard → AFAPriceManager
   ↓
   agent_afa_prices table
   ├─ agent_store_id: uuid
   ├─ afa_package_id: uuid (from afa_packages)
   ├─ sell_price: 55.00
   └─ commission_amount: 5.00

STEP 3: Customer Registers
   Storefront → AFARegistrationForm
   ↓
   afa_registrations table
   ├─ customer_name: "John Doe"
   ├─ customer_phone: "+233501234567"
   ├─ afa_package_id: uuid
   ├─ amount_paid: 55.00 (agent's price)
   ├─ registration_status: "pending"
   └─ payment_status: "pending"

STEP 4: Customer Pays
   Payment Gateway (Stripe/PayPal/Mobile Money)
   ↓
   afa_registrations.payment_status = "completed"
   afa_registrations.amount_paid = 55.00

STEP 5: AFA Provider Webhook
   AFA Provider calls /api/webhooks/afa
   ↓
   handleAFAWebhook() function validates & processes
   ↓
   afa_registrations.registration_status = "verified"

RESULT:
   • Admin received: 50.00 GHS
   • Agent earned: 5.00 GHS commission
   • Customer registered: Successfully
```

---

## Database Relations

```
┌──────────────────────────────────────────────────────────┐
│                   afa_packages                           │
│  (Admin manages - base configuration for all stores)     │
├──────────────────────────────────────────────────────────┤
│  id (PK)  │ name │ base_price │ commission_percent      │
├───────────┼──────┼────────────┼───────────────────────┤
│  UUID-1   │ Std  │   50.00    │        10              │
│  UUID-2   │ Prem │   100.00   │        15              │
└─────┬──────────────────────────┬──────────────────────┘
      │                          │
      │ (One-to-Many)            │ (One-to-Many)
      ▼                          ▼
┌──────────────────────┐   ┌───────────────────────┐
│agent_afa_prices      │   │subagent_afa_prices    │
│(Agent overrides)     │   │(Subagent overrides)   │
├──────────────────────┤   ├───────────────────────┤
│agent_id │ pkg_id │ price│suagent_id │ pkg_id │ price
│UUID-A   │ UUID-1 │ 55.00│ UUID-S   │ UUID-1 │ 52.50
│UUID-A   │ UUID-2 │110.00│ UUID-S   │ UUID-2 │ 105.00
└──────────────────────┘   └───────────────────────┘
      │                          │
      │ (Referenced by)          │ (Referenced by)
      └─────────────┬────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  afa_registrations        │
        │  (Customer records)       │
        ├───────────────────────────┤
        │ id │ cust_phone │ pkg_id  │
        │    │ amount     │ status  │
        ├────┼────────────┼─────────┤
        │U1  │ +233...    │ UUID-1  │
        │U2  │ +233...    │ UUID-2  │
        └───────────────────────────┘
```

---

## Component Dependencies

```
AdminDashboard.tsx
├── AdminAFAManagement
│   ├── afa-service.getAFAPackages()
│   ├── afa-service.setAFAPrice()
│   ├── supabase (create/update/delete)
│   └── useToast()

AgentDashboard.tsx
├── AFAPriceManager
│   ├── afa-service.getAFAPackages(storeId, 'agent')
│   ├── afa-service.setAFAPrice()
│   ├── supabase
│   └── useToast()

SubagentDashboard.tsx
├── AFAPriceManager
│   ├── afa-service.getAFAPackages(storeId, 'subagent')
│   ├── afa-service.setAFAPrice()
│   ├── supabase
│   └── useToast()

Index.tsx (Storefront)
├── AFARegistrationForm
│   ├── afa-service.registerAFA()
│   ├── payment gateway
│   └── useToast()

AgentStorefront.tsx
├── AFARegistrationForm
│   ├── afa-service.registerAFA(storeId, 'agent')
│   ├── afa-service.getAFAPackages()
│   └── useToast()

api/webhooks/afa.ts
├── afa-service.handleAFAWebhook()
├── signature validation
└── supabase update
```

---

## Environment Variables Flow

```
.env.local (Development)
├─ VITE_AFA_API_KEY
├─ VITE_AFA_API_URL
└─ VITE_AFA_WEBHOOK_SECRET
   │
   └─→ import.meta.env (Vite)
       └─→ afa-service.ts
           ├─ registerAFA()
           ├─ verifyAFAStatus()
           └─ handleAFAWebhook()

Vercel Environment Variables (Production)
├─ Production environment
│  ├─ VITE_AFA_API_KEY (prod)
│  ├─ VITE_AFA_API_URL (prod)
│  └─ VITE_AFA_WEBHOOK_SECRET (prod)
│
├─ Preview environment
│  ├─ VITE_AFA_API_KEY (staging)
│  ├─ VITE_AFA_API_URL (staging)
│  └─ VITE_AFA_WEBHOOK_SECRET (staging)
│
└─ Development environment
   ├─ VITE_AFA_API_KEY (test)
   ├─ VITE_AFA_API_URL (test)
   └─ VITE_AFA_WEBHOOK_SECRET (test)
```

---

## Security & Permissions

```
┌─────────────────────────────────────────────────────────┐
│              Row Level Security (RLS) Policies           │
├─────────────────────────────────────────────────────────┤

afa_packages
└─ Everyone can view
└─ Only Admin can create/update/delete

agent_afa_prices
└─ Agent can only view their own prices
└─ Admin can view all
└─ Agent can only insert for their own store

subagent_afa_prices
└─ Subagent can only view their own prices
└─ Admin can view all
└─ Subagent can only insert for their own store

afa_registrations
└─ Agent/Subagent can view registrations for their store
└─ Admin can view all
└─ Anyone can create (public registration)
```

---

## Key Features Summary

| Feature | Location | Status |
|---------|----------|--------|
| Package Management | AdminAFAManagement | ✅ Complete |
| Agent Pricing | AFAPriceManager | ✅ Complete |
| Subagent Pricing | AFAPriceManager | ✅ Complete |
| Customer Registration | AFARegistrationForm | ✅ Complete |
| API Integration | afa-service.ts | ✅ Complete |
| Webhook Handling | api/webhooks/afa.ts | ✅ Complete |
| Payment Integration | Parent components | 🔄 Needs implementation |
| RLS Policies | SUPABASE_SETUP.sql | ✅ Complete |
| Error Handling | All services | ✅ Complete |
| Documentation | AFA_*.md files | ✅ Complete |

---

This architecture ensures:
- **Scalability**: Components are modular and reusable
- **Security**: RLS policies protect data per user
- **Flexibility**: Agents/subagents set independent prices
- **Transparency**: Commission calculations are automatic
- **Reliability**: Webhook system keeps data synchronized
