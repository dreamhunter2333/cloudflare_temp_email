import asyncio
import logging
import email
import httpx

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP, Session, Envelope, AuthResult, LoginPassword

from config import settings

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)


class CustomSMTPHandler:

    def authenticator(self, server, session, envelope, mechanism, auth_data):
        fail_nothandled = AuthResult(success=False, handled=False)
        if mechanism not in ("LOGIN", "PLAIN"):
            _logger.warning(f"Unsupported mechanism {mechanism}")
            return fail_nothandled
        if not isinstance(auth_data, LoginPassword):
            _logger.warning(f"Invalid auth data {auth_data}")
            return fail_nothandled
        return AuthResult(success=True, auth_data=auth_data)

    async def handle_DATA(self, server: SMTP, session: Session, envelope: Envelope) -> str:
        _logger.info(
            f"handle_DATA from {envelope.mail_from} to {envelope.rcpt_tos}"
        )
        if not isinstance(session.auth_data, LoginPassword):
            return '530 Authentication required'
        if len(envelope.rcpt_tos) != 1:
            return '500 Only one recipient allowed'
        # Only one recipient allowed
        to_mail = envelope.rcpt_tos[0]
        # Parse email
        msg = email.message_from_string(envelope.content)
        content_list = []
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                charset = part.get_content_charset()
                cte = str(part.get('content-transfer-encoding', '')).lower()
                if content_type not in ["text/plain", "text/html"]:
                    _logger.warning(f"Skipping {content_type}")
                    continue
                if cte == "8bit":
                    value = part.get_payload(decode=False)
                else:
                    payload = part.get_payload(decode=True)
                    value = payload.decode(charset) if charset else payload
                if not value:
                    continue
                content_list.append({
                    "type": content_type,
                    "value": value
                })
        elif msg.get_content_type() in ["text/plain", "text/html"] and msg.get_payload(decode=True):
            cte = str(msg.get('content-transfer-encoding', '')).lower()
            charset = msg.get_content_charset()
            if cte == "8bit":
                value = msg.get_payload(decode=False)
            else:
                payload = msg.get_payload(decode=True)
                value = payload.decode(charset) if charset else payload
            _logger.info(f"Payload {msg._payload} charset {charset}")
            content_list.append({
                "type": msg.get_content_type(),
                "value": value
            })

        if not content_list:
            return '500 Invalid content'
        body = max(
            content_list,
            key=lambda x: (x["type"] == "text/html", len(x["value"]))
        )
        from_name, _ = email.utils.parseaddr(
            str(email.header.make_header(
                email.header.decode_header(msg['From'])
            ))
        )
        to_mail_map = {}
        for to in str(email.header.make_header(
            email.header.decode_header(msg['To'])
        )).split(","):
            tmp_to_name, tmp_to_mail = email.utils.parseaddr(to)
            to_mail_map[tmp_to_mail] = tmp_to_name
        _logger.info(f"Parsed mail from {from_name} to {to_mail_map}")
        # Send mail
        send_body = {
            "token": session.auth_data.password.decode(),
            "from_name": from_name,
            "to_name": to_mail_map.get(to_mail),
            "to_mail": to_mail,
            "subject": str(email.header.make_header(
                email.header.decode_header(msg['Subject'])
            )),
            "is_html": body["type"] == "text/html",
            "content": body["value"],
        }
        _logger.info(f"Send mail {dict(send_body, token='***')}")
        try:
            res = httpx.post(
                f"{settings.proxy_url}/external/api/send_mail",
                json=send_body, headers={
                    "Content-Type": "application/json"
                }
            )
            if res.status_code != 200:
                _logger.error(
                    "Failed to send mail "
                    f"code=[{res.status_code}] text=[{res.text}]"
                )
                return f'500 Internal server error code=[{res.status_code}] text=[{res.text}]'
        except Exception as e:
            _logger.error(e)
            return '500 Internal server error'

        return '250 OK'


handler = CustomSMTPHandler()
server = Controller(
    handler,
    hostname="",
    port=settings.port,
    auth_require_tls=False,
    decode_data=True,
    authenticator=handler.authenticator,
    auth_exclude_mechanism=["DONT"]
)


async def start():
    _logger.info(f"Starting server on port {settings.port}")
    server.start()


def start_smtp_server():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    task = loop.create_task(start())
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        _logger.info("Got KeyboardInterrupt, stopping")
        server.stop()


if __name__ == "__main__":
    _logger.info(f"Starting server settings[{settings}]")
    start_smtp_server()
