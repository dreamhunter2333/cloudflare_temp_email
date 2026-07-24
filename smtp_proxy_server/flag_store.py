import os
import sqlite3
import threading


class FlagStore:
    """Persists IMAP message flags (e.g. \\Seen) to a local SQLite file.

    SimpleMailbox previously kept flags only in an in-memory dict that was
    recreated from scratch for every IMAP connection (see SimpleRealm.requestAvatar
    in imap_server.py), so a client's STORE command (e.g. marking a message as
    read) was silently lost as soon as the session ended. This store gives
    flags a durable home keyed by (address, mailbox, uid) so they survive
    reconnects.
    """

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._db_path, timeout=10)

    def _init_db(self):
        dirname = os.path.dirname(self._db_path)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS imap_flags (
                    address TEXT NOT NULL,
                    mailbox TEXT NOT NULL,
                    uid INTEGER NOT NULL,
                    flags TEXT NOT NULL,
                    PRIMARY KEY (address, mailbox, uid)
                )
                """
            )

    def get_all(self, address: str, mailbox: str) -> dict[int, set[str]]:
        """Return {uid: flags} for every UID with stored flags in a mailbox."""
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT uid, flags FROM imap_flags WHERE address = ? AND mailbox = ?",
                (address, mailbox),
            ).fetchall()
        return {uid: set(flags.split(",")) if flags else set() for uid, flags in rows}

    def set_flags_bulk(
        self, address: str, mailbox: str, uid_flags: dict[int, set[str]]
    ) -> None:
        """Upsert flags for multiple UIDs in a single transaction."""
        if not uid_flags:
            return
        rows = [
            (address, mailbox, uid, ",".join(sorted(flags)))
            for uid, flags in uid_flags.items()
        ]
        with self._lock, self._connect() as conn:
            conn.executemany(
                """
                INSERT INTO imap_flags (address, mailbox, uid, flags)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(address, mailbox, uid) DO UPDATE SET flags = excluded.flags
                """,
                rows,
            )


_default_store: FlagStore | None = None
_default_store_lock = threading.Lock()


def get_flag_store() -> FlagStore:
    """Return the process-wide FlagStore, created lazily from settings."""
    global _default_store
    if _default_store is None:
        with _default_store_lock:
            if _default_store is None:
                from config import settings
                _default_store = FlagStore(settings.imap_flag_db_path)
    return _default_store
