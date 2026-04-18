-- Add source column to address_sender to distinguish the provenance of each row.
-- NULL      = legacy row created before this column existed (eligible for one-shot repair by ensureDefaultSendBalance)
-- 'auto'    = row created/repaired by ensureDefaultSendBalance
-- 'user'    = row created via /api/request_send_mail_access
-- 'admin'   = row last written by the admin UI; never auto-repaired
-- Used to keep legacy data repair separate from admin control state.

ALTER TABLE address_sender ADD COLUMN source TEXT;
