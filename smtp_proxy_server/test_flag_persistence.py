"""Regression test for GH issue #1074: IMAP STORE could not mark mail as read.

Root cause (see 1074-report.md for the full investigation):
- smtp_proxy_server/imap_server.py SimpleRealm.requestAvatar() builds a brand
  new SimpleMailbox (with an empty in-memory `_flags` dict) on every IMAP
  login/connection.
- smtp_proxy_server/imap_mailbox.py SimpleMailbox.store() only ever wrote
  flag changes into that in-memory dict, and
  SimpleMailbox._fetch_and_cache_messages() unconditionally defaulted every
  message's flags to `{\\Seen}`.
- Net effect: every message always looked "already read", and a client's
  STORE +FLAGS (\\Seen) command appeared to succeed but was silently
  discarded the moment the IMAP session ended (e.g. Thunderbird reconnecting
  to poll), which matches the reported "cannot mark mail as read".

This test drives SimpleMailbox directly (no Docker / no live worker
backend) against a FakeBackendClient, and verifies that:
1. A never-touched message starts unseen (not hardcoded \\Seen).
2. STORE +FLAGS (\\Seen) is visible to a brand new SimpleMailbox instance
   pointed at the same flag_store.FlagStore, simulating a client
   disconnect + reconnect.
"""
import os
import shutil
import tempfile
import unittest

from twisted.internet import defer
from twisted.mail import imap4
from twisted.python.failure import Failure

import imap_mailbox
from flag_store import FlagStore
from imap_mailbox import SimpleMailbox


def _sync_defer_to_thread(f, *args, **kwargs):
    """Stand-in for twisted.internet.threads.deferToThread.

    imap_mailbox.py offloads FlagStore's blocking sqlite calls to a thread
    via deferToThread. Tests don't run a reactor to service that thread
    pool, so this executes the callable inline and wraps the result as an
    already-fired Deferred instead.
    """
    try:
        result = f(*args, **kwargs)
    except Exception:
        return defer.fail()
    return defer.succeed(result)


def _run(d):
    """Extract the result of a Deferred that fires synchronously."""
    box = []
    d.addBoth(box.append)
    assert box, "Deferred did not fire synchronously"
    value = box[0]
    if isinstance(value, Failure):
        value.raiseException()
    return value


class FakeBackendClient:
    """Minimal stand-in for imap_http_client.BackendClient.

    Serves a fixed in-memory list of message rows so tests don't need a
    live worker backend or Docker.
    """

    def __init__(self, messages):
        self._messages = messages

    def get_message_count(self, mailbox_name):
        return defer.succeed(len(self._messages))

    def get_messages(self, mailbox_name, limit, offset):
        page = self._messages[offset:offset + limit]
        count = len(self._messages) if offset == 0 else None
        return defer.succeed((page, count))


class ImapMarkAsSeenPersistenceTest(unittest.TestCase):

    def setUp(self):
        self._tmpdir = tempfile.mkdtemp()
        self._db_path = os.path.join(self._tmpdir, "flags.db")
        self._orig_deferToThread = imap_mailbox.threads.deferToThread
        imap_mailbox.threads.deferToThread = _sync_defer_to_thread

    def tearDown(self):
        imap_mailbox.threads.deferToThread = self._orig_deferToThread
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _make_mailbox(self, messages, address="user@example.com"):
        flag_store = FlagStore(self._db_path)
        client = FakeBackendClient(messages)
        return SimpleMailbox("INBOX", client, address, flag_store=flag_store)

    def test_new_message_starts_unseen(self):
        mbox = self._make_mailbox([{"id": 1, "raw": ""}])
        _run(mbox._build_uid_index())
        self.assertEqual(mbox.getUnseenCount(), 1)

    def test_store_seen_survives_reconnect(self):
        messages = [{"id": 1, "raw": ""}, {"id": 2, "raw": ""}]

        # --- Session 1: client connects, selects INBOX, sees 2 unseen ---
        mbox1 = self._make_mailbox(messages)
        _run(mbox1._build_uid_index())
        self.assertEqual(mbox1.getUnseenCount(), 2)

        # Client sends: UID STORE 1 +FLAGS (\Seen)
        message_set = imap4.MessageSet(1, 1)
        result = _run(mbox1.store(message_set, [r"\Seen"], mode=1, uid=True))
        self.assertIn(1, [seq for seq in result])
        self.assertEqual(mbox1.getUnseenCount(), 1)

        # --- Session 2: client disconnects and reconnects (new SimpleMailbox
        # instance, exactly like SimpleRealm.requestAvatar creates per login) ---
        mbox2 = self._make_mailbox(messages)
        _run(mbox2._build_uid_index())

        self.assertEqual(
            mbox2.getUnseenCount(), 1,
            "flag set via STORE in a previous session was lost on reconnect",
        )
        self.assertIn(r"\Seen", mbox2._flags.get(1, set()))
        self.assertNotIn(r"\Seen", mbox2._flags.get(2, set()))

    def test_store_minus_flags_removes_seen(self):
        messages = [{"id": 1, "raw": ""}]
        mbox = self._make_mailbox(messages)
        _run(mbox._build_uid_index())

        message_set = imap4.MessageSet(1, 1)
        _run(mbox.store(message_set, [r"\Seen"], mode=1, uid=True))
        self.assertEqual(mbox.getUnseenCount(), 0)

        _run(mbox.store(message_set, [r"\Seen"], mode=-1, uid=True))
        self.assertEqual(mbox.getUnseenCount(), 1)


if __name__ == "__main__":
    unittest.main()
