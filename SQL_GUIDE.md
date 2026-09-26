# Database Updates Guide - Data Plug Store

## How to Run the SQL Commands

1. Go to your **Supabase Dashboard**
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the SQL commands below
5. Click **RUN**
6. Take a screenshot of the results

---

## Commands Explanation

### 1. Add Video Column to Stores Table

```sql
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS overview_video_url TEXT DEFAULT NULL;
```

**What it does:**
- Adds a new column `overview_video_url` to the stores table
- This column will store the URL of videos to display in the store overview
- The `IF NOT EXISTS` prevents errors if the column already exists
- Videos can be YouTube links or direct video file URLs

**Example values:**
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `https://example.com/my-video.mp4`

---

### 2. Generate Top-Up References for Existing Customers

```sql
UPDATE public.customers
SET topup_reference = 'user' || id
WHERE topup_reference IS NULL 
   OR topup_reference = '' 
   OR topup_reference LIKE 'TOPUP%';
```

**What it does:**
- Updates all customers who don't have a top-up reference yet
- Generates references in format: `user1`, `user2`, `user3`, etc.
- Replaces old `TOPUP%` format references with new `user%` format
- Concatenates the word "user" with the customer's ID

**Example output:**
- Customer ID 5 → `user5`
- Customer ID 42 → `user42`
- Customer ID 1001 → `user1001`

---

### 3. Verify the Update

```sql
SELECT id, phone_number, topup_reference, created_at 
FROM public.customers 
ORDER BY created_at DESC 
LIMIT 10;
```

**What it does:**
- Shows you the last 10 customers and their new top-up references
- Useful to verify the update worked correctly

---

### 4. Create Trigger for New Signups

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

**What it does:**
- Creates a trigger function that runs automatically when new customers sign up
- Automatically generates the top-up reference in `user<id>` format
- **This ensures all NEW customers get the correct format automatically**
- No manual intervention needed for future signups

---

### 5. Add USSD and Access Code Columns

```sql
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS ussd_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS access_code_zero TEXT DEFAULT NULL;
```

**What it does:**
- Adds two new columns to store USSD codes and access codes
- These will be displayed in the customer dashboard
- Can be customized per customer if needed

**Example values:**
- `ussd_code`: `*123#` or `*929*500#`
- `access_code_zero`: `0` or `*100#`

---

### 6. Update USSD and Access Codes

```sql
UPDATE public.customers
SET ussd_code = '*123#',
    access_code_zero = '0'
WHERE ussd_code IS NULL;
```

**What it does:**
- Sets default USSD and access codes for all customers
- **Change `*123#` and `0` to your actual codes**
- Only updates customers who don't have these values yet

---

## Step-by-Step Instructions

### For Existing Customers (Do This First)

1. Open Supabase SQL Editor
2. Run this command:
   ```sql
   UPDATE public.customers
   SET topup_reference = 'user' || id
   WHERE topup_reference IS NULL 
      OR topup_reference = '' 
      OR topup_reference LIKE 'TOPUP%';
   ```
3. Then run this to verify:
   ```sql
   SELECT id, phone_number, topup_reference FROM public.customers LIMIT 10;
   ```
4. **Take a screenshot and send to confirm**

### For New Customers (Automatic)

1. Run the trigger creation commands once
2. All new signups will automatically get `user<id>` format references
3. No further action needed

### Add Video to Overview

1. Update the stores table:
   ```sql
   ALTER TABLE public.stores
   ADD COLUMN IF NOT EXISTS overview_video_url TEXT DEFAULT NULL;
   ```
2. Add your video URL:
   ```sql
   UPDATE public.stores
   SET overview_video_url = 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID'
   WHERE id = 'YOUR_STORE_ID';
   ```

### Add USSD and Access Codes

1. Add the columns:
   ```sql
   ALTER TABLE public.customers
   ADD COLUMN IF NOT EXISTS ussd_code TEXT DEFAULT NULL,
   ADD COLUMN IF NOT EXISTS access_code_zero TEXT DEFAULT NULL;
   ```
2. Update with your actual codes:
   ```sql
   UPDATE public.customers
   SET ussd_code = '*YOUR_USSD_CODE#',
       access_code_zero = 'YOUR_ACCESS_CODE'
   WHERE ussd_code IS NULL;
   ```

---

## Verification Commands

After running all updates, run these to verify everything worked:

```sql
-- Check all new columns exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN ('topup_reference', 'ussd_code', 'access_code_zero')
ORDER BY column_name;

-- Check customer data
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

-- Check stores table
SELECT 
  id,
  store_name,
  overview_video_url
FROM public.stores
LIMIT 5;
```

---

## Important Notes

⚠️ **Before Running:**
- Backup your database first
- Test on a small dataset first if possible
- Take screenshots of before/after states

✅ **After Running:**
- Verify data looks correct
- Test new customer signup to ensure trigger works
- Test displaying video in overview section
- Send screenshots for confirmation

---

## Troubleshooting

**Error: Column already exists**
- This is fine - the `IF NOT EXISTS` clause handles it
- The column won't be recreated

**Error: Trigger already exists**
- Run the `DROP TRIGGER` command first
- Then create the trigger again

**Top-up references not updating**
- Make sure you ran the UPDATE command
- Check that the WHERE condition matches your data
- Look for existing top-up_reference format (might be different)

**New customers not getting references**
- Make sure the trigger was created successfully
- Check trigger is enabled in Supabase
- Test by creating a new customer and checking their topup_reference

