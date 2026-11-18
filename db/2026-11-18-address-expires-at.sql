ALTER TABLE address ADD COLUMN expires_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_address_expires_at ON address(expires_at);
