# AFA Registration Pricing Guide

## Overview
The AFA (Agriculture and Farming Association) registration pricing system has three tiers:
1. **Admin Base Price** - Set in Admin Dashboard
2. **Agent Selling Price** - Set in Agent Dashboard  
3. **Customer Pays** - What customers actually pay (agent's price)

---

## 1. WHERE TO SET THE BASE PRICE (ADMIN)

### Location: Admin Dashboard → AFA → Settings Tab

**Steps:**
1. Go to Admin Dashboard
2. Navigate to **"AFA"** section
3. Click on **"Settings"** tab
4. Find the field labeled **"Base Registration Fee (GH₵)""
5. Enter your base price (e.g., 50.00)
6. Click **"Save Settings"** button

**What this controls:**
- The minimum price agents can set
- Base amount admin receives per registration
- Shows on customer checkout as "base price"

**Example:**
- You set base price to GH₵50
- This is the minimum agents can charge
- Agents can set GH₵60, GH₵75, etc. (higher prices)
- You receive GH₵50, agent keeps the markup

---

## 2. WHERE TO SET THE AGENT PRICE

### Location: Agent Dashboard → "AFA Bundle Registration Price" Card

**Steps:**
1. Go to Agent Dashboard
2. Look for the green card with **"AFA Bundle Registration Price"** heading
3. You'll see three columns:
   - **Column 1:** "Admin Minimum Price" - Shows what admin set (e.g., GH₵50) - **READ ONLY**
   - **Column 2:** "Your Asking Price (GH₵)" - **TYPE YOUR PRICE HERE**
   - **Column 3:** "Save Price" button
4. Enter your desired price (must be ≥ admin minimum)
5. Click **"Save Price"** button

**What this controls:**
- What your customers see and pay
- Your profit from each registration
- Updates in real-time on your storefront

**Example:**
- Admin base price: GH₵50
- You set your price: GH₵60
- Customer pays: GH₵60
- You receive as profit: GH₵10
- Admin receives: GH₵50

---

## 3. WHERE PRICES APPEAR ON CUSTOMER STOREFRONTS

### Package/AFA Registration Section
- Shows the base price crossed out
- Shows the agent's price in large text
- Shows markup amount
- "Register" button displays: "Register (GH₵60.00)" or whatever agent price is

### Registration Form
- When customer clicks Register
- Form shows the price they'll pay
- Price matches agent's set price (or admin base if no agent price set)
- Payment redirects to Paystack with correct amount

---

## 4. REAL-TIME UPDATES

### When Admin Changes Price:
- All agent dashboards update instantly
- Shows new minimum price they must meet
- Existing agent prices remain unchanged (only new minimum enforced)

### When Agent Changes Price:
- Customer storefront updates within 3-5 seconds
- New price appears on packages page
- "Register" button shows new price
- Updates reflect across all customer views

---

## 5. PRICING LOGIC

### Admin Sets: GH₵50 (base registration fee)

**Agent 1 sets: GH₵50**
- Customer pays: GH₵50
- Admin gets: GH₵50
- Agent gets: GH₵0

**Agent 2 sets: GH₵60**
- Customer pays: GH₵60
- Admin gets: GH₵50
- Agent gets: GH₵10 (markup)

**Agent 3 sets: GH₵100**
- Customer pays: GH₵100
- Admin gets: GH₵50
- Agent gets: GH₵50 (markup)

---

## 6. VERIFICATION

### As Admin:
1. Go to Admin Dashboard → AFA → Settings
2. Set base price to specific amount (e.g., GH₵75)
3. Save
4. Check agent dashboard - should show GH₵75 as minimum
5. Check customer storefront - should show new price

### As Agent:
1. Go to Agent Dashboard → AFA Bundle Registration Price
2. See the admin minimum price displayed
3. Enter your desired price (must be ≥ minimum)
4. Save
5. Check your storefront - should show your price within seconds

### As Customer:
1. Visit packages/AFA section
2. See agent's price displayed (not admin base)
3. "Register" button shows agent's price
4. Click register and see same price in form

---

## 7. TROUBLESHOOTING

### Issue: Registration form shows wrong price

**Solution:** 
- Reload the page
- Check that admin price is set in Admin Dashboard
- Verify agent has set their price in Agent Dashboard
- Prices update in real-time; may take 3-5 seconds to reflect

### Issue: Agent dashboard shows "Loading..." for minimum price

**Solution:**
- Wait a few seconds for data to load
- Refresh the page
- Ensure admin has saved settings at least once

### Issue: Customer price doesn't match what I set

**Solution:**
- Check you're looking at the right agent storefront
- Verify price was saved (button should not be loading)
- Clear browser cache and refresh
- Check that base price is set in admin settings

---

## 8. IMPORTANT NOTES

- **Admin price is minimum** - Agents cannot charge less than this
- **Real-time updates** - Changes appear instantly or within 3-5 seconds
- **One-time setup** - Just set the price once, customers see it automatically
- **Agent can change anytime** - No restrictions on when price can be updated
- **Per-registration payment** - Each registration is a separate payment via Paystack
