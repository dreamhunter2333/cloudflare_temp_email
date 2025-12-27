-- Add source_meta column to address table for tracking address creation source
-- For web: stores IP address (e.g., "192.168.1.1") or "web:unknown" as fallback
-- For telegram: stores "tg:{userId}" (e.g., "tg:123456789")
-- For admin: stores "admin"

ALTER TABLE address ADD COLUMN source_meta TEXT;

CREATE INDEX IF NOT EXISTS idx_address_source_meta ON address(source_meta);
