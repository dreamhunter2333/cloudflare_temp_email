-- Add metadata column to raw_mails table for storing AI extraction results and other metadata
-- This column stores JSON data with flexible schema for various analysis results

ALTER TABLE raw_mails ADD COLUMN metadata TEXT;
