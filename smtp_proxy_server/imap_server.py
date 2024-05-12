import json
import logging
import requests

from io import BytesIO
from twisted.mail import imap4
from zope.interface import implementer
from twisted.cred.portal import Portal, IRealm
from twisted.internet import protocol, reactor, defer
from twisted.cred.checkers import ICredentialsChecker, IUsernamePassword

from config import settings
from parse_email import parse_email
from models import EmailModel

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)


@implementer(imap4.IMessage)
class SimpleMessage:

    def __init__(self, uid=None, email_model: EmailModel = None):
        self.uid = uid
        self.email = email_model
        self.subparts = self.email.subparts

    def getUID(self):
        return self.uid

    def getHeaders(self, negate, *names):
        self.got_headers = negate, names
        return {
            k.lower(): v
            for k, v in self.email.headers.items()
        }

    def isMultipart(self):
        return len(self.subparts) > 0

    def getSubPart(self, part):
        self.got_subpart = part
        return SimpleMessage(email_model=self.subparts[part])

    def getBodyFile(self):
        return BytesIO(self.email.body.encode("utf-8"))

    def getSize(self):
        return self.email.size

    def getFlags(self):
        return ["\\Seen"]


@implementer(imap4.IMailboxInfo, imap4.IMailbox)
class SimpleMailbox:

    def __init__(self, password):
        self.password = password
        self.listeners = []
        self.addListener = self.listeners.append
        self.removeListener = self.listeners.remove
        self.message_count = 0

    def getFlags(self):
        return ["\\Seen"]

    def getUIDValidity(self):
        return 0

    def getMessageCount(self):
        return 2 ** 31 - 1

    def getRecentCount(self):
        return 0

    def getUnseenCount(self):
        return 0

    def isWriteable(self):
        return 0

    def destroy(self):
        pass

    def getHierarchicalDelimiter(self):
        return "/"

    def requestStatus(self, names):
        r = {}
        if "MESSAGES" in names:
            r["MESSAGES"] = self.getMessageCount()
        if "RECENT" in names:
            r["RECENT"] = self.getRecentCount()
        if "UIDNEXT" in names:
            r["UIDNEXT"] = self.getMessageCount() + 1
        if "UIDVALIDITY" in names:
            r["UIDVALIDITY"] = self.getUID()
        if "UNSEEN" in names:
            r["UNSEEN"] = self.getUnseenCount()
        return defer.succeed(r)

    def fetch(self, messages, uid):
        start, end = messages.ranges[0]
        start = max(start, 1)
        if self.message_count > 0 and start > self.message_count:
            return []
        res = requests.get(
            f"{settings.proxy_url}/api/mails?limit=20&offset={start - 1}", headers={
                "Authorization": f"Bearer {self.password}",
                "Content-Type": "application/json"
            }
        )
        if res.status_code != 200:
            _logger.error(
                "Failed: "
                f"code=[{res.status_code}] text=[{res.text}]"
            )
            raise Exception("Failed to fetch emails")
        if res.json()["count"] > 0:
            self.message_count = res.json()["count"]
        return [
            (start + uid, SimpleMessage(start + uid, parse_email(item["raw"])))
            for uid, item in enumerate(reversed(res.json()["results"]))
        ]

    def getUID(self, message):
        return message.uid

    def store(self, messages, flags, mode, uid):
        # IMailboxIMAP.store
        pass


class Account(imap4.MemoryAccount):

    def __init__(self, user, password):
        self.password = password
        super().__init__(user)

    def _emptyMailbox(self, name, id):
        _logger.info(f"New mailbox: {name}, {id}")
        if name != "INBOX":
            raise imap4.NoSuchMailbox(name)
        return SimpleMailbox(self.password)

    def select(self, name, rw=1):
        return imap4.MemoryAccount.select(self, name)


class SimpleIMAPServer(imap4.IMAP4Server):
    def __init__(self, factory):
        imap4.IMAP4Server.__init__(self)
        self.factory = factory

    def lineReceived(self, line):
        super().lineReceived(line)


@implementer(IRealm)
class SimpleRealm:
    def requestAvatar(self, avatarId, mind, *interfaces):
        res = json.loads(avatarId)
        account = Account(res["username"], res["password"])
        account.addMailbox("INBOX")
        return imap4.IAccount, account, lambda: None


class IMAPFactory(protocol.Factory):
    def __init__(self, portal):
        self.portal = portal

    def buildProtocol(self, addr):
        p = SimpleIMAPServer(self)
        p.portal = self.portal
        return p


@implementer(ICredentialsChecker)
class CustomChecker:
    credentialInterfaces = (IUsernamePassword,)

    def requestAvatarId(self, credentials):
        return defer.succeed(json.dumps({
            "username": credentials.username.decode(),
            "password": credentials.password.decode(),
        }))


def start_imap_server():
    _logger.info(f"Starting IMAP server on port {settings.imap_port}")
    portal = Portal(SimpleRealm(), [CustomChecker()])
    reactor.listenTCP(settings.imap_port, IMAPFactory(portal))
    reactor.run()


if __name__ == "__main__":
    _logger.info(f"Starting server settings[{settings}]")
    start_imap_server()
