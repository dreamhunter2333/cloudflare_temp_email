CREATE TABLE IF NOT EXISTS telegram_chat_delivery (
    bot_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    blocked INTEGER NOT NULL,
    observed_at INTEGER NOT NULL,
    update_id INTEGER NOT NULL,
    PRIMARY KEY (bot_id, chat_id)
);
