# Paystack Integration - Deployment Checklist

## Pre-Deployment Verification

### Code Changes
- [x] AgentDashboard.tsx updated with Paystack integration
- [x] SubagentDashboard.tsx updated with Paystack integration
- [x] Build successful with no errors
- [x] All TypeScript checks pass

### Files Modified
- [x] `/src/pages/AgentDashboard.tsx` - 5 sections updated
- [x] `/src/pages/SubagentDashboard.tsx` - 5 sections updated

### Edge Function
- [x] URL confirmed: `https://uloaiqmknsrknqikbmtb.supabase.co/functions/v1/create-payout-request`
- [x] Endpoint accepts recipient_code, amount, store_id
- [x] Returns transfer_code on success
- [x] Handles automatic refund on failure

---

## Database Verification

### Transfer Recipients Table
```sql
SELECT COUNT(*) FROM transfer_recipients 
WHERE is_active = true 
AND (agent_store_id IS NOT NULL OR subagent_store_id IS NOT NULL);
```
- [ ] Verify table exists
- [ ] Verify test recipients exist for Agents
- [ ] Verify test recipients exist for Subagents

### Payout Requests Table
```sql
SELECT * FROM payout_requests 
ORDER BY created_at DESC LIMIT 1;
```
- [ ] Verify table exists
- [ ] Verify structure is correct
- [ ] Verify it can handle transfers

---

## Agent Testing Checklist

### Pre-Test Setup
- [ ] Agent store has at least 1 active transfer recipient
- [ ] Agent has sufficient wallet balance (> GH₵ 50 for testing)
- [ ] Agent dashboard accessible

### UI Tests
- [ ] Navigate to "Withdraw" tab
- [ ] See "Request Paystack Transfer" title
- [ ] Recipient dropdown populated with active recipients
- [ ] Can select recipient
- [ ] Transfer button disabled until recipient selected
- [ ] Balance displayed correctly

### Functionality Tests
- [ ] Enter amount < 10 → "Minimum is GH₵ 10.00" error
- [ ] Enter amount > balance → "Insufficient balance" error
- [ ] Enter valid amount with recipient selected → Transfer works
- [ ] After transfer, withdrawal cleared
- [ ] Payout history updated with new transfer

### Error Tests
- [ ] No recipients → Shows "No recipients configured yet"
- [ ] Transfer without selecting recipient → "Select a recipient" error
- [ ] Transfer with no recipients → Shows orange warning

---

## Subagent Testing Checklist

### Pre-Test Setup
- [ ] Subagent store has at least 1 active transfer recipient
- [ ] Subagent has sufficient wallet balance (> GH₵ 50 for testing)
- [ ] Subagent dashboard accessible

### UI Tests
- [ ] Navigate to "Withdraw" tab
- [ ] See "Request Paystack Transfer" title
- [ ] Recipient dropdown populated
- [ ] Can select recipient
- [ ] Transfer button disabled until recipient selected
- [ ] Balance and pending amounts display correctly

### Functionality Tests
- [ ] Enter valid amount with recipient → Transfer initiates
- [ ] Payout history shows new transfer
- [ ] Transfer code visible in history
- [ ] Status shows "pending" or "success"

### Edge Cases
- [ ] With pending withdrawal → Shows warning
- [ ] Try withdrawal with pending → Button disabled
- [ ] Amount validation works same as Agent

---

## Paystack Integration Tests

### Transfer Verification
- [ ] Check `payout_requests` table after transfer
- [ ] Verify recipient_code matches
- [ ] Verify amount correct
- [ ] Verify status updates after processing
- [ ] Verify transfer_code populated

### Status Tracking
- [ ] Transfer marked "pending" initially
- [ ] Transfer updates to "success" when completed
- [ ] Transfer updates to "failed" if issue
- [ ] Error message visible for failed transfers

### Edge Function Response
- [ ] Success: Returns transfer code
- [ ] Failure: Returns error message
- [ ] Balance: Verified before deduction
- [ ] Refund: Automatic if transfer fails

---

## Database Integrity Tests

### Transfer Recipients
```sql
SELECT * FROM transfer_recipients 
WHERE is_active = true 
LIMIT 5;
```
- [ ] Contains required fields
- [ ] Has active recipients for test users
- [ ] recipient_code is valid Paystack ID

### Payout Requests
```sql
SELECT * FROM payout_requests 
ORDER BY created_at DESC LIMIT 5;
```
- [ ] New records created for transfers
- [ ] Status updates correctly
- [ ] Transfer codes populated
- [ ] Balances tracked

---

## Performance Tests

### Load Time
- [ ] Dashboard loads within 2 seconds
- [ ] Recipient dropdown populates quickly
- [ ] Transfer request completes within 5 seconds

### Data Consistency
- [ ] Balance updates immediately after transfer
- [ ] Payout history reflects transfers
- [ ] No duplicate entries

---

## User Communication Tests

### Success Messages
- [ ] "Withdrawal initiated!" toast shows
- [ ] Includes amount and recipient info
- [ ] Form clears after success

### Error Messages
- [ ] Clear error descriptions
- [ ] Actionable guidance
- [ ] Suggests resolution steps

### Status Updates
- [ ] Payout history shows latest first
- [ ] Status badges clear (pending/success/failed)
- [ ] Transfer codes visible for reference

---

## Rollback Plan

If issues occur, rollback steps:

1. **Immediate Rollback**
   ```bash
   git revert <commit-hash>
   pnpm build
   Deploy previous version
   ```

2. **Data Safety**
   - Payout requests already recorded
   - Balances already deducted
   - No data loss expected

3. **Customer Communication**
   - Notify pending transfers
   - Provide Paystack reference codes
   - Manual resolution process

---

## Post-Deployment Monitoring

### Hour 1
- [ ] Monitor error logs for failures
- [ ] Verify transfers completing
- [ ] Check for API errors
- [ ] Test with real transaction

### Day 1
- [ ] Multiple transfers completed successfully
- [ ] No balance discrepancies
- [ ] Payout history accurate
- [ ] User feedback positive

### Week 1
- [ ] All transfers completed
- [ ] Analyze transfer success rate
- [ ] Review error logs
- [ ] Measure user adoption

---

## Support Contacts

- **Edge Function Issues**: Check logs in Supabase
- **Database Issues**: Query `payout_requests` table
- **Paystack Issues**: Check Paystack dashboard
- **User Issues**: Check balance and recipients

---

## Sign-Off

- [ ] Code reviewed
- [ ] Build passed
- [ ] Testing complete
- [ ] Ready for deployment

**Deployed by:** _______________
**Date:** _______________
**Time:** _______________

---

## Success Criteria

✅ All checklist items completed
✅ No errors in testing
✅ Transfers completing successfully
✅ Users can withdraw via Paystack
✅ Payout history accurate
✅ System stable for 24+ hours

---

## Issues Encountered

Document any issues:

```
Issue: [describe]
Solution: [resolution]
Status: [resolved/pending]
```

---

## Notes

Use this space for additional notes:

[Your notes here]
