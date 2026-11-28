"""Regression test: the SMTP proxy must send the site password.

When the worker sets `PASSWORDS`, every request outside `/open_api` and
`/telegram/` needs the `x-custom-auth` header. The IMAP client already
sends `settings.basic_password` there (#353), but the SMTP send path
posted to `/external/api/send_mail` without it, so every SMTP send was
rejected with 401.
"""
import asyncio
import unittest
from types import SimpleNamespace
from unittest import mock

from aiosmtpd.smtp import LoginPassword

import smtp_server
from config import settings


RAW_MAIL = (
    "From: Sender <sender@example.com>\r\n"
    "To: Rcpt <rcpt@example.com>\r\n"
    "Subject: hello\r\n"
    "Content-Type: text/plain; charset=utf-8\r\n"
    "\r\n"
    "body\r\n"
)


class SMTPCustomAuthTest(unittest.TestCase):

    def _send(self):
        session = SimpleNamespace(
            auth_data=LoginPassword(b"sender@example.com", b"jwt-token"))
        envelope = SimpleNamespace(
            mail_from="sender@example.com",
            rcpt_tos=["rcpt@example.com"],
            content=RAW_MAIL,
        )
        handler = smtp_server.CustomSMTPHandler()
        return asyncio.run(handler.handle_DATA(None, session, envelope))

    def test_send_mail_carries_site_password(self):
        response = SimpleNamespace(status_code=200, text="{}")
        with mock.patch.object(settings, "basic_password", "sitepw"), \
                mock.patch.object(smtp_server.httpx, "post",
                                  return_value=response) as post:
            self.assertEqual(self._send(), "250 OK")
        post.assert_called_once()
        headers = post.call_args.kwargs["headers"]
        self.assertEqual(headers.get("x-custom-auth"), "sitepw")
        self.assertEqual(headers.get("Content-Type"), "application/json")
        self.assertEqual(post.call_args.kwargs["json"]["token"], "jwt-token")


if __name__ == "__main__":
    unittest.main()
