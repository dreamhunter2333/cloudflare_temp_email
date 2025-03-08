import datetime
import json
import logging
import email

from email.message import Message
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


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


def generate_email_model(item: dict) -> EmailModel:
    email_json = json.loads(item["raw"])
    message = MIMEMultipart()
    if email_json.get("version") == "v2":
        message['From'] = f'{email_json["from_name"]} <{item["address"]}>' if email_json.get("from_name") else item["address"]
        message['To'] = f'{email_json["to_name"]} <{email_json["to_mail"]}>' if email_json.get("to_name") else email_json["to_mail"]
        message.attach(MIMEText(
            email_json["content"],
            "html" if email_json.get("is_html") else "plain"
        ))
    else:
        message['From'] = f'{email_json["from"]["name"]} <{email_json["from"]["email"]}>'
        message['To'] = ", ".join(
            [f"{to['name']} <{to['email']}>" for to in email_json["personalizations"][0]["to"]])
        message.attach(MIMEText(
            email_json["content"][0]["value"],
            "html" if "html" in email_json["content"][0]["type"] else "plain"
        ))
    message['Subject'] = email_json["subject"]
    message["Date"] = datetime.datetime.strptime(
        item["created_at"], "%Y-%m-%d %H:%M:%S"
    ).strftime("%a, %d %b %Y %H:%M:%S +0000")
    return parse_email(message.as_string())
