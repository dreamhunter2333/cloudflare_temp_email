CREATE INDEX IF NOT EXISTS idx_raw_mails_mailbox_domain_created_at ON raw_mails(substr(address, instr(address, '@') + 1) COLLATE NOCASE, created_at);
CREATE INDEX IF NOT EXISTS idx_address_mailbox_domain_created_at ON address(substr(name, instr(name, '@') + 1) COLLATE NOCASE, created_at);
CREATE INDEX IF NOT EXISTS idx_sendbox_mailbox_domain_created_at ON sendbox(substr(address, instr(address, '@') + 1) COLLATE NOCASE, created_at);
