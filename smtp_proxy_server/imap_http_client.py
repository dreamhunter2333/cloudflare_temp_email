import logging

import httpx
from twisted.internet import defer, threads

from config import settings

_logger = logging.getLogger(__name__)
_logger.setLevel(logging.INFO)


class BackendClient:
    """Async HTTP client for IMAP backend communication.

    All public methods return Deferred via deferToThread to avoid
    blocking the Twisted reactor with synchronous HTTP calls.
    """

    def __init__(self, password: str):
        self.password = password
        self._client = httpx.Client(
            base_url=settings.proxy_url,
            headers={
                "Authorization": f"Bearer {password}",
                "x-custom-auth": settings.basic_password,
                "Content-Type": "application/json",
            },
            timeout=settings.imap_http_timeout,
        )

    def _get_endpoint(self, mailbox_name: str) -> str:
        if mailbox_name == "INBOX":
            return "/api/mails"
        elif mailbox_name == "SENT":
            return "/api/sendbox"
        raise ValueError(f"Unknown mailbox: {mailbox_name}")

    def _sync_get_message_count(self, mailbox_name: str) -> int:
        endpoint = self._get_endpoint(mailbox_name)
        res = self._client.get(f"{endpoint}?limit=1&offset=0")
        res.raise_for_status()
        return res.json()["count"]

    def _sync_get_messages(
        self, mailbox_name: str, limit: int, offset: int
    ) -> tuple[list[dict], int | None]:
        """Fetch messages from backend.

        Returns (results, count) where count is only valid when offset=0.
        """
        endpoint = self._get_endpoint(mailbox_name)
        res = self._client.get(f"{endpoint}?limit={limit}&offset={offset}")
        res.raise_for_status()
        data = res.json()
        count = data.get("count") if offset == 0 else None
        return data["results"], count

    def get_message_count(self, mailbox_name: str) -> defer.Deferred:
        return threads.deferToThread(self._sync_get_message_count, mailbox_name)

    def get_messages(
        self, mailbox_name: str, limit: int, offset: int
    ) -> defer.Deferred:
        return threads.deferToThread(
            self._sync_get_messages, mailbox_name, limit, offset
        )

    def close(self):
        self._client.close()
