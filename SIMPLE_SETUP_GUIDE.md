# Withdrawal System - Simple Setup Guide

## THE PROBLEM WAS:
1. **Payout history not showing for subagents** - Query was filtering wrong
2. **Edge Function had syntax error** - Extra closing brace

## THE FIX:
Both issues have been fixed in the code. Now you just need to **deploy**.

---

## STEP 1: Deploy the Code
Click "Publish" in the top right of v0 to deploy these changes to production.

---

## STEP 2: Test a Withdrawal (DO THIS!)

### For Subagent:
1. Login as a subagent
2. Go to SubagentDashboard
3. In the withdrawal section:
   - Add a test recipient (e.g., mobile money account)
   - Enter a small amount (5 GHS) to test
   - Click "Transfer"
4. Check:
   - ✅ Wallet balance decreased by 5 GHS
   - ✅ Transfer should succeed to recipient
   - ✅ "Payout History" section now shows this transaction
   - ✅ 24-hour cooldown timer appears (button says "Cooldown: 23h 59m...")

### For Agent:
1. Login as an agent
2. Go to AgentDashboard  
3. Same steps as subagent
4. Check the same things

---

## STEP 3: Check Paystack Balance

After successful withdrawals:
1. Go to Paystack dashboard (https://dashboard.paystack.com/)
2. Check "Balance" - should show money deducted
3. Check "Transfers" - should show your transfer records

---

## STEP 4: If Something Goes Wrong

### Payout History Still Not Showing?
- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Wait 5 seconds for data to load
- Check browser console for errors

### Wallet Not Deducting?
- Check Supabase logs:
  1. Go to Supabase dashboard
  2. Look for "create-payout-request" Edge Function
  3. Check the "Logs" tab for error messages

### Money Sent But Wallet Not Updated?
This means the database tables might not exist. Contact support with:
- The Paystack transaction ID (from Paystack dashboard)
- Amount withdrawn
- Recipient name
- Time of withdrawal

---

## WHAT SHOULD HAPPEN NOW:

✅ **Subagent makes withdrawal:**
- Wallet balance decreases immediately
- Transaction appears in "Payout History" section
- Money goes to recipient via Paystack
- 24-hour cooldown timer starts

✅ **Agent makes withdrawal:**
- Same as subagent
- Can withdraw from either "wallet_balance" or "subagent_commission_balance"

✅ **Payout History Shows:**
- All past withdrawals
- Amount, recipient, status, date
- Works for both agents and subagents

---

## IF YOU NEED TO MANUALLY CORRECT FUNDS:

If a subagent withdrew money and wallet wasn't deducted before this fix:

1. Go to Supabase dashboard
2. Go to "subagent_stores" table
3. Find the subagent
4. Update "wallet_balance": Add back the amount they withdrew
5. Example: If they withdrew 500, add 500 back to wallet_balance

---

## SUMMARY:

- ✅ Code is fixed and committed
- ⏳ Deploy with "Publish" button
- 🧪 Test with small amount (5 GHS)
- 📊 Check Paystack dashboard
- 💰 Correct any historical balances if needed

That's it! The system should now work perfectly.
