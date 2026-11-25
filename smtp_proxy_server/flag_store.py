import json
import os
import sqlite3
import threading


def _encode_flags(flags: set[str]) -> str:
    # JSON, not a comma-joined string: commas are legal inside IMAP keywords,
    # so "foo,bar" as a single keyword must not be split into two on read.
    return json.dumps(sorted(flags))


def _decode_flags(text: str) -> set[str]:
    if not text:
        return set()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return {str(flag) for flag in parsed}
    except ValueError:
        pass
    # Rows written before the switch to JSON were comma-joined.
    return set(text.split(","))


class FlagStore:
    """Persists IMAP message flags (e.g. \\Seen) to a local SQLite file.

    SimpleMailbox previously kept flags only in an in-memory dict that was
    recreated from scratch for every IMAP connection (see SimpleRealm.requestAvatar
    in imap_server.py), so a client's STORE command (e.g. marking a message as
    read) was silently lost as soon as the session ended. This store gives
    flags a durable home keyed by (address, mailbox, uid) so they survive
    reconnects.
    """

    _UPSERT_SQL = """
        INSERT INTO imap_flags (address, mailbox, uid, flags)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(address, mailbox, uid) DO UPDATE SET flags = excluded.flags
        """

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        # isolation_level=None: transactions are managed explicitly below, so
        # sqlite3 must not inject its own implicit BEGIN.
        return sqlite3.connect(self._db_path, timeout=10, isolation_level=None)

    def _init_db(self):
        dirname = os.path.dirname(self._db_path)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        with self._lock:
            conn = self._connect()
            try:
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
            finally:
                conn.close()

    def get_all(self, address: str, mailbox: str) -> dict[int, set[str]]:
        """Return {uid: flags} for every UID with stored flags in a mailbox."""
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT uid, flags FROM imap_flags WHERE address = ? AND mailbox = ?",
                    (address, mailbox),
                ).fetchall()
            finally:
                conn.close()
        return {uid: _decode_flags(flags) for uid, flags in rows}

    def update_flags(
        self,
        address: str,
        mailbox: str,
        uids: list[int],
        flags: set[str],
        mode: int,
    ) -> dict[int, set[str]]:
        """Atomically apply an IMAP STORE to the given UIDs.

        mode follows twisted's convention: 1 adds (+FLAGS), -1 removes
        (-FLAGS), 0 replaces (FLAGS). Returns {uid: resulting flags}.

        The read-modify-write runs inside one BEGIN IMMEDIATE transaction:
        two concurrent sessions that loaded the same stale in-memory flags
        cannot overwrite each other's STORE, because each session's update is
        recomputed from the row current at its own commit.
        """
        if not uids:
            return {}
        flags = set(flags)
        result: dict[int, set[str]] = {}
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                try:
                    placeholders = ",".join("?" for _ in uids)
                    rows = conn.execute(
                        "SELECT uid, flags FROM imap_flags"
                        " WHERE address = ? AND mailbox = ?"
                        f" AND uid IN ({placeholders})",
                        (address, mailbox, *uids),
                    ).fetchall()
                    current = {uid: _decode_flags(text) for uid, text in rows}
                    upserts = []
                    for uid in uids:
                        old = current.get(uid, set())
                        if mode == 1:
                            new = old | flags
                        elif mode == -1:
                            new = old - flags
                        else:
                            new = set(flags)
                        result[uid] = new
                        upserts.append((address, mailbox, uid, _encode_flags(new)))
                    conn.executemany(self._UPSERT_SQL, upserts)
                    conn.execute("COMMIT")
                except BaseException:
                    conn.execute("ROLLBACK")
                    raise
            finally:
                conn.close()
        return result

    def set_flags_bulk(
        self, address: str, mailbox: str, uid_flags: dict[int, set[str]]
    ) -> None:
        """Upsert flags for multiple UIDs in a single transaction."""
        if not uid_flags:
            return
        rows = [
            (address, mailbox, uid, _encode_flags(flags))
            for uid, flags in uid_flags.items()
        ]
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("BEGIN IMMEDIATE")
                try:
                    conn.executemany(self._UPSERT_SQL, rows)
                    conn.execute("COMMIT")
                except BaseException:
                    conn.execute("ROLLBACK")
                    raise
            finally:
                conn.close()


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
