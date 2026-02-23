-- Add index on message_id column in raw_mails table
-- This index improves performance for queries filtering/updating by message_id
-- Example: UPDATE raw_mails SET metadata = ? WHERE message_id = ?
CREATE INDEX IF NOT EXISTS idx_raw_mails_message_id ON raw_mails(message_id);
