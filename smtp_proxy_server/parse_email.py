import email
from email.message import Message
import logging

from models import EmailModel

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)


def get_email_model(msg: Message):
    subparts = [
        get_email_model(subpart)
        for subpart in msg.get_payload()
    ] if msg.is_multipart() else []
    body = "" if msg.is_multipart() else msg._payload
    return EmailModel(
        headers={k: v for k, v in msg.items()},
        body=body,
        content_type=msg.get_content_type(),
        size=len(body) + sum(subpart.size for subpart in subparts),
        subparts=subparts,
    )


def parse_email(raw: str) -> EmailModel:
    try:
        msg = email.message_from_string(raw)
        return get_email_model(msg)
    except Exception as e:
        _logger.error(f"Could not parse email: {e}")
        return EmailModel(
            headers={},
            body="could not parse email",
            content_type="text/plain",
            size=len("could not parse email"),
            subparts=[],
        )
