from io import BytesIO
from datetime import datetime, timezone

from twisted.mail import imap4
from zope.interface import implementer

from models import EmailModel

# Locale-independent English names for IMAP date formatting
_MONTHS = ('', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
_DAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')

_CREATED_AT_FMTS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%d %H:%M:%S.%f",
)


def parse_created_at(created_at: str) -> datetime | None:
    """Parse created_at string into datetime, returns None on failure."""
    for fmt in _CREATED_AT_FMTS:
        try:
            return datetime.strptime(created_at, fmt)
        except ValueError:
            continue
    return None


def format_imap_date(dt: datetime) -> str:
    """Format datetime as IMAP INTERNALDATE: '21-Mar-2026 13:04:59 +0000'."""
    return (f"{dt.day:02d}-{_MONTHS[dt.month]}-{dt.year} "
            f"{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} +0000")


def format_rfc2822_date(dt: datetime) -> str:
    """Format datetime as RFC 2822: 'Thu, 13 Mar 2026 11:15:57 +0000'."""
    return (f"{_DAYS[dt.weekday()]}, {dt.day:02d} {_MONTHS[dt.month]} {dt.year} "
            f"{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d} +0000")


@implementer(imap4.IMessage, imap4.IMessageFile)
class SimpleMessage:

    def __init__(self, uid: int, email_model: EmailModel,
                 flags: set[str] = None, raw: str = None, created_at: str = None):
        self.uid = uid
        self.email = email_model
        self.subparts = self.email.subparts
        self._flags = flags if flags is not None else set()
        self._raw = raw
        self._created_at = created_at
        self._fill_date_header()

    def _fill_date_header(self):
        """Fill empty/missing Date header from created_at."""
        date_val = self.email.headers.get("Date", "").strip()
        if date_val or not self._created_at:
            return
        dt = parse_created_at(self._created_at)
        if dt:
            self.email.headers["Date"] = format_rfc2822_date(dt)

    def getUID(self):
        return self.uid

    def getHeaders(self, negate, *names):
        names_lower = set()
        for n in names:
            if isinstance(n, bytes):
                names_lower.add(n.decode("ascii", errors="replace").lower())
            else:
                names_lower.add(n.lower())
        if not names_lower:
            return {k.lower(): v for k, v in self.email.headers.items()}
        if negate:
            return {
                k.lower(): v
                for k, v in self.email.headers.items()
                if k.lower() not in names_lower
            }
        return {
            k.lower(): v
            for k, v in self.email.headers.items()
            if k.lower() in names_lower
        }

    def isMultipart(self):
        return len(self.subparts) > 0

    def getSubPart(self, part):
        if not self.subparts:
            if part == 0:
                return SimpleMessage(self.uid, self.email, flags=self._flags)
            raise IndexError(part)
        return SimpleMessage(self.uid, self.subparts[part], flags=self._flags)

    def getBodyFile(self):
        return BytesIO(self.email.body.encode("utf-8"))

    def getSize(self):
        if self._raw is not None:
            return len(self._raw.encode("utf-8"))
        return self.email.size

    def getFlags(self):
        return list(self._flags)

    def getInternalDate(self):
        if self._created_at:
            dt = parse_created_at(self._created_at)
            if dt:
                return format_imap_date(dt)
        return self.email.headers.get("Date", "Mon, 1 Jan 1900 00:00:00 +0000")

    # IMessageFile
    def open(self):
        """Return complete raw MIME message for BODY[] requests."""
        if self._raw is not None:
            return BytesIO(self._raw.encode("utf-8"))
        return BytesIO(self.email.body.encode("utf-8"))
