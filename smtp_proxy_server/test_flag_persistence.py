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
from imap_server import SimpleIMAPServer


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


class _MailboxTestBase(unittest.TestCase):
    """Shared fixture: a temp-dir FlagStore and an inline deferToThread."""

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


class ImapMarkAsSeenPersistenceTest(_MailboxTestBase):

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

        # The removal must also land in SQLite, not just this instance's
        # in-memory dict: a fresh mailbox (= reconnect) must see it unseen.
        mbox2 = self._make_mailbox(messages)
        _run(mbox2._build_uid_index())
        self.assertEqual(
            mbox2.getUnseenCount(), 1,
            "-FLAGS (\\Seen) was not persisted across reconnect",
        )
        self.assertNotIn(r"\Seen", mbox2._flags.get(1, set()))

    def test_keyword_containing_comma_round_trips(self):
        # Commas are legal in IMAP keywords; "foo,bar" is ONE keyword and
        # must not come back from storage split into "foo" and "bar".
        messages = [{"id": 1, "raw": ""}]
        mbox = self._make_mailbox(messages)
        _run(mbox._build_uid_index())

        message_set = imap4.MessageSet(1, 1)
        _run(mbox.store(message_set, ["foo,bar"], mode=1, uid=True))

        mbox2 = self._make_mailbox(messages)
        _run(mbox2._build_uid_index())
        self.assertEqual(mbox2._flags.get(1), {"foo,bar"})

    def test_concurrent_sessions_do_not_clobber_each_other(self):
        # Two sessions load the same (empty) flags, then each STOREs a
        # different flag on the same message. The second write must not be
        # computed from its stale in-memory copy, or the first flag is lost.
        messages = [{"id": 1, "raw": ""}]
        mbox1 = self._make_mailbox(messages)
        mbox2 = self._make_mailbox(messages)
        _run(mbox1._build_uid_index())
        _run(mbox2._build_uid_index())

        message_set = imap4.MessageSet(1, 1)
        _run(mbox1.store(message_set, [r"\Seen"], mode=1, uid=True))
        _run(mbox2.store(message_set, [r"\Flagged"], mode=1, uid=True))

        mbox3 = self._make_mailbox(messages)
        _run(mbox3._build_uid_index())
        self.assertEqual(
            mbox3._flags.get(1), {r"\Seen", r"\Flagged"},
            "a session's +FLAGS was lost to a concurrent session's stale write",
        )


class ImapSearchFlagTest(_MailboxTestBase):
    """SEARCH must answer flag keys from persisted state.

    SimpleMailbox declares ISearchableMailbox, so IMAP4Server.do_SEARCH hands
    the whole query to it and never runs its own search_UNSEEN/search_SEEN
    helpers. Before this, every SEARCH fell through to "return everything",
    so `SEARCH UNSEEN` listed mail the user had already read.
    """

    def _seen_mailbox(self):
        """Two messages, UID 1 marked \\Seen, UID 2 left unread."""
        messages = [{"id": 1, "raw": ""}, {"id": 2, "raw": ""}]
        mbox = self._make_mailbox(messages)
        _run(mbox._build_uid_index())
        _run(mbox.store(imap4.MessageSet(1, 1), [r"\Seen"], mode=1, uid=True))
        return mbox

    def test_search_unseen_excludes_seen_messages(self):
        mbox = self._seen_mailbox()
        self.assertEqual(_run(mbox.search(["UNSEEN"], uid=True)), [2])

    def test_search_seen_returns_only_seen_messages(self):
        mbox = self._seen_mailbox()
        self.assertEqual(_run(mbox.search(["SEEN"], uid=True)), [1])

    def test_search_unseen_returns_sequence_numbers_when_not_uid(self):
        mbox = self._seen_mailbox()
        self.assertEqual(_run(mbox.search(["UNSEEN"], uid=False)), [2])

    def test_search_all_still_returns_everything(self):
        mbox = self._seen_mailbox()
        self.assertEqual(_run(mbox.search(["ALL"], uid=True)), [1, 2])

    def test_search_accepts_bytes_terms(self):
        mbox = self._seen_mailbox()
        self.assertEqual(_run(mbox.search([b"UNSEEN"], uid=True)), [2])

    def test_unsupported_search_key_still_matches_everything(self):
        # Keys this mailbox cannot evaluate keep the previous lenient
        # behaviour rather than silently returning an empty result.
        mbox = self._seen_mailbox()
        self.assertEqual(_run(mbox.search(["SINCE"], uid=True)), [1, 2])

    def test_combined_keys_are_conjunctive(self):
        mbox = self._seen_mailbox()
        _run(mbox.store(imap4.MessageSet(2, 2), [r"\Flagged"], mode=1, uid=True))
        self.assertEqual(_run(mbox.search(["UNSEEN", "FLAGGED"], uid=True)), [2])
        self.assertEqual(_run(mbox.search(["SEEN", "FLAGGED"], uid=True)), [])


class FetchImpliesSeenTest(unittest.TestCase):
    """Only non-peek body fetches may set \\Seen (RFC 3501 §6.4.5).

    Twisted passes the parsed FETCH query to its own response builder and
    never to the mailbox, so SimpleMailbox alone cannot distinguish BODY[]
    from BODY.PEEK[]. SimpleIMAPServer.do_FETCH makes that call instead.
    """

    def _implies_seen(self, command):
        parser = imap4._FetchParser()
        parser.parseString(command)
        return SimpleIMAPServer._fetch_implies_seen(parser.result)

    def test_body_sets_seen(self):
        self.assertTrue(self._implies_seen(b"BODY[]"))

    def test_body_section_sets_seen(self):
        # BODY[HEADER] is a non-peek fetch and does set \Seen, unlike the
        # RFC822.HEADER shorthand below.
        self.assertTrue(self._implies_seen(b"BODY[HEADER]"))

    def test_body_peek_does_not_set_seen(self):
        self.assertFalse(self._implies_seen(b"BODY.PEEK[]"))

    def test_rfc822_sets_seen(self):
        self.assertTrue(self._implies_seen(b"RFC822"))

    def test_rfc822_text_sets_seen(self):
        self.assertTrue(self._implies_seen(b"RFC822.TEXT"))

    def test_rfc822_header_does_not_set_seen(self):
        # Defined as equivalent to BODY.PEEK[HEADER].
        self.assertFalse(self._implies_seen(b"RFC822.HEADER"))

    def test_metadata_only_fetch_does_not_set_seen(self):
        self.assertFalse(self._implies_seen(b"FLAGS"))
        self.assertFalse(self._implies_seen(b"UID"))
        self.assertFalse(self._implies_seen(b"RFC822.SIZE"))

    def test_mixed_query_sets_seen_if_any_part_does(self):
        self.assertTrue(self._implies_seen(b"(FLAGS BODY[])"))
        self.assertFalse(self._implies_seen(b"(FLAGS BODY.PEEK[])"))


if __name__ == "__main__":
    unittest.main()
