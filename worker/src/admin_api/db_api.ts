import { Context } from "hono";
import { CONSTANTS } from "../constants";
import utils from "../utils";

const DB_INIT_QUERIES = `
CREATE TABLE IF NOT EXISTS raw_mails (
    id INTEGER PRIMARY KEY,
    message_id TEXT,
    source TEXT,
    address TEXT,
    raw TEXT,
    raw_blob BLOB,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raw_mails_address ON raw_mails(address);

CREATE INDEX IF NOT EXISTS idx_raw_mails_created_at ON raw_mails(created_at);

CREATE INDEX IF NOT EXISTS idx_raw_mails_message_id ON raw_mails(message_id);

CREATE TABLE IF NOT EXISTS address (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    password TEXT,
    source_meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_address_name ON address(name);

CREATE INDEX IF NOT EXISTS idx_address_created_at ON address(created_at);

CREATE INDEX IF NOT EXISTS idx_address_updated_at ON address(updated_at);

CREATE INDEX IF NOT EXISTS idx_address_source_meta ON address(source_meta);

CREATE TABLE IF NOT EXISTS auto_reply_mails (
    id INTEGER PRIMARY KEY,
    source_prefix TEXT,
    name TEXT,
    address TEXT UNIQUE,
    subject TEXT,
    message TEXT,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_mails_address ON auto_reply_mails(address);

CREATE TABLE IF NOT EXISTS address_sender (
    id INTEGER PRIMARY KEY,
    address TEXT UNIQUE,
    balance INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_address_sender_address ON address_sender(address);

CREATE TABLE IF NOT EXISTS sendbox (
    id INTEGER PRIMARY KEY,
    address TEXT,
    raw TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sendbox_address ON sendbox(address);
CREATE INDEX IF NOT EXISTS idx_sendbox_created_at ON sendbox(created_at);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    user_email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    user_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_user_email ON users(user_email);

CREATE TABLE IF NOT EXISTS users_address (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    address_id INTEGER UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_address_user_id ON users_address(user_id);

CREATE INDEX IF NOT EXISTS idx_users_address_address_id ON users_address(address_id);

CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    role_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

CREATE TABLE IF NOT EXISTS user_passkeys (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    passkey_name TEXT NOT NULL,
    passkey_id TEXT NOT NULL,
    passkey TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON user_passkeys(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_passkeys_user_id_passkey_id ON user_passkeys(user_id, passkey_id);
`

const MIGRATE_V008_QUERIES = `
DROP TABLE IF EXISTS address_id_map_v008;
CREATE TABLE address_id_map_v008 (
    old_id INTEGER PRIMARY KEY,
    new_id INTEGER NOT NULL
);

INSERT INTO address_id_map_v008 (old_id, new_id)
SELECT
    a1.id,
    (
        SELECT MIN(a2.id)
        FROM address a2
        WHERE lower(trim(a2.name)) = lower(trim(a1.name))
    ) AS new_id
FROM address a1;

DROP TABLE IF EXISTS address_v008;
CREATE TABLE address_v008 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    password TEXT,
    source_meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO address_v008 (id, name, password, source_meta, created_at, updated_at)
SELECT
    grouped.new_id,
    grouped.normalized_name,
    (
        SELECT a2.password
        FROM address a2
        WHERE lower(trim(a2.name)) = grouped.normalized_name
            AND a2.password IS NOT NULL
            AND a2.password != ''
        ORDER BY a2.id ASC
        LIMIT 1
    ) AS password,
    (
        SELECT a2.source_meta
        FROM address a2
        WHERE lower(trim(a2.name)) = grouped.normalized_name
            AND a2.source_meta IS NOT NULL
            AND a2.source_meta != ''
        ORDER BY a2.id ASC
        LIMIT 1
    ) AS source_meta,
    (
        SELECT MIN(a2.created_at)
        FROM address a2
        WHERE lower(trim(a2.name)) = grouped.normalized_name
    ) AS created_at,
    (
        SELECT MAX(a2.updated_at)
        FROM address a2
        WHERE lower(trim(a2.name)) = grouped.normalized_name
    ) AS updated_at
FROM (
    SELECT
        MIN(id) AS new_id,
        lower(trim(name)) AS normalized_name
    FROM address
    GROUP BY lower(trim(name))
) grouped;

DROP TABLE IF EXISTS users_address_v008;
CREATE TABLE users_address_v008 (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    address_id INTEGER UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_address_v008 (id, user_id, address_id, created_at)
SELECT
    MIN(ua.id) AS id,
    (
        SELECT ua2.user_id
        FROM users_address ua2
        JOIN address_id_map_v008 map2 ON map2.old_id = ua2.address_id
        WHERE map2.new_id = grouped.new_id
        ORDER BY ua2.id ASC
        LIMIT 1
    ) AS user_id,
    grouped.new_id AS address_id,
    MIN(ua.created_at) AS created_at
FROM users_address ua
JOIN address_id_map_v008 grouped ON grouped.old_id = ua.address_id
GROUP BY grouped.new_id;

DROP TABLE IF EXISTS address_sender_v008;
CREATE TABLE address_sender_v008 (
    id INTEGER PRIMARY KEY,
    address TEXT UNIQUE,
    balance INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO address_sender_v008 (id, address, balance, enabled, created_at)
SELECT
    MIN(id) AS id,
    lower(trim(address)) AS address,
    SUM(COALESCE(balance, 0)) AS balance,
    MAX(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
    MIN(created_at) AS created_at
FROM address_sender
GROUP BY lower(trim(address));

DROP TABLE IF EXISTS auto_reply_mails_v008;
CREATE TABLE auto_reply_mails_v008 (
    id INTEGER PRIMARY KEY,
    source_prefix TEXT,
    name TEXT,
    address TEXT UNIQUE,
    subject TEXT,
    message TEXT,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO auto_reply_mails_v008 (id, source_prefix, name, address, subject, message, enabled, created_at)
SELECT
    selected.id,
    selected.source_prefix,
    selected.name,
    lower(trim(selected.address)) AS address,
    selected.subject,
    selected.message,
    selected.enabled,
    selected.created_at
FROM auto_reply_mails selected
WHERE selected.id IN (
    SELECT MAX(id)
    FROM auto_reply_mails
    GROUP BY lower(trim(address))
);

UPDATE raw_mails
SET address = lower(trim(address))
WHERE address IS NOT NULL AND address != lower(trim(address));

UPDATE sendbox
SET address = lower(trim(address))
WHERE address IS NOT NULL AND address != lower(trim(address));

DROP TABLE users_address;
ALTER TABLE users_address_v008 RENAME TO users_address;

DROP TABLE address;
ALTER TABLE address_v008 RENAME TO address;

DROP TABLE address_sender;
ALTER TABLE address_sender_v008 RENAME TO address_sender;

DROP TABLE auto_reply_mails;
ALTER TABLE auto_reply_mails_v008 RENAME TO auto_reply_mails;

DROP TABLE address_id_map_v008;
`;

const migrateAddressStorageToLowercase = async (c: Context<HonoCustomType>): Promise<void> => {
    const query = MIGRATE_V008_QUERIES.replace(/[\r\n]/g, "")
        .split(";")
        .map((query) => query.trim())
        .filter(Boolean)
        .join(";\n");
    await c.env.DB.exec(query);
}

export default {
    initialize: async (c: Context<HonoCustomType>) => {
        // remove all \r and \n characters from the query string
        // split by ; and join with a ;\n
        const query = DB_INIT_QUERIES.replace(/[\r\n]/g, "")
            .split(";")
            .map((query) => query.trim())
            .join(";\n");
        await c.env.DB.exec(query);

        const version = await utils.getSetting(c, CONSTANTS.DB_VERSION_KEY);
        if (version) {
            return c.json({ message: "Database already initialized" });
        }
        await utils.saveSetting(c, CONSTANTS.DB_VERSION_KEY, CONSTANTS.DB_VERSION);
        return c.json({ message: "Database initialized" });
    },
    migrate: async (c: Context<HonoCustomType>) => {
        const version = await utils.getSetting(c, CONSTANTS.DB_VERSION_KEY);
        if (version && version <= "v0.0.2") {
            // migration to v0.0.3: add password column
            const tableInfo = await c.env.DB.prepare(
                `PRAGMA table_info(address)`
            ).all();
            const hasPassword = tableInfo.results?.some(
                (col: any) => col.name === 'password'
            );
            if (!hasPassword) {
                await c.env.DB.exec(`ALTER TABLE address ADD COLUMN password TEXT;`);
            }
        }
        if (version && version <= "v0.0.3") {
            // migration to v0.0.4: add metadata column
            const tableInfo = await c.env.DB.prepare(
                `PRAGMA table_info(raw_mails)`
            ).all();
            const hasMetadata = tableInfo.results?.some(
                (col: any) => col.name === 'metadata'
            );
            if (!hasMetadata) {
                await c.env.DB.exec(`ALTER TABLE raw_mails ADD COLUMN metadata TEXT;`);
            }
        }
        if (version && version <= "v0.0.4") {
            // migration to v0.0.5: add source_meta column
            const tableInfo = await c.env.DB.prepare(
                `PRAGMA table_info(address)`
            ).all();
            const hasSourceMeta = tableInfo.results?.some(
                (col: any) => col.name === 'source_meta'
            );
            if (!hasSourceMeta) {
                await c.env.DB.exec(`ALTER TABLE address ADD COLUMN source_meta TEXT;`);
                await c.env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_address_source_meta ON address(source_meta);`);
            }
        }
        if (version && version <= "v0.0.5") {
            // migration to v0.0.6: add message_id index on raw_mails
            await c.env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_raw_mails_message_id ON raw_mails(message_id);`);
        }
        if (version && version <= "v0.0.6") {
            // migration to v0.0.7: add raw_blob column for gzip compressed email storage
            const tableInfo = await c.env.DB.prepare(
                `PRAGMA table_info(raw_mails)`
            ).all();
            const hasRawBlob = tableInfo.results?.some(
                (col: any) => col.name === 'raw_blob'
            );
            if (!hasRawBlob) {
                await c.env.DB.exec(`ALTER TABLE raw_mails ADD COLUMN raw_blob BLOB;`);
            }
        }
        if (version && version <= "v0.0.7") {
            // migration to v0.0.8: normalize stored mailbox addresses to lowercase
            await migrateAddressStorageToLowercase(c);
        }
        if (version != CONSTANTS.DB_VERSION) {
            // remove all \r and \n characters from the query string
            // split by ; and join with a ;\n
            const query = DB_INIT_QUERIES.replace(/[\r\n]/g, "")
                .split(";")
                .map((query) => query.trim())
                .join(";\n");
            await c.env.DB.exec(query);
            // Update the version in the settings table
            await utils.saveSetting(c, CONSTANTS.DB_VERSION_KEY, CONSTANTS.DB_VERSION);
            return c.json({
                success: true,
                message: "Database migrated"
            });
        }
        return c.json({
            success: true,
            message: "Database does not need migration"
        });
    },
    getVersion: async (c: Context<HonoCustomType>) => {
        const version = await utils.getSetting(c, CONSTANTS.DB_VERSION_KEY);
        return c.json({
            need_initialization: !version,
            need_migration: version && version != CONSTANTS.DB_VERSION,
            current_db_version: version,
            code_db_version: CONSTANTS.DB_VERSION
        });
    },
}
