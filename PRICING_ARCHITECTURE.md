# Complete Pricing Architecture - Agent → SubAgent → SubSubAgent

## SYSTEM FLOW

### 1. AGENT → SUBAGENT PRICING (Already Working)

**Tables:**
- `data_packages` - Admin's base prices (price column)
- `agent_custom_base_prices` - Admin sets custom cost for agents (agent_store_id, custom_base_price)
- `subagent_package_prices` - Agents set prices for their subagents (agent_store_id, package_id, base_price)

**Agent Dashboard:**
- SubagentPricesManager component
- Saves to: `subagent_package_prices` table with `agent_store_id`
- Formula: Agent's Cost = admin's custom price OR default package price
- Formula: Subagent's Cost from Agent = agent_store_id in `subagent_package_prices.base_price`

**SubAgent Dashboard (Cost from Agent):**
- Fetches: `SELECT * FROM subagent_package_prices WHERE agent_store_id = {their_agent_id}`
- Column: `base_price` = what agent charges them
- This shows in the "Cost from Agent" column
- Subagents set their selling price ABOVE this

**SubAgent saves their own prices:**
- Saves to: `subagent_package_prices` table with `subagent_store_id` (NOT agent_store_id)
- Formula: Subagent Profit = Their Selling Price - Cost from Agent

---

### 2. SUBAGENT → SUBSUBAGENT PRICING (What We Need To Fix)

**Should Mirror Agent → SubAgent Exactly:**

**Tables:**
- `data_packages` - Base prices (same table)
- `subagent_custom_base_prices` - (NEEDS TO BE CREATED) Subagent sets custom cost for sub-subagents
- `sub_subagent_package_prices` - Subagents set prices for their sub-subagents (subagent_store_id, package_id, base_price)

**Subagent Dashboard (Setting Sub-SubAgent Prices):**
- Component: SubSubagentPricesManager (NEEDS TO BE CREATED - COPY SubagentPricesManager)
- Saves to: `sub_subagent_package_prices` table with `subagent_store_id`
- Formula: SubSubagent's Cost from Subagent = base_price in table
- Subagents set what they charge their sub-subagents

**SubSubAgent Dashboard (Cost from SubAgent):**
- Fetches: `SELECT * FROM sub_subagent_package_prices WHERE subagent_store_id = {their_subagent_id}`
- Column: `base_price` = what subagent charges them
- Should show in "Cost from Agent" column (rename it to reflect the parent type)
- SubSubagents set their selling price ABOVE this

**SubSubAgent saves their own prices:**
- Saves to: `sub_subagent_package_prices` table with `sub_subagent_store_id`
- Formula: SubSubagent Profit = Their Selling Price - Cost from SubAgent

---

## EXACT SAME LOGIC - THREE LAYERS

### Layer 1: ADMIN → AGENT
- Admin sets base prices in `data_packages`
- Admin can override with `agent_custom_base_prices`
- Agent's cost = admin's override OR default package price

### Layer 2: AGENT → SUBAGENT  
- Agent sets prices in `subagent_package_prices` (agent_store_id)
- Subagent's cost = agent's price from `subagent_package_prices`
- Subagent sets their selling price above this in `subagent_package_prices` (subagent_store_id)

### Layer 3: SUBAGENT → SUBSUBAGENT
- Subagent sets prices in `sub_subagent_package_prices` (subagent_store_id)  
- SubSubagent's cost = subagent's price from `sub_subagent_package_prices`
- SubSubagent sets their selling price above this in `sub_subagent_package_prices` (sub_subagent_store_id)

---

## IMPLEMENTATION CHECKLIST

**SubagentDashboard Changes:**
- [ ] Create SubSubagentPricesManager component (copy SubagentPricesManager)
- [ ] Fetch uses: `sub_subagent_package_prices` table
- [ ] Query: `agent_store_id = selectedSubSubagentId` (NOT subagent_store_id!)
- [ ] Save inserts: agent_store_id = selectedSubSubagentId, package_id, base_price

Wait - the field should be `subagent_store_id` NOT `agent_store_id` for the subagent setting prices.

Actually looking at the table: `sub_subagent_package_prices` has these columns:
- sub_subagent_store_id - which sub-subagent
- subagent_store_id - which subagent is setting the price
- package_id - which package
- base_price - the price subagent set for this package
- sell_price - what sub-subagent set for themselves

So SubagentDashboard should:
- Fetch existing prices: `WHERE subagent_store_id = my_subagent_id`
- When saving for a sub-subagent: insert `subagent_store_id = my_id, sub_subagent_store_id = selected_id, base_price = price`

**SubSubagentDashboard Changes:**
- [ ] Fetch uses: `sub_subagent_package_prices` table
- [ ] Query: `WHERE subagent_store_id = their_subagent_parent_id AND sub_subagent_store_id = my_id`
- [ ] This shows prices parent set for THIS store specifically
- [ ] Save inserts: sub_subagent_store_id = my_id, subagent_store_id = my_parent_id, sell_price = my_price
