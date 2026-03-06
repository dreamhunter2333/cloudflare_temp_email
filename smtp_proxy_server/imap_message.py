from io import BytesIO

from twisted.mail import imap4
from zope.interface import implementer

from models import EmailModel


@implementer(imap4.IMessage, imap4.IMessageFile)
class SimpleMessage:

    def __init__(self, uid: int, email_model: EmailModel,
                 flags: set[str] = None, raw: str = None):
        self.uid = uid
        self.email = email_model
        self.subparts = self.email.subparts
        self._flags = flags if flags is not None else set()
        self._raw = raw

    def getUID(self):
        return self.uid

    def getHeaders(self, negate, *names):
        # Twisted passes header names as bytes (e.g. b"SUBJECT");
        # normalize to lowercase str for comparison.
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
        return self.email.headers.get("Date", "Mon, 1 Jan 1900 00:00:00 +0000")

    # IMessageFile
    def open(self):
        """Return complete raw MIME message for BODY[] requests."""
        if self._raw is not None:
            return BytesIO(self._raw.encode("utf-8"))
        return BytesIO(self.email.body.encode("utf-8"))
