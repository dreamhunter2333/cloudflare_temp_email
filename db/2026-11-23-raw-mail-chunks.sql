-- Store mail larger than the D1 row limit in chunks
ALTER TABLE raw_mails ADD COLUMN raw_chunk_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_mails_raw_chunk_key ON raw_mails(raw_chunk_key);

CREATE TABLE IF NOT EXISTS raw_mail_chunks (
    chunk_key TEXT NOT NULL,
    seq INTEGER NOT NULL,
    data BLOB NOT NULL,
    PRIMARY KEY (chunk_key, seq),
    FOREIGN KEY (chunk_key) REFERENCES raw_mails(raw_chunk_key) ON DELETE CASCADE
);
