-- Add unique constraint on subagent_stores.store_name to prevent duplicate store names
-- This ensures no two subagent stores can have the same name

ALTER TABLE subagent_stores
ADD CONSTRAINT unique_subagent_store_name UNIQUE(store_name);

-- Create an index for faster lookups when checking store name availability
CREATE INDEX idx_subagent_store_name_lookup ON subagent_stores(LOWER(store_name));
