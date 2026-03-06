import bisect
import logging
import time
from collections import OrderedDict

from twisted.internet import defer
from twisted.mail import imap4
from zope.interface import implementer

from config import settings
from imap_http_client import BackendClient
from imap_message import SimpleMessage
from parse_email import generate_email_model, parse_email

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)

# Use process start time as UIDVALIDITY so clients resync after restart
_UID_VALIDITY = int(time.time())


class MessageCache:
    """LRU cache for parsed email messages, keyed by backend id (=UID)."""

    def __init__(self, max_size: int = 500):
        self._cache: OrderedDict[int, SimpleMessage] = OrderedDict()
        self._max_size = max_size

    def get(self, uid: int):
        if uid in self._cache:
            self._cache.move_to_end(uid)
            return self._cache[uid]
        return None

    def put(self, uid: int, message: SimpleMessage):
        if uid in self._cache:
            self._cache.move_to_end(uid)
            self._cache[uid] = message
        else:
            if len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
            self._cache[uid] = message

    def __contains__(self, uid: int) -> bool:
        return uid in self._cache

    def __len__(self) -> int:
        return len(self._cache)


@implementer(imap4.IMailboxInfo, imap4.IMailbox, imap4.ISearchableMailbox)
class SimpleMailbox:

    def __init__(self, name: str, client: BackendClient):
        self.name = name
        self._client = client
        self.listeners = []
        self.addListener = self.listeners.append
        self.removeListener = self.listeners.remove
        self._message_count = 0
        self._uid_index: list[int] = []
        self._flags: dict[int, set[str]] = {}
        self._cache = MessageCache(max_size=settings.imap_cache_size)
        self._uid_index_built = False

    def getFlags(self):
        return [r"\Seen", r"\Answered", r"\Flagged", r"\Deleted", r"\Draft"]

    def getUIDValidity(self):
        return _UID_VALIDITY

    def getMessageCount(self):
        return self._message_count

    def getRecentCount(self):
        return 0

    def getUnseenCount(self):
        return 0

    def isWriteable(self):
        return 1

    def destroy(self):
        pass

    def getHierarchicalDelimiter(self):
        return "/"

    @defer.inlineCallbacks
    def requestStatus(self, names):
        if not self._uid_index_built:
            yield self._build_uid_index()
        else:
            count = yield self._refresh_count()
            if count != self._message_count:
                self._message_count = count
                yield self._build_uid_index()

        r = {}
        if "MESSAGES" in names:
            r["MESSAGES"] = self._message_count
        if "RECENT" in names:
            r["RECENT"] = self.getRecentCount()
        if "UIDNEXT" in names:
            r["UIDNEXT"] = self.getUIDNext()
        if "UIDVALIDITY" in names:
            r["UIDVALIDITY"] = self.getUIDValidity()
        if "UNSEEN" in names:
            r["UNSEEN"] = self.getUnseenCount()
        return r

    def _refresh_count(self) -> defer.Deferred:
        return self._client.get_message_count(self.name)

    @defer.inlineCallbacks
    def _build_uid_index(self):
        """Build UID index by fetching all message IDs from backend."""
        count = yield self._client.get_message_count(self.name)
        self._message_count = count
        _logger.info("Building UID index for %s: count=%d", self.name, count)

        if count == 0:
            self._uid_index = []
            self._uid_index_built = True
            return

        uid_set = set()
        batch_size = 100
        offset = 0

        while offset < count:
            limit = min(batch_size, count - offset)
            results, _ = yield self._client.get_messages(
                self.name, limit, offset
            )
            for item in results:
                item_id = item.get("id")
                if item_id is not None and item_id not in uid_set:
                    uid_set.add(item_id)
            _logger.info(
                "UID index batch: offset=%d limit=%d got=%d total_uids=%d",
                offset, limit, len(results), len(uid_set),
            )
            offset += limit

        self._uid_index = sorted(uid_set)
        self._uid_index_built = True
        _logger.info(
            "UID index built for %s: %d UIDs, range=%s..%s",
            self.name, len(self._uid_index),
            self._uid_index[0] if self._uid_index else "N/A",
            self._uid_index[-1] if self._uid_index else "N/A",
        )

    def _seq_to_uid(self, seq: int) -> int | None:
        """Convert 1-based sequence number to UID."""
        if 1 <= seq <= len(self._uid_index):
            return self._uid_index[seq - 1]
        return None

    def _uid_to_seq(self, uid: int) -> int | None:
        """Convert UID to 1-based sequence number."""
        idx = bisect.bisect_left(self._uid_index, uid)
        if idx < len(self._uid_index) and self._uid_index[idx] == uid:
            return idx + 1
        return None

    def _resolve_message_set(self, messages, uid: bool) -> list[int]:
        """Resolve an IMAP MessageSet to a list of UIDs."""
        result_uids = []
        if not self._uid_index:
            return result_uids

        max_uid = self._uid_index[-1]
        max_seq = len(self._uid_index)

        _logger.info(
            "Resolving message_set: uid=%s ranges=%s max_uid=%d max_seq=%d",
            uid, list(messages.ranges), max_uid, max_seq,
        )

        for start, end in messages.ranges:
            if uid:
                actual_end = end if end is not None else max_uid
                for u in self._uid_index:
                    if start <= u <= actual_end:
                        result_uids.append(u)
            else:
                actual_end = end if end is not None else max_seq
                actual_start = max(start, 1)
                actual_end = min(actual_end, max_seq)
                for seq in range(actual_start, actual_end + 1):
                    u = self._seq_to_uid(seq)
                    if u is not None:
                        result_uids.append(u)

        return result_uids

    @defer.inlineCallbacks
    def _fetch_and_cache_messages(self, uids: list[int]):
        """Fetch uncached messages from backend in batches."""
        uncached = [u for u in uids if u not in self._cache]
        if not uncached:
            return

        uncached_set = set(uncached)
        id_to_data = {}
        batch_size = 50
        total = self._message_count

        _logger.info(
            "Fetching %d uncached messages (total=%d) for %s",
            len(uncached), total, self.name,
        )

        if total == 0:
            return

        fetched_ids = set()
        offset = 0

        while offset < total and len(fetched_ids) < len(uncached):
            limit = min(batch_size, total - offset)
            results, _ = yield self._client.get_messages(
                self.name, limit, offset
            )
            for item in results:
                item_id = item.get("id")
                if item_id in uncached_set and item_id not in fetched_ids:
                    id_to_data[item_id] = item
                    fetched_ids.add(item_id)

            if len(fetched_ids) >= len(uncached):
                break
            offset += limit

        _logger.info(
            "Fetched %d/%d messages for %s",
            len(id_to_data), len(uncached), self.name,
        )

        for uid_val in uncached:
            if uid_val in id_to_data:
                item = id_to_data[uid_val]
                try:
                    if self.name == "INBOX":
                        raw = item.get("raw", "")
                        email_model = parse_email(raw)
                    elif self.name == "SENT":
                        email_model, raw = generate_email_model(item)
                    else:
                        continue

                    if uid_val not in self._flags:
                        self._flags[uid_val] = {r"\Seen"}
                    flags = self._flags[uid_val]
                    msg = SimpleMessage(
                        uid_val, email_model, flags=flags, raw=raw
                    )
                    self._cache.put(uid_val, msg)
                except Exception as e:
                    _logger.error(f"Failed to parse message uid={uid_val}: {e}")

    @defer.inlineCallbacks
    def fetch(self, messages, uid):
        if not self._uid_index_built:
            yield self._build_uid_index()
        else:
            count = yield self._refresh_count()
            if count != self._message_count:
                self._message_count = count
                yield self._build_uid_index()

        target_uids = self._resolve_message_set(messages, uid)
        _logger.info(
            "FETCH: uid=%s target_uids=%d message_set=%s",
            uid, len(target_uids),
            target_uids[:5] if len(target_uids) > 5 else target_uids,
        )
        if not target_uids:
            return []

        yield self._fetch_and_cache_messages(target_uids)

        result = []
        for u in target_uids:
            cached = self._cache.get(u)
            if cached is not None:
                flags = self._flags.get(u, set())
                cached._flags = flags
                seq = self._uid_to_seq(u)
                if seq is not None:
                    result.append((seq, cached))

        return result

    def getUID(self, message):
        return message

    @defer.inlineCallbacks
    def store(self, messages, flags, mode, uid):
        if not self._uid_index_built:
            yield self._build_uid_index()
        if not self._uid_index:
            return {}

        target_uids = self._resolve_message_set(messages, uid)
        result = {}

        for u in target_uids:
            current_flags = self._flags.get(u, set())

            if mode == 1:    # +FLAGS
                current_flags = current_flags | set(flags)
            elif mode == -1:  # -FLAGS
                current_flags = current_flags - set(flags)
            elif mode == 0:   # FLAGS (replace)
                current_flags = set(flags)

            self._flags[u] = current_flags
            seq = self._uid_to_seq(u)
            if seq is not None:
                result[seq] = current_flags

        return result

    @defer.inlineCallbacks
    def search(self, query, uid):
        if not self._uid_index_built:
            yield self._build_uid_index()

        results = []

        for term in query:
            if isinstance(term, str) and term.upper() == "ALL":
                if uid:
                    results = list(self._uid_index)
                else:
                    results = list(range(1, len(self._uid_index) + 1))
                break

        if not results:
            if uid:
                results = list(self._uid_index)
            else:
                results = list(range(1, len(self._uid_index) + 1))

        return results

    def getUIDNext(self):
        if self._uid_index:
            return self._uid_index[-1] + 1
        return 1

    def expunge(self):
        return defer.succeed([])
