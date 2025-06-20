import json
import logging
import httpx

from io import BytesIO
from twisted.mail import imap4
from zope.interface import implementer
from twisted.cred.portal import Portal, IRealm
from twisted.internet import protocol, reactor, defer
from twisted.cred.checkers import ICredentialsChecker, IUsernamePassword

from config import settings
from parse_email import generate_email_model, parse_email
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

    def getInternalDate(self):
        return self.email.headers.get("Date", "Mon, 1 Jan 1900 00:00:00 +0000")


@implementer(imap4.IMailboxInfo, imap4.IMailbox)
class SimpleMailbox:

    def __init__(self, name, password):
        self.name = name
        self.password = password
        self.listeners = []
        self.addListener = self.listeners.append
        self.removeListener = self.listeners.remove
        self.message_count = 0
        self._update_message_count()

    def _update_message_count(self):
        """主动获取邮件总数"""
        try:
            if self.name == "INBOX":
                endpoint = "/api/mails"
            elif self.name == "SENT":
                endpoint = "/api/sendbox"
            else:
                return

            res = httpx.get(
                f"{settings.proxy_url}{endpoint}?limit=1&offset=0",
                headers={
                    "Authorization": f"Bearer {self.password}",
                    "x-custom-auth": f"{settings.basic_password}",
                    "Content-Type": "application/json"
                }
            )
            if res.status_code == 200:
                self.message_count = res.json()["count"]
                # _logger.info(f"Updated {self.name} message count: {self.message_count}")
        except Exception as e:
            _logger.error(f"Failed to update message count for {self.name}: {e}")

    def getFlags(self):
        return ["\\Seen"]

    def getUIDValidity(self):
        return 0

    def getMessageCount(self):
        # 每次请求时更新邮件总数
        self._update_message_count()
        return self.message_count

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
        # 在状态请求时也更新邮件总数
        self._update_message_count()
        r = {}
        if "MESSAGES" in names:
            r["MESSAGES"] = self.getMessageCount()
        if "RECENT" in names:
            r["RECENT"] = self.getRecentCount()
        if "UIDNEXT" in names:
            r["UIDNEXT"] = self.getMessageCount() + 1
        if "UIDVALIDITY" in names:
            r["UIDVALIDITY"] = self.getUIDValidity()
        if "UNSEEN" in names:
            r["UNSEEN"] = self.getUnseenCount()
        return defer.succeed(r)

    def fetch(self, messages, uid):
        """边查边返回邮件"""
        def email_generator():
            for range_item in messages.ranges:
                start, end = range_item
                _logger.info(f"Fetching messages: {self.name}, range: {start}-{end}")

                for email_data in self.fetchGenerator(start, end):
                    yield email_data

        # 返回生成器，让IMAP4服务器逐个处理
        return email_generator()

    def fetchGenerator(self, start, end):
        """通用的邮件获取生成器，边查边返回"""
        start = max(start, 1)

        # 根据邮箱类型确定API端点
        if self.name == "INBOX":
            endpoint = "/api/mails"
        elif self.name == "SENT":
            endpoint = "/api/sendbox"
        else:
            return

        # 首先获取服务端邮件总数
        count_res = httpx.get(
            f"{settings.proxy_url}{endpoint}?limit=1&offset=0",
            headers={
                "Authorization": f"Bearer {self.password}",
                "x-custom-auth": f"{settings.basic_password}",
                "Content-Type": "application/json"
            }
        )
        if count_res.status_code != 200:
            _logger.error(
                f"Failed to get {self.name} email count: "
                f"code=[{count_res.status_code}] text=[{count_res.text}]"
            )
            return

        total_count = count_res.json()["count"]
        self.message_count = total_count

        if total_count == 0 or start > total_count:
            return

        # 分批处理，每次获取一小批就立即返回
        batch_size = 20
        current_start = start
        current_end = min(end or total_count, total_count)

        while current_start <= current_end:
            batch_end = min(current_start + batch_size - 1, current_end)

            # 计算这一批的参数
            limit = batch_end - current_start + 1
            server_offset = total_count - batch_end
            server_offset = max(0, server_offset)

            _logger.info(
                f"Fetching batch: start={current_start}, end={batch_end}, "
                f"total_count={total_count}, limit={limit}, "
                f"server_offset={server_offset}"
            )

            res = httpx.get(
                f"{settings.proxy_url}{endpoint}?limit={limit}&offset={server_offset}",
                headers={
                    "Authorization": f"Bearer {self.password}",
                    "x-custom-auth": f"{settings.basic_password}",
                    "Content-Type": "application/json"
                }
            )
            if res.status_code != 200:
                _logger.error(
                    f"Failed to fetch {self.name} emails: "
                    f"code=[{res.status_code}] text=[{res.text}]"
                )
                break

            emails = res.json()["results"]
            for i, item in enumerate(reversed(emails)):
                uid = total_count - server_offset - len(emails) + i + 1
                if current_start <= uid <= batch_end:
                    if self.name == "INBOX":
                        email_model = parse_email(item["raw"])
                    elif self.name == "SENT":
                        email_model = generate_email_model(item)

                    # 立即返回这封邮件
                    yield (uid, SimpleMessage(uid, email_model))

            current_start = batch_end + 1

    def getUID(self, message):
        return message.uid

    def store(self, messages, flags, mode, uid):
        # IMailboxIMAP.store
        raise NotImplementedError


class Account(imap4.MemoryAccount):

    def __init__(self, user, password):
        self.password = password
        super().__init__(user)

    def isSubscribed(self, name):
        return name.upper() in ["INBOX", "SENT"]

    def _emptyMailbox(self, name, id):
        _logger.info(f"New mailbox: {name}, {id}")
        if name == "INBOX":
            return SimpleMailbox(name, self.password)
        if name == "SENT":
            return SimpleMailbox(name, self.password)
        raise imap4.NoSuchMailbox(name.encode("utf-8"))

    def select(self, name, rw=1):
        return imap4.MemoryAccount.select(self, name)


class SimpleIMAPServer(imap4.IMAP4Server):
    def __init__(self, factory):
        imap4.IMAP4Server.__init__(self)
        self.factory = factory

    def lineReceived(self, line):
        # _logger.info(f"Received: {line}")
        super().lineReceived(line)

    def sendLine(self, line):
        # _logger.info(f"Sent: {line}")
        super().sendLine(line)


@implementer(IRealm)
class SimpleRealm:
    def requestAvatar(self, avatarId, mind, *interfaces):
        res = json.loads(avatarId)
        account = Account(res["username"], res["password"])
        account.addMailbox("INBOX")
        account.addMailbox("SENT")
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
