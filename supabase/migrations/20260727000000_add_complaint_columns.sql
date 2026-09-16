-- Add new columns to complaints table for enhanced report flow
-- screenshot_url: URL of the uploaded data balance screenshot
-- owing_airtime: whether customer reported owing airtime on the SIM
-- owing_bundle: whether customer reported owing a bundle on the SIM
-- owing_momo: whether customer reported owing MoMo on the number

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS owing_airtime BOOLEAN,
  ADD COLUMN IF NOT EXISTS owing_bundle BOOLEAN,
  ADD COLUMN IF NOT EXISTS owing_momo BOOLEAN;
