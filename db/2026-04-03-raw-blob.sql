-- Add raw_blob BLOB column for gzip-compressed email storage
ALTER TABLE raw_mails ADD COLUMN raw_blob BLOB;
