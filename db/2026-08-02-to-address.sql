-- Add to_address column to raw_mails table for the real recipient parsed from mail headers
-- The address column keeps the SMTP envelope recipient (last hop of the forward chain)
ALTER TABLE raw_mails ADD COLUMN to_address TEXT;

CREATE INDEX IF NOT EXISTS idx_raw_mails_to_address ON raw_mails(to_address);
