# Complete Database Setup Instructions for Data Plug Store

This document contains all SQL commands needed to set up your database with new features. Follow each section in order.

---

## 📋 Quick Checklist

- [ ] Step 1: Add Video Column to Stores Table
- [ ] Step 2: Update Existing Customer Top-Up References
- [ ] Step 3: Create Trigger for New Customers
- [ ] Step 4: Add USSD and Access Codes
- [ ] Step 5: Create Flyer Generator Tables
- [ ] Take screenshots of verification queries
- [ ] Send screenshots for confirmation

---

## Step 1: Add Video Column to Stores Table

**Purpose:** Store video URLs to display in the store overview section

**SQL Code:**
```sql
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS overview_video_url TEXT DEFAULT NULL;
```

**What happens:** 
- Adds a column to store video URLs for store overviews
- Uses `IF NOT EXISTS` so it won't error if already added

**Next:** Copy the SQL above, paste in Supabase SQL Editor, and run it.

---

## Step 2: Update Existing Customer Top-Up References

**Purpose:** Generate user_<id> format for all existing customers

**SQL Code - Part A: Update References**
```sql
UPDATE public.customers
SET topup_reference = 'user' || id
WHERE topup_reference IS NULL 
   OR topup_reference = '' 
   OR topup_reference LIKE 'TOPUP%';
```

**What happens:**
- Finds all customers without a top-up reference OR with old 'TOPUP%' format
- Generates new references: user1, user2, user3, etc.
- This is ONE-TIME only - run it once

**SQL Code - Part B: Verify the Update**
```sql
SELECT id, phone_number, topup_reference, created_at 
FROM public.customers 
ORDER BY created_at DESC 
LIMIT 10;
```

**What to look for:**
- All customers should have `user<id>` format
- Example: user5, user42, user1001
- If some still have NULL or 'TOPUP%', those rows need manual updating

---

## Step 3: Create Trigger for New Customers

**Purpose:** Automatically generate top-up references for new signups

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION public.generate_customer_topup_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.topup_reference IS NULL OR NEW.topup_reference = '' THEN
    NEW.topup_reference := 'user' || NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF NOT EXISTS generate_topup_ref_trigger ON public.customers;

CREATE TRIGGER generate_topup_ref_trigger
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.generate_customer_topup_reference();
```

**What happens:**
- Creates a function that generates top-up references
- Creates a trigger that runs this function on every new customer signup
- New customers will AUTOMATICALLY get `user<id>` references
- This is permanent - it will always work for future signups

**Verification - Check Trigger Exists:**
```sql
SELECT trigger_name, event_object_table, trigger_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'generate_topup_ref_trigger';
```

---

## Step 4: Add USSD and Access Code Columns

**Purpose:** Store and display USSD codes and access codes in dashboard

**SQL Code - Part A: Add Columns**
```sql
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS ussd_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS access_code_zero TEXT DEFAULT NULL;
```

**What happens:**
- Adds ussd_code column (for *123# or similar)
- Adds access_code_zero column (for access codes)
- These display in the user dashboard

**SQL Code - Part B: Set Default Values**
```sql
UPDATE public.customers
SET ussd_code = '*123#',
    access_code_zero = '0'
WHERE ussd_code IS NULL;
```

**What happens:**
- Sets USSD code to *123#
- Sets access code to 0
- **CHANGE THESE VALUES to your actual codes if different**

**SQL Code - Part C: Verify Columns Exist**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN ('ussd_code', 'access_code_zero')
ORDER BY column_name;
```

---

## Step 5: Create Flyer Generator Tables

**Purpose:** Store customized flyer templates with customer prices

**SQL Code: Create Tables**
```sql
-- Flyer Templates Table
CREATE TABLE IF NOT EXISTS public.flyer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_design JSONB DEFAULT '{}'::jsonb,
  background_color TEXT DEFAULT '#000000',
  text_color TEXT DEFAULT '#FFFFFF',
  accent_color TEXT DEFAULT '#00FFFF',
  logo_url TEXT,
  custom_text TEXT,
  show_prices BOOLEAN DEFAULT TRUE,
  show_ussd BOOLEAN DEFAULT TRUE,
  show_qr_code BOOLEAN DEFAULT FALSE,
  qr_code_url TEXT,
  share_url TEXT DEFAULT 'https://www.dataplug.store/packages',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_default BOOLEAN DEFAULT FALSE
);

-- Customer Prices Table
CREATE TABLE IF NOT EXISTS public.flyer_customer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_template_id UUID NOT NULL REFERENCES public.flyer_templates(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  customer_price DECIMAL(10, 2) NOT NULL,
  margin_percentage DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_flyer_templates_customer_id 
  ON public.flyer_templates(customer_id);

CREATE INDEX IF NOT EXISTS idx_flyer_customer_prices_template_id 
  ON public.flyer_customer_prices(flyer_template_id);

CREATE INDEX IF NOT EXISTS idx_flyer_customer_prices_package_id 
  ON public.flyer_customer_prices(package_id);
```

**What happens:**
- Creates flyer_templates table to store flyer designs
- Creates flyer_customer_prices table for custom pricing
- Creates indexes for fast queries
- Share URL defaults to https://www.dataplug.store/packages

**Verify Tables Created:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('flyer_templates', 'flyer_customer_prices')
AND table_schema = 'public';
```

---

## Final Verification

Run this to see all your updates:

```sql
-- Show all new columns in customers table
SELECT 
  id,
  phone_number,
  topup_reference,
  ussd_code,
  access_code_zero,
  created_at
FROM public.customers
ORDER BY created_at DESC
LIMIT 20;

-- Show flyer tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'flyer%';

-- Show stores table video column
SELECT id, store_name, overview_video_url
FROM public.stores
LIMIT 5;
```

---

## How to Update Values Later

### Update USSD Code for All Customers:
```sql
UPDATE public.customers
SET ussd_code = '*YOUR_NEW_CODE#'
WHERE ussd_code != '*YOUR_NEW_CODE#';
```

### Update Access Code:
```sql
UPDATE public.customers
SET access_code_zero = 'YOUR_NEW_CODE'
WHERE access_code_zero != 'YOUR_NEW_CODE';
```

### Add Video to Specific Store:
```sql
UPDATE public.stores
SET overview_video_url = 'https://www.youtube.com/watch?v=VIDEO_ID'
WHERE id = 'YOUR_STORE_ID';
```

---

## Running the SQL Commands

### Method 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com and login
2. Select your project
3. Click **SQL Editor** on the left sidebar
4. Click **New Query**
5. Copy and paste one command at a time
6. Click **RUN** button
7. Wait for success message (green checkmark)
8. Take a screenshot
9. Copy next command and repeat

### Method 2: pgAdmin (If you have it)

1. Open pgAdmin
2. Connect to your database
3. Go to Tools → Query Tool
4. Paste SQL commands
5. Click Execute
6. Take screenshots

---

## Important Notes

⚠️ **Before You Start:**
- Make sure you're connected to the right database
- Have a backup of your database
- Run Step 1 and Step 2 first before anything else
- Don't modify the Step 3 trigger code

✅ **After Each Step:**
- Take a screenshot showing "success" or the results
- Send screenshot to confirm it worked
- Check that data looks correct
- Move to next step only if verification passed

---

## Troubleshooting

**Error: "Column already exists"**
- This is OK - it means you already ran this command
- The `IF NOT EXISTS` prevents it from erroring

**Error: "Trigger already exists"**
- Run the `DROP TRIGGER` command first
- Then run the `CREATE TRIGGER` command

**Error: "Table does not exist"**
- Check you're using the right database
- Verify the table name is spelled correctly
- Try `SELECT * FROM public.customers LIMIT 1;` to test

**References not updating**
- Run the UPDATE command again
- Check that the WHERE clause matches your data
- Verify customer IDs are present

---

## Success Checklist - After All Steps

- [ ] Video column added to stores table
- [ ] All existing customers have topup_reference starting with 'user'
- [ ] Trigger created for new customer signups
- [ ] USSD code column added (*123# or your code)
- [ ] Access code column added (0 or your code)
- [ ] Flyer template tables created
- [ ] Can see at least 10 customers with all new columns populated
- [ ] Screenshots saved and sent for confirmation

---

## Next Steps After Database Setup

1. User Dashboard will now display:
   - Top-up reference dropdown
   - USSD code with copy button
   - Access code with copy button
   - Buy Data shortcut button

2. Flyer Generator (coming soon):
   - Customers can create custom flyerss
   - Set their own prices on flyers
   - Share with dataplug.store/packages link

3. Video Section:
   - Videos will display in store overviews
   - Add YouTube or video file URLs

---

**Questions? Something not working?**
- Check the verification queries to see current state
- Look at the error message carefully
- Make sure you ran commands in the correct order
- Send screenshot of error for help

