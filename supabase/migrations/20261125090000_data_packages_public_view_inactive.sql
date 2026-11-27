-- Storefronts must show packages the admin turned off (as "Currently unavailable"),
-- so public readers need to see inactive rows too. Purchasing is still blocked by the UI and purchase APIs.
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.data_packages;
DROP POLICY IF EXISTS "Anyone can view packages" ON public.data_packages;

CREATE POLICY "Anyone can view packages"
  ON public.data_packages
  FOR SELECT
  TO anon, authenticated
  USING (true);
