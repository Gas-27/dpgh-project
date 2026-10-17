-- ============================================================================
-- DEFINITIVE FIX: sub_subagent_package_prices unique constraint
-- ============================================================================
-- ROOT CAUSE:
--   The table had UNIQUE(subagent_store_id, package_id) keyed on the PARENT.
--   But TWO different kinds of rows both set subagent_store_id = PARENT:
--     1. The subagent's TEMPLATE price  -> sub_subagent_store_id = NULL
--     2. A sub-subagent's OWN sell price -> sub_subagent_store_id = CHILD id
--   Both share (subagent_store_id, package_id) = (PARENT, P) so they COLLIDE,
--   causing the 409 conflict and wiping the template (falling back to admin price).
--
-- FIX (mirrors the working agent->subagent model, which keys on the CHILD):
--   - One template row per (subagent_store_id, package_id) where child IS NULL
--   - One own-price row per (sub_subagent_store_id, package_id) where child IS NOT NULL
--   These two partial unique indexes can never collide with each other.
-- ============================================================================

-- 1. Drop the old parent-keyed unique constraint (whatever its generated name is)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'sub_subagent_package_prices'
      AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE sub_subagent_package_prices DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Also drop any pre-existing indexes we are about to (re)create
DROP INDEX IF EXISTS uq_subsub_template_package;
DROP INDEX IF EXISTS uq_subsub_child_package;

-- 2. Template prices: exactly one per (subagent_store_id, package_id) when no child
CREATE UNIQUE INDEX uq_subsub_template_package
  ON sub_subagent_package_prices (subagent_store_id, package_id)
  WHERE sub_subagent_store_id IS NULL;

-- 3. Each sub-subagent's own price: one per (sub_subagent_store_id, package_id)
CREATE UNIQUE INDEX uq_subsub_child_package
  ON sub_subagent_package_prices (sub_subagent_store_id, package_id)
  WHERE sub_subagent_store_id IS NOT NULL;

-- 4. Verify the new indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sub_subagent_package_prices'
ORDER BY indexname;
