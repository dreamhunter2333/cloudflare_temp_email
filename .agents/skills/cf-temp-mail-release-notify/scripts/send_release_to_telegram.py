#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx>=0.27"]
# ///
"""Send a cloudflare_temp_email release announcement to a Telegram channel topic.

Usage:
    uv run scripts/send_release_to_telegram.py <tag>

Reads skill config from ../config.json (relative to this script):
    {
      "token": "...",
      "chat_id": "@channel_or_-100...",
      "message_thread_id": 82
    }
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import httpx

TG_API = "https://api.telegram.org"
TG_HARD_LIMIT = 4096
BODY_BUDGET = 3500  # leave room for header + footer
EN_MARKER_RE = re.compile(r"<details>\s*<summary>English</summary>", re.IGNORECASE)
MDV2_ESCAPE_RE = re.compile(r"([_*\[\]()~`>#+\-=|{}.!\\])")
MDV2_CODE_ESCAPE_RE = re.compile(r"([`\\])")
MD_INLINE_RE = re.compile(r"\*\*(.+?)\*\*|`([^`]+)`")
MD_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def md_escape(text: str) -> str:
    """Escape all MarkdownV2 reserved characters."""
    return MDV2_ESCAPE_RE.sub(r"\\\1", text)


def md_render(text: str) -> str:
    """Convert source Markdown (changelog) to Telegram MarkdownV2.

    Handles:
      - `### Heading`     -> bold line
      - `**bold**`        -> `*bold*`
      - `` `code` ``      -> `` `code` `` (only ` and \\ escaped inside)
      - everything else:   literal text with MDV2 specials escaped
    """
    out: list[str] = []
    for raw in text.splitlines():
        m = MD_HEADING_RE.match(raw)
        if m:
            out.append(f"*{md_escape(m.group(2).strip())}*")
            continue
        segments: list[str] = []
        last = 0
        for im in MD_INLINE_RE.finditer(raw):
            segments.append(md_escape(raw[last:im.start()]))
            if im.group(1) is not None:
                segments.append(f"*{md_escape(im.group(1))}*")
            else:
                segments.append(f"`{MDV2_CODE_ESCAPE_RE.sub(r'\\\\\1', im.group(2))}`")
            last = im.end()
        segments.append(md_escape(raw[last:]))
        out.append("".join(segments))
    return "\n".join(out)


def load_config() -> dict:
    cfg_path = Path(__file__).resolve().parent.parent / "config.json"
    if not cfg_path.exists():
        die(f"config missing: {cfg_path}")
    try:
        cfg = json.loads(cfg_path.read_text())
    except json.JSONDecodeError as e:
        die(f"config.json is not valid JSON: {e}")
    for k in ("token", "chat_id", "message_thread_id"):
        if k not in cfg:
            die(f"config.json missing key: {k}")
    return cfg


def fetch_release(tag: str) -> dict:
    out = subprocess.run(
        ["gh", "release", "view", tag, "--json", "tagName,name,body,url"],
        capture_output=True, text=True, check=False,
    )
    if out.returncode != 0:
        die(f"gh release view failed: {out.stderr.strip()}")
    return json.loads(out.stdout)


def extract_sections(body: str) -> tuple[str, str]:
    m = EN_MARKER_RE.search(body)
    if not m:
        return body.strip(), ""
    zh = body[: m.start()]
    rest = body[m.end():]
    close = rest.find("</details>")
    if close < 0:
        die("malformed release body: missing </details> after English marker")
    en = rest[:close]
    return zh.strip(), en.strip()


def strip_noise(text: str) -> str:
    """Drop PR collapsibles, cache-clearing link, and Full Changelog line."""
    lines = text.splitlines()
    out: list[str] = []
    depth = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("<details>"):
            depth += 1
            continue
        if stripped.startswith("</details>"):
            depth = max(0, depth - 1)
            continue
        if depth > 0:
            continue
        if "discussions/487" in stripped:
            continue
        if stripped.startswith("**Full Changelog**"):
            continue
        out.append(line)
    result: list[str] = []
    blanks = 0
    for line in out:
        if not line.strip():
            blanks += 1
            if blanks <= 1:
                result.append(line)
        else:
            blanks = 0
            result.append(line)
    return "\n".join(result).strip()


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def _budget(zh: str, en: str, total: int) -> tuple[int, int]:
    """Split budget between zh and en based on actual length. Short side keeps full, long side absorbs the rest."""
    if not en:
        return total, 0
    if len(zh) + len(en) <= total:
        return len(zh), len(en)
    half = total // 2
    if len(zh) <= half:
        return len(zh), total - len(zh)
    if len(en) <= half:
        return total - len(en), len(en)
    return half, total - half


def build_message(tag: str, name: str, url: str, body: str) -> str:
    zh, en = extract_sections(body)
    zh = strip_noise(zh)
    en = strip_noise(en)

    zh_limit, en_limit = _budget(zh, en, BODY_BUDGET)
    zh = truncate(zh, zh_limit)
    en = truncate(en, en_limit) if en else ""

    title = md_escape(name or tag)
    header = f"🚀 *{title} 已发布 / Released*"
    parts = [header, "", md_render(zh)]
    if en:
        parts.extend(["", "__English__", "", md_render(en)])
    parts.extend(["", f"🔗 {md_escape(url)}"])
    return "\n".join(parts)


def send(cfg: dict, text: str) -> None:
    payload = {
        "chat_id": cfg["chat_id"],
        "message_thread_id": cfg["message_thread_id"],
        "text": text,
        "parse_mode": "MarkdownV2",
        "disable_web_page_preview": False,
    }
    try:
        resp = httpx.post(
            f"{TG_API}/bot{cfg['token']}/sendMessage",
            json=payload,
            timeout=30,
        )
    except httpx.HTTPError as e:
        die(f"Telegram network error: {e}")
    try:
        data = resp.json()
    except ValueError:
        die(f"Telegram API returned non-JSON ({resp.status_code}): {resp.text[:200]!r}")
    if resp.status_code != 200 or not data.get("ok"):
        die(f"Telegram API rejected ({resp.status_code}): {data}")
    print(f"ok: message_id={data['result'].get('message_id')}")


def main() -> None:
    if len(sys.argv) != 2:
        die("usage: send_release_to_telegram.py <tag>")
    cfg = load_config()
    rel = fetch_release(sys.argv[1])
    text = build_message(rel["tagName"], rel.get("name", ""), rel["url"], rel.get("body", ""))
    send(cfg, text)


if __name__ == "__main__":
    main()
