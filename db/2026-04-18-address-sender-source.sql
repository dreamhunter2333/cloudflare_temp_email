-- Add source column to address_sender to track the provenance of each row.
-- NULL    = brand-new column slot (only seen transiently before the backfill)
-- 'legacy'= row already existed before this migration; pre-v0.0.8 schema cannot
--           distinguish legacy request-send remnants from admin-disabled rows,
--           so these are marked off-limits to runtime auto-repair
-- 'auto'  = row created by ensureDefaultSendBalance after this migration
-- 'user'  = row created via /api/request_send_mail_access after this migration
-- 'admin' = row last written by the admin UI; never auto-repaired

ALTER TABLE address_sender ADD COLUMN source TEXT;

-- Backfill every pre-migration row with 'legacy' so ensureDefaultSendBalance
-- (which only acts on rows it just inserted) cannot silently re-enable an
-- admin-disabled row carried over from an older schema.
UPDATE address_sender SET source = 'legacy' WHERE source IS NULL;
