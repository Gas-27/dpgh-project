# Sub-Subagent Complete Flow - Test Steps

## STEP-BY-STEP TESTING GUIDE

### TEST 1: COMPLETE REGISTRATION FLOW
**Objective**: Sign up as a new sub-subagent and verify dashboard loads

1. **Go to SubAgent Storefront**
   - Navigate to `https://agentsstore.shop/` (or your SubAgent storefront URL)
   - Look for "Become a Sub-Subagent" button

2. **Open Sub-Subagent Registration Modal**
   - Click the registration button
   - SubSubagentRegistrationForm modal should open
   - Should show form with fields for:
     - Email
     - Password
     - Store Name
     - Support Number
     - WhatsApp Number
     - MoMo Account Name
     - MoMo Number
     - MoMo Network

3. **Fill Registration Form**
   - Email: `test-subsubagent@test.com` (unique per test)
   - Password: `SecurePassword123!`
   - Store Name: `Test SubSubagent Store`
   - Support Number: `+1234567890`
   - WhatsApp Number: `+1234567890`
   - MoMo Name: `John Doe`
   - MoMo Number: `0712345678`
   - MoMo Network: `mtn`

4. **Submit Form**
   - Click "Register" button
   - Should see success toast: "Your sub-subagent account has been created..."
   - Browser should redirect to `/sub-subagent-dashboard?store_id=xxxxx`
   - Page should reload fully

5. **Verify Dashboard Loads**
   - Should see store name in header
   - Should see store information cards:
     - Store ID
     - Parent Agent Store ID
     - Created date
   - Should see contact information:
     - WhatsApp Number
     - Support Number
   - Should see payment methods:
     - MoMo Account Name
     - MoMo Number
     - MoMo Network
     - Wallet Balance
   - Should see recent orders section (empty initially)

**Expected Result**: ✅ Dashboard displays all store info without errors

---

### TEST 2: LOGOUT AND LOGIN FLOW
**Objective**: Verify registered user can login successfully

1. **Logout**
   - Click logout button (should be in navbar)
   - Should be redirected to home page

2. **Go to Sub-Subagent Login Page**
   - Navigate to `https://agentsstore.shop/sub-subagent-login`
   - Should see login form with email/password fields

3. **Enter Credentials**
   - Email: `test-subsubagent@test.com` (from registration)
   - Password: `SecurePassword123!`

4. **Click Login**
   - Should see "Welcome back!" toast
   - Should redirect to `/sub-subagent-dashboard` (no store_id in URL)
   - Page should reload fully

5. **Verify Dashboard Loads**
   - Dashboard should load automatically using user_id
   - All store information should display correctly
   - Should see same data as after registration

**Expected Result**: ✅ Login successful, dashboard loads with user's store data

---

### TEST 3: DATA PERSISTENCE
**Objective**: Verify data persists across page reloads

1. **Refresh Dashboard**
   - While on dashboard, press F5 to refresh
   - Page should reload
   - Store data should still be visible
   - No errors in console

2. **Navigate Away and Back**
   - Click logout
   - Go to home page
   - Come back to `/sub-subagent-login`
   - Login again
   - Dashboard should show same data

**Expected Result**: ✅ All data persists correctly

---

### TEST 4: ERROR HANDLING
**Objective**: Verify error messages display correctly

1. **Try Invalid Login**
   - Go to `/sub-subagent-login`
   - Enter wrong password
   - Should see error toast: "Login failed"

2. **Try Non-SubSubagent User**
   - Try to login with an agent/subagent email
   - Should see: "This login page is only for sub-subagents"

3. **Unauthenticated Dashboard Access**
   - Logout
   - Try to access `/sub-subagent-dashboard` directly
   - Should redirect to login page

**Expected Result**: ✅ All errors handled gracefully with clear messages

---

### TEST 5: ADMIN IMPERSONATION (Optional)
**Objective**: Verify admin can view sub-subagent dashboard with store_id param

1. **Admin Login**
   - Login as admin account

2. **Access SubSubagent Dashboard with store_id**
   - Navigate to `/sub-subagent-dashboard?store_id=actual-store-id`
   - (Replace actual-store-id with real store ID)
   - Should load that specific store's dashboard

**Expected Result**: ✅ Admin can view any sub-subagent's store

---

## DEBUGGING CHECKLIST

If tests fail, check:

- [ ] Supabase connection is active
- [ ] RLS policies are enabled on sub_subagent_stores table
- [ ] user_roles table has the registration's "sub_subagent" role entry
- [ ] sub_subagent_stores table has the new store with correct user_id
- [ ] Browser console shows no errors
- [ ] Network tab shows successful API calls
- [ ] Session is properly established after redirects

## COMMON ISSUES & FIXES

### Issue: "The result contains 0 rows"
- **Cause**: Store not found with user_id
- **Fix**: Verify user_id matches in both auth.users and sub_subagent_stores

### Issue: "This login page is only for sub-subagents"
- **Cause**: User doesn't have "sub_subagent" role
- **Fix**: Check user_roles table entry exists

### Issue: Dashboard doesn't load after registration
- **Cause**: store_id parameter mismatch
- **Fix**: Verify URL has `store_id` (not `storeId`)

### Issue: "Please log in to access your dashboard"
- **Cause**: Session not established
- **Fix**: Wait for page reload to complete, check auth context

---

## SUCCESS CRITERIA

✅ Complete flow works end-to-end
✅ No database errors
✅ No authentication issues
✅ Dashboard displays all store information
✅ Multiple registrations work correctly
✅ Sessions persist properly
✅ Error messages are clear and helpful
