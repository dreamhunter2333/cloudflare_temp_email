CREATE INDEX IF NOT EXISTS idx_raw_mails_cleanup_unknown ON raw_mails(created_at, id, address);

CREATE INDEX IF NOT EXISTS idx_raw_mails_source_domain_created_at ON raw_mails(lower(trim(substr(source, instr(source, '@') + 1), ' <>')), created_at, id);
