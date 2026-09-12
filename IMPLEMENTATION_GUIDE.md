# Implementation Guide: Customers Management System

## Overview
This guide covers the implementation of a comprehensive customers management system with top-up references, admin access, and API tracking.

---

## 1. Database Setup

### Step 1: Update Customers Table
Run the SQL code in `/vercel/share/v0-project/UPDATED_CUSTOMERS_TABLE.sql` in your Supabase SQL Editor.

**Key changes:**
- Added `topup_reference` column (format: 1us, 2us, 3us, etc.)
- Added index on `topup_reference` for faster queries
- Updated RLS policies to allow admin access
- Added `generate_customer_topup_reference()` function to auto-generate references

**SQL File Location:** `/vercel/share/v0-project/UPDATED_CUSTOMERS_TABLE.sql`

### Step 2: Update API Users Table
Run the SQL code in `/vercel/share/v0-project/UPDATE_API_USERS_TABLE.sql` in your Supabase SQL Editor.

**New columns added to api_users table:**
- `email` - Email address of API key holder
- `topup_reference` - Top-up reference for wallet management
- `username` - Username for identification

**SQL File Location:** `/vercel/share/v0-project/UPDATE_API_USERS_TABLE.sql`

---

## 2. Customer Registration Flow

When a user signs up as a customer:

1. A new record is created in the `customers` table
2. The `topup_reference` is automatically generated (format: `[count]us`)
3. Customer data includes: email, name, phone, address, profile picture
4. Status defaults to 'active'

**Customer Top-up Reference Format:**
- First customer: `1us`
- Second customer: `2us`
- Third customer: `3us`
- And so on...

---

## 3. Admin Dashboard Features

### Users Tab (Updated)
- **Removed:** User wallet top-up section
- **Kept:** User directory with search and user management
- **Note:** Users tab is for regular platform users, not customers

### Customers Tab (New)
- View all customers in the system
- Search by name or email
- Display customer information:
  - Name and status
  - Email and phone
  - Total orders and total spent
  - Member since date
  - Last purchase date
- Automatically fetches all customers when tab is active

### Customer Data Fetching
- Uses `useEffect` hook to fetch data when tab becomes active
- Fetches all customers from the `customers` table
- Displays helpful message if no customers exist

---

## 4. Features Implemented

### ✅ Completed Features

1. **Customer Top-up Reference System**
   - Auto-generated references in format `Nus` (where N is a number)
   - Unique per customer
   - Displayed in customer table

2. **Admin Dashboard Enhancements**
   - Customers tab displays all registered customers
   - User top-up section removed from users tab
   - Search functionality for customers
   - Data lazy-loads when tab is active

3. **API Users Tracking**
   - Email column stores API key holder's email
   - Top-up reference column for wallet tracking
   - Username column for identification
   - Added indexes for faster queries

4. **Sub-Subagents Tab Fix**
   - Fixed data fetching using `useEffect`
   - Now properly loads data when tab is active
   - Displays all sub-subagents with search functionality

5. **Customer Isolation**
   - Customers table only shows people who signed up as customers
   - Separate from regular users
   - Admin can view all customer records
   - Customers can only view their own profile

---

## 5. Admin Access Control

### Admin Dashboard Visibility
- Admins have access to:
  - Customers tab (view all customers)
  - Users tab (view all users)
  - Customer top-up management (in customers tab)
  - Customer wallet management

### Admin Login
- Use your admin credentials to access admin dashboard
- Admin permissions are stored in `admin_permissions` table
- Role-based access control is enforced

### Customer Dashboard Access
- Admins can view customer dashboards through admin interface
- Admins can search customers by top-up reference
- Admins can manage customer wallets

---

## 6. Database Relationships

```
auth.users (Supabase auth table)
├── customers (new table)
│   ├── user_id (foreign key to auth.users)
│   ├── topup_reference (unique identifier)
│   ├── email
│   ├── phone_number
│   ├── total_purchases
│   ├── total_orders
│   └── status
│
└── api_users (existing table - updated)
    ├── email (new column)
    ├── topup_reference (new column)
    └── username (new column)
```

---

## 7. SQL Queries for Reference

### Find Customer by Top-up Reference
```sql
SELECT * FROM customers 
WHERE topup_reference = '1us';
```

### Get Next Top-up Reference
```sql
SELECT (COUNT(*) + 1)::VARCHAR || 'us' as next_reference 
FROM customers;
```

### View All Customers with Purchase Stats
```sql
SELECT 
  id,
  topup_reference,
  first_name,
  last_name,
  email,
  total_purchases,
  total_orders,
  status,
  customer_since
FROM customers
ORDER BY customer_since DESC;
```

### Check API Users with Email and Reference
```sql
SELECT 
  id,
  email,
  topup_reference,
  username
FROM api_users
WHERE email IS NOT NULL
ORDER BY created_at DESC;
```

---

## 8. Troubleshooting

### Issue: Customers Tab Shows Empty
**Solution:**
1. Verify the `customers` table exists in Supabase
2. Ensure RLS policies are correctly configured
3. Check browser console for error messages
4. Ensure you're logged in as admin

### Issue: Top-up Reference Not Generating
**Solution:**
1. Run the updated customers table SQL migration
2. Ensure `generate_customer_topup_reference()` function exists
3. Check that new customers are being added with the reference

### Issue: Sub-Subagents Not Fetching
**Solution:**
1. Check `sub_subagent_stores` table exists
2. Verify the table has data
3. Check admin permissions for the logged-in user
4. Look at browser console for error messages

### Issue: Admin Can't View Customers
**Solution:**
1. Ensure user has admin role
2. Verify admin permissions are set in `admin_permissions` table
3. Check RLS policies allow admin access
4. Refresh browser and try again

---

## 9. Next Steps

1. **Run SQL migrations** in order:
   - First: `UPDATED_CUSTOMERS_TABLE.sql`
   - Second: `UPDATE_API_USERS_TABLE.sql`

2. **Test the system:**
   - Sign up as a customer
   - Verify top-up reference is assigned
   - Access admin dashboard
   - View customers in Customers tab
   - Test search functionality

3. **Monitor:**
   - Check error logs if issues arise
   - Verify data is being tracked correctly
   - Test admin access permissions

---

## 10. File Locations

- Customer Table SQL: `/vercel/share/v0-project/UPDATED_CUSTOMERS_TABLE.sql`
- API Users SQL: `/vercel/share/v0-project/UPDATE_API_USERS_TABLE.sql`
- Original SQL: `/vercel/share/v0-project/CREATE_CUSTOMERS_TABLE.sql`
- Admin Dashboard: `/vercel/share/v0-project/src/pages/AdminDashboard.tsx`
- User Dashboard: `/vercel/share/v0-project/src/pages/UserDashboard.tsx`
