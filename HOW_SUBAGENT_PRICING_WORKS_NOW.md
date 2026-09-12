# How SubAgent Pricing Works Now

## The Complete Workflow

### **1. SubAgent Sets Sub-Subagent Prices (BEFORE any sub-subagents exist)**

**Steps:**
1. Go to SubAgent Dashboard → "Sub-Subagent Pricing" tab
2. Select network (MTN, AirtelTigo, or Telecel)
3. Enter prices for each package size (e.g., GH₵ 5.00 for 1GB)
4. Optionally apply markup (e.g., +10%)
5. Click "Save Prices"

**Data Saved:**
- Table: `subagent_package_prices`
- Columns: `subagent_store_id`, `package_id`, `sell_price` (your selling price)

**Important:** You can do this EVEN IF you have NO sub-subagents yet.

---

### **2. New Sub-Subagent Registers**

**What happens:**
1. User registers on your storefront (SubagentStorefront)
2. New record inserted into `sub_subagent_stores` table
3. Their user account is created

**Behind the scenes:**
- The system automatically fetches your saved prices from `subagent_package_prices`
- These become the new sub-subagent's BASE PRICES

---

### **3. New Sub-Subagent Logs Into Their Dashboard**

**What they see:**
1. Opens SubSubagentDashboard → "Store Prices" tab
2. Base prices appear automatically (from your `subagent_package_prices`)
3. These show in "Your Cost from Agent" column

**Example:**
- You saved: GH₵ 5.00 for 1GB
- Sub-Subagent sees: "Your Cost from Agent: GH₵ 5.00"

---

### **4. Sub-Subagent Sets Their Selling Prices**

**They can:**
1. Edit prices above their base cost (e.g., GH₵ 5.50)
2. Apply markup for profit
3. Save prices

**Their prices saved:**
- Table: `subagent_package_prices` (but with THEIR ID as `subagent_store_id`)
- Base: GH₵ 5.00 | Their Selling: GH₵ 5.50 | Profit: GH₵ 0.50

---

### **5. Sub-Subagent Storefront Shows Prices**

**End customers see:**
- Prices from sub-subagent's `subagent_package_prices` table
- Example: 1GB = GH₵ 5.50

---

## The Data Flow

```
SubAgent Dashboard (Sub-Subagent Pricing tab)
    ↓
    Saves to: subagent_package_prices 
    (subagent_store_id = their_id, sell_price = price)
    ↓
New Sub-Subagent Registers
    ↓
Sub-SubagentDashboard (Store Prices tab)
    ↓
    Queries: subagent_package_prices
    (subagent_store_id = my_parent_id)
    ↓
    Shows as "Cost from Agent"
    ↓
Sub-Subagent sets their selling price above cost
    ↓
    Saves to: subagent_package_prices
    (subagent_store_id = their_id, sell_price = their_price)
    ↓
Sub-SubagentStorefront
    ↓
    Shows their selling prices to customers
```

---

## Key Points

1. **No sub-subagents needed:** You can set prices before anyone registers
2. **Automatic inheritance:** New sub-subagents automatically get your saved prices
3. **Same table system:** Both use `subagent_package_prices`, just different `subagent_store_id` values
4. **Identical UI:** Both "Store Prices" and "Sub-Subagent Pricing" tabs look and work the same
5. **Price hierarchy:**
   - Agent's base: GH₵ 4.00
   - You charge: GH₵ 5.00 (saved in your Sub-Subagent Pricing tab)
   - Sub-Subagent charges: GH₵ 5.50 (saved in their Store Prices tab)
   - Customer pays: GH₵ 5.50

---

## Testing

1. **Set prices before registering anyone:**
   - Go to SubAgent Dashboard → Sub-Subagent Pricing
   - Enter prices (e.g., 1GB = GH₵ 5.00)
   - Click Save Prices
   - Check database: `subagent_package_prices` should have rows

2. **Register a new sub-subagent:**
   - Visit your SubagentStorefront
   - Click "Register as Sub-Subagent"
   - Complete registration

3. **Check new sub-subagent's dashboard:**
   - They log in
   - Go to Store Prices tab
   - "Your Cost from Agent" = GH₵ 5.00 (the price you set)
   - They can now set their own selling price above that

---

## Database Reference

**Table: `subagent_package_prices`**
- `subagent_store_id`: Who is charging
- `package_id`: Which package
- `base_price`: Cost they paid (for display)
- `sell_price`: Price they charge others
- `subagent_minimum_price`: Minimum allowed

**Example rows:**

| subagent_store_id | package_id | base_price | sell_price |
|---|---|---|---|
| agent-A | 1gb | 4.00 | 5.00 |
| agent-A | 2gb | 8.00 | 10.00 |
| subsub-B | 1gb | 5.00 | 5.50 |
| subsub-B | 2gb | 10.00 | 11.00 |

When SubSubagent-B logs in and checks "Cost from Agent", they query:
```sql
SELECT * FROM subagent_package_prices 
WHERE subagent_store_id = 'agent-A'
```
And see: base_price = GH₵ 5.00 (what their parent set for them)

---

## Summary

The Sub-Subagent Pricing tab now works **exactly like Store Prices** - you set prices for your sub-subagents before they even exist, and when they register, they automatically inherit those prices as their base cost.
