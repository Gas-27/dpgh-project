# How SubAgent→SubSubAgent Pricing Works Now

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXACT WORKFLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: SubAgent Logs In
═══════════════════════════════════════════════════════════════════════════════
┌──────────────────────────────────┐
│ SubagentDashboard opens          │
│ ├─ Checks: selectedSubSubagentId │
│ ├─ Finds: NO sub-subagent yet    │
│ └─ Shows: "Select a sub-subagent" UI
└──────────────────────────────────┘


STEP 2: SubAgent Selects SubSubAgent (onChange event)
═══════════════════════════════════════════════════════════════════════════════
┌──────────────────────────────────────────────────────────────────────┐
│ Select dropdown triggers:                                           │
│ onValueChange={setSelectedSubSubagentId}                           │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
                    (setSelectedSubSubagentId called)
                              ↓
        ┌───────────────────────────────────────────────┐
        │ This changes state                            │
        │ → useEffect dependency array [selectedSubSubagentId]
        │   detects change                             │
        └───────────────────────────────────────────────┘
                              ↓
   ┌──────────────────────────────────────────────────────────────┐
   │ useEffect fires (Line 423-460)                              │
   │                                                             │
   │ if (!selectedSubSubagentId || !subagentStore?.id) return;  │
   │ // We have both, so continue...                           │
   │                                                             │
   │ fetchSubSubagentPricing() async function                   │
   └──────────────────────────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────┐
        │ DATABASE QUERY FIRES                 │
        │                                      │
        │ SELECT package_id, base_price        │
        │ FROM sub_subagent_package_prices    │
        │ WHERE subagent_store_id = 'B'        │
        │   AND sub_subagent_store_id = 'C'   │
        │                                      │
        │ Results: [                           │
        │   {package_id: pkg1, base_price: 5},│
        │   {package_id: pkg2, base_price: 6},│
        │   ...                                │
        │ ]                                    │
        └──────────────────────────────────────┘
                              ↓
   ┌───────────────────────────────────────────────────┐
   │ setSubSubagentBasePrices(basePriceMap)           │
   │                                                  │
   │ {                                               │
   │   "pkg1": 5.00,                                │
   │   "pkg2": 6.00,                                │
   │   ...                                          │
   │ }                                              │
   └───────────────────────────────────────────────────┘
                              ↓
        ┌──────────────────────────────────────┐
        │ Table re-renders with prices!        │
        │                                      │
        │ Size | Your Cost | Price for SubSub  │
        │ 1GB  | 4.50      | 5.00              │
        │ 2GB  | 5.50      | 6.00              │
        │ ...  | ...       | ...               │
        └──────────────────────────────────────┘


STEP 3: SubAgent Edits Prices
═══════════════════════════════════════════════════════════════════════════════
┌────────────────────────────────────────────────────────────┐
│ User types new price in input: 5.25                       │
│ onChange fires: handleSubSubagentPriceChange(pkg1, "5.25")
└────────────────────────────────────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ setSubSubagentEditedSubSubPrices({                     │
  │   "pkg1": 5.25,  // NEW value                         │
  │   // other prices unchanged                           │
  │ })                                                     │
  └────────────────────────────────────────────────────────┘
                              ↓
      ┌──────────────────────────────────────┐
      │ Input UI updates:                    │
      │ ├─ Value shows: 5.25                │
      │ ├─ Border turns BLUE (unsaved)      │
      │ └─ "Save Prices" button appears     │
      └──────────────────────────────────────┘


STEP 4: SubAgent Applies Markup (Optional)
═══════════════════════════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────┐
│ User enters: +15 in markup field                   │
│ Clicks: Apply button                               │
│ Calls: applySubSubagentMarkupForSubsub()          │
└─────────────────────────────────────────────────────┘
                              ↓
  ┌────────────────────────────────────────────────────────┐
  │ For each MTN package:                                 │
  │   basePrice = basePrices[pkg.id] = 4.50             │
  │   newPrice = 4.50 * (1 + 0.15) = 5.175            │
  │   → setEditedPrices[pkg.id] = 5.18                 │
  └────────────────────────────────────────────────────────┘
                              ↓
      ┌──────────────────────────────┐
      │ All MTN prices +15%          │
      │ Inputs turn BLUE (unsaved)   │
      │ Toast: "Markup applied!"     │
      └──────────────────────────────┘


STEP 5: SubAgent Saves Prices
═══════════════════════════════════════════════════════════════════════════════
┌────────────────────────────────────────────────────┐
│ User clicks: "Save Prices" button                 │
│ Calls: saveSubSubagentPrices()                    │
└────────────────────────────────────────────────────┘
                              ↓
    ┌──────────────────────────────────────────────┐
    │ VALIDATION LOOP                              │
    │                                             │
    │ For each edited price:                      │
    │   ├─ Parse price (5.25)                    │
    │   ├─ Get basePrice (4.50)                  │
    │   ├─ Check: 5.25 >= 4.50?  ✓ YES          │
    │   └─ If NO → Error toast, cancel           │
    └──────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │ SAVE LOOP                               │
        │                                         │
        │ For each edited price:                  │
        │   1. DELETE old record                  │
        │   2. INSERT new record                  │
        └─────────────────────────────────────────┘
                              ↓
         ┌───────────────────────────────────────┐
         │ DELETE FROM sub_subagent_package_prices
         │ WHERE subagent_store_id = 'B'         │
         │   AND sub_subagent_store_id = 'C'     │
         │   AND package_id = 'pkg1'             │
         │                                       │
         │ [Old price for (B, C, pkg1) removed]  │
         └───────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ INSERT INTO sub_subagent_package_prices
         │ VALUES (                               │
         │   subagent_store_id: 'B',             │
         │   sub_subagent_store_id: 'C',         │
         │   package_id: 'pkg1',                 │
         │   base_price: 5.25,     ← THE KEY!   │
         │   subagent_minimum_price: 5.25,      │
         │   sell_price: 5.25                    │
         │ )                                     │
         │                                       │
         │ [New price for (B, C, pkg1) saved]    │
         └────────────────────────────────────────┘
                              ↓
       ┌───────────────────────────────────────────┐
       │ State updates:                            │
       │ ├─ setSubSubagentBasePrices ({            │
       │ │    "pkg1": 5.25,  ← NOW UPDATED       │
       │ │    "pkg2": 6.00                        │
       │ │  })                                    │
       │ ├─ setSubSubagentEditedSubSubPrices({}) │
       │ └─ Inputs turn GREEN with "Saved" label │
       └───────────────────────────────────────────┘


STEP 6: SubSubAgent Logs In (How They See It)
═══════════════════════════════════════════════════════════════════════════════
┌────────────────────────────────────────────────┐
│ SubSubagentDashboard opens                     │
│ fetchData() runs                               │
│                                                │
│ Query Line 525:                               │
│   SELECT package_id, base_price               │
│   FROM sub_subagent_package_prices           │
│   WHERE subagent_store_id = 'B'  ← PARENT   │
│     AND sub_subagent_store_id = 'C' ← ME    │
└────────────────────────────────────────────────┘
                              ↓
     ┌───────────────────────────────────────────┐
     │ Gets: [                                   │
     │   {package_id: pkg1, base_price: 5.25},│
     │   {package_id: pkg2, base_price: 6.00},│
     │ ]                                        │
     │                                          │
     │ This is the price B charges C!          │
     │ C sees: "Cost from Agent: 5.25"         │
     │ C must charge users >= 5.25             │
     └───────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                          COMPLETE FLOW SUMMARY
═══════════════════════════════════════════════════════════════════════════════

AGENT A
  ├─ Sets: Price = 4.50 for 1GB
  │
SUBAGENT B (receives pricing from Agent A)
  ├─ Sees: Cost from Agent = 4.50
  ├─ Sets: Price = 5.25 for SubSubAgent C
  │
SUBSUBAGENT C (receives pricing from SubAgent B)
  ├─ Sees: Cost from Agent = 5.25 ← THE KEY CHANGE!
  ├─ Must charge users >= 5.25
  └─ Profit = What users pay - 5.25


═══════════════════════════════════════════════════════════════════════════════
                         QUERY COMPARISON TABLE
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ WHO              │ TABLE                      │ WHERE CLAUSE               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Agent wants to   │ subagent_package_prices   │ agent_store_id = A         │
│ know what they   │                           │ subagent_store_id = B      │
│ charge B         │                           │ → base_price = what B pays │
├─────────────────────────────────────────────────────────────────────────────┤
│ B wants to know  │ sub_subagent_package_     │ subagent_store_id = B      │
│ what they charge │ prices                    │ sub_subagent_store_id = C  │
│ C                │                           │ → base_price = what C pays │
├─────────────────────────────────────────────────────────────────────────────┤
│ C wants to know  │ sub_subagent_package_     │ subagent_store_id = B      │
│ what they must   │ prices                    │ sub_subagent_store_id = C  │
│ charge users     │                           │ → base_price = what C pays │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                              KEY INSIGHT
═══════════════════════════════════════════════════════════════════════════════

The SAME TABLE `sub_subagent_package_prices` is used for TWO THINGS:

1. SUBAGENT PERSPECTIVE (Reading):
   WHERE subagent_store_id = B AND sub_subagent_store_id = C
   → "What do I charge C?"
   → base_price is what B charges

2. SUBSUBAGENT PERSPECTIVE (Reading):
   WHERE subagent_store_id = B AND sub_subagent_store_id = C
   → "What does B charge me?"
   → base_price is what C must pay

The field base_price has DUAL MEANING depending on perspective!
- For B: It's their OUT-GOING price (what they charge)
- For C: It's their IN-COMING cost (what they pay)

═══════════════════════════════════════════════════════════════════════════════
