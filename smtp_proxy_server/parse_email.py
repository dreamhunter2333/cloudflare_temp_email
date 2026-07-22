import json
import logging
import email

from email.message import Message
from email.mime.text import MIMEText

from models import EmailModel
from imap_message import parse_created_at, format_rfc2822_date

import re


_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)

# Matches an empty header value (header name with no value)
_EMPTY_HEADER_RE = re.compile(r'^([A-Za-z][A-Za-z0-9-]*):\s*\r?\n', re.MULTILINE)


def get_email_model(msg: Message):
    subparts = [
        get_email_model(subpart)
        for subpart in msg.get_payload()
    ] if msg.is_multipart() else []
    if msg.is_multipart():
        body = ""
    else:
        # Keep body in its original CTE encoding (base64/QP/7bit/8bit)
        # so it matches the Content-Transfer-Encoding header.
        # The IMAP client will decode CTE itself based on BODYSTRUCTURE.
        body = msg.get_payload(decode=False) or ""
    return EmailModel(
        headers={k: v for k, v in msg.items()},
        body=body,
        content_type=msg.get_content_type(),
        size=len(body.encode("utf-8") if isinstance(body, str) else body) + sum(subpart.size for subpart in subparts),
        subparts=subparts,
    )


def clean_raw_headers(raw: str) -> str:
    """Remove empty header lines that break Python email parser.

    Some emails (e.g. from Gmail via Cloudflare) have duplicate headers
    like 'Content-Type: \\n' (empty) followed by the real Content-Type.
    The empty one confuses email.message_from_string().

    Applies globally so nested message/rfc822 parts are also cleaned.
    """
    return _EMPTY_HEADER_RE.sub('', raw)


def fix_mojibake(raw: str) -> str:
    """Fix UTF-8 mojibake where upstream stored UTF-8 bytes as cp1252/latin-1.

    Tries whole-string fix first (fast path). If that fails (e.g. complex
    emails with mixed binary/text content), falls back to line-by-line fix.
    """
    # Fast path: fix entire string at once
    for enc in ("cp1252", "latin-1"):
        try:
            return raw.encode(enc).decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue

    # Slow path: fix line by line (tolerates mixed content)
    lines = raw.split('\n')
    fixed = []
    for line in lines:
        fixed_line = line
        for enc in ("cp1252", "latin-1"):
            try:
                fixed_line = line.encode(enc).decode("utf-8")
                break
            except (UnicodeDecodeError, UnicodeEncodeError):
                continue
        fixed.append(fixed_line)
    return '\n'.join(fixed)


def parse_email(raw: str) -> EmailModel:
    try:
        raw = clean_raw_headers(raw)
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



def generate_email_model(item: dict) -> tuple[EmailModel, str]:
    """Build an EmailModel from a sendbox item.

    Returns (EmailModel, raw_mime_string) so callers can pass the
    synthesised MIME to SimpleMessage for correct BODY[] responses.
    """
    email_json = json.loads(item["raw"])
    if email_json.get("version") == "v2":
        from_addr = f'{email_json["from_name"]} <{item["address"]}>' if email_json.get("from_name") else item["address"]
        to_addr = f'{email_json["to_name"]} <{email_json["to_mail"]}>' if email_json.get("to_name") else email_json["to_mail"]
        content = email_json["content"]
        subtype = "html" if email_json.get("is_html") else "plain"
    else:
        from_addr = f'{email_json["from"]["name"]} <{email_json["from"]["email"]}>'
        to_addr = ", ".join(
            [f"{to['name']} <{to['email']}>" for to in email_json["personalizations"][0]["to"]])
        content = email_json["content"][0]["value"]
        subtype = "html" if "html" in email_json["content"][0]["type"] else "plain"

    message = MIMEText(content, subtype, "utf-8")
    message['From'] = from_addr
    message['To'] = to_addr
    message['Subject'] = email_json["subject"]
    dt = parse_created_at(item["created_at"])
    if dt:
        message["Date"] = format_rfc2822_date(dt)
    raw_mime = message.as_string()
    return parse_email(raw_mime), raw_mime
