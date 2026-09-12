-- ============================================================================
-- SQL for Flyer Generator Feature
-- Creates tables for storing user-customized flyer templates
-- ============================================================================

-- 1. CREATE FLYER TEMPLATES TABLE
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

-- Add comment
COMMENT ON TABLE public.flyer_templates IS 'Stores customized flyer templates for each customer with their prices';
COMMENT ON COLUMN public.flyer_templates.template_design IS 'JSON object containing template layout and design settings';
COMMENT ON COLUMN public.flyer_templates.share_url IS 'URL to share with flyer image - defaults to dataplug.store/packages';

-- 2. CREATE FLYER PRICE OVERRIDES TABLE
-- This stores custom prices per customer for each package on their flyer
CREATE TABLE IF NOT EXISTS public.flyer_customer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_template_id UUID NOT NULL REFERENCES public.flyer_templates(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  customer_price DECIMAL(10, 2) NOT NULL,
  margin_percentage DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.flyer_customer_prices IS 'Custom prices for packages on customer flyers - shows their markup';

-- 3. CREATE INDEX FOR FASTER QUERIES
CREATE INDEX IF NOT EXISTS idx_flyer_templates_customer_id 
  ON public.flyer_templates(customer_id);

CREATE INDEX IF NOT EXISTS idx_flyer_customer_prices_template_id 
  ON public.flyer_customer_prices(flyer_template_id);

CREATE INDEX IF NOT EXISTS idx_flyer_customer_prices_package_id 
  ON public.flyer_customer_prices(package_id);

-- ============================================================================

-- 4. SAMPLE DATA - Add a default flyer template for a customer
-- Replace 'customer-id-here' with actual customer UUID
-- 
-- INSERT INTO public.flyer_templates (
--   customer_id,
--   template_name,
--   background_color,
--   text_color,
--   accent_color,
--   custom_text,
--   is_default
-- ) VALUES (
--   'customer-id-here',
--   'Default Blue Template',
--   '#001f3f',
--   '#FFFFFF',
--   '#00FFFF',
--   'Get Fast Data with DataPlug Store',
--   TRUE
-- );

-- ============================================================================

-- 5. VERIFY TABLES CREATED
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('flyer_templates', 'flyer_customer_prices')
ORDER BY table_name, ordinal_position;

-- ============================================================================

-- 6. VIEW ALL CUSTOMER FLYER TEMPLATES
-- This query shows all flyers for a specific customer with their package prices
-- 
-- SELECT 
--   ft.id as flyer_id,
--   ft.template_name,
--   ft.background_color,
--   ft.text_color,
--   ft.accent_color,
--   ft.share_url,
--   COUNT(fcp.id) as total_packages,
--   AVG(fcp.margin_percentage) as avg_margin,
--   ft.created_at
-- FROM public.flyer_templates ft
-- LEFT JOIN public.flyer_customer_prices fcp ON ft.id = fcp.flyer_template_id
-- WHERE ft.customer_id = 'customer-id-here'
-- GROUP BY ft.id
-- ORDER BY ft.created_at DESC;

-- ============================================================================

-- 7. UPDATE FLYER TEMPLATE
-- Update flyer design and colors
-- 
-- UPDATE public.flyer_templates
-- SET 
--   background_color = '#1a1a2e',
--   accent_color = '#00ff00',
--   custom_text = 'Your Custom Message Here',
--   updated_at = now()
-- WHERE id = 'flyer-id-here';

-- ============================================================================

-- 8. SET CUSTOMER PRICES FOR FLYER PACKAGES
-- This sets the price a customer wants to show on their flyer
-- The margin_percentage is calculated as: ((customer_price - base_price) / base_price) * 100
-- 
-- INSERT INTO public.flyer_customer_prices (
--   flyer_template_id,
--   package_id,
--   customer_price,
--   margin_percentage
-- ) 
-- SELECT 
--   'flyer-id-here' as flyer_template_id,
--   dp.id as package_id,
--   (dp.price * 1.5) as customer_price,  -- 50% markup
--   50 as margin_percentage
-- FROM public.data_packages dp
-- WHERE dp.active = TRUE
-- ON CONFLICT DO UPDATE SET 
--   customer_price = EXCLUDED.customer_price,
--   updated_at = now();

-- ============================================================================

-- 9. GET FLYER WITH ALL PACKAGE PRICES
-- Shows a flyer template with all package prices for display
-- 
-- SELECT 
--   ft.id,
--   ft.template_name,
--   ft.background_color,
--   ft.text_color,
--   ft.accent_color,
--   ft.custom_text,
--   ft.share_url,
--   ft.is_default,
--   dp.id as package_id,
--   dp.network,
--   dp.size_gb,
--   dp.price as base_price,
--   COALESCE(fcp.customer_price, dp.price) as display_price,
--   COALESCE(fcp.margin_percentage, 0) as margin
-- FROM public.flyer_templates ft
-- LEFT JOIN public.flyer_customer_prices fcp ON ft.id = fcp.flyer_template_id
-- LEFT JOIN public.data_packages dp ON fcp.package_id = dp.id
-- WHERE ft.id = 'flyer-id-here'
-- ORDER BY dp.network, dp.size_gb;

-- ============================================================================

-- NOTES:
-- 1. Each customer can have multiple flyer templates
-- 2. Each flyer can customize prices per package
-- 3. The share_url is 'https://www.dataplug.store/packages' by default
-- 4. Customers can customize background, text, and accent colors
-- 5. The margin_percentage helps track customer markup/profit
-- 6. Share URL can include referral tracking like: https://www.dataplug.store/packages?ref=user123

-- ============================================================================
