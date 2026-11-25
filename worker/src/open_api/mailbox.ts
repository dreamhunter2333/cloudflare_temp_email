import { Context, Hono } from 'hono'

import { handleMailListQuery } from '../common'
import { resolveRawEmailRow } from '../gzip'
import { extractCode, joinSubjectAndBody } from '../email/extract_code'
import { commonParseMail } from '../utils/mail_parser'
import { RawMailRow } from '../models'
import { getBooleanValue, getPasswords, trimLower } from '../utils'

/**
 * fork: address based mailbox read API
 *
 * GET /open_api/mailbox?address=xxx@example.com
 *
 * Reads the inbox of an address without a mailbox JWT, so automation can pull
 * verification codes by email address only.
 *
 * Access control (first match wins):
 * 1. MAILBOX_QUERY_KEY set -> request must pass ?key=<key> or x-mailbox-key
 * 2. MAILBOX_QUERY_PUBLIC=true -> open access
 * 3. site PASSWORDS set -> request must pass x-custom-auth
 * 4. otherwise -> endpoint disabled (403)
 */

const api = new Hono<HonoCustomType>()

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50
const MAX_TEXT_LENGTH = 4000
const MAX_HTML_LENGTH = 20000
const ADDRESS_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type MailboxMail = {
    id: number
    from: string
    subject: string
    created_at: string
    code: string | null
    text?: string
    html?: string
}

const MESSAGES = {
    unauthorized: 'invalid mailbox key or site password',
    disabled: 'mailbox query api is disabled, set MAILBOX_QUERY_KEY or MAILBOX_QUERY_PUBLIC',
    invalidAddress: 'query parameter address is required, e.g. /open_api/mailbox?address=user@example.com',
    addressNotFound: 'address not found',
    mailNotFound: 'mail not found',
}

const getMailboxAuthError = (c: Context<HonoCustomType>): string | null => {
    const key = (c.env.MAILBOX_QUERY_KEY || '').trim()
    if (key) {
        const providedKey = c.req.query('key') || c.req.header('x-mailbox-key') || ''
        return providedKey === key ? null : MESSAGES.unauthorized
    }
    if (getBooleanValue(c.env.MAILBOX_QUERY_PUBLIC)) {
        return null
    }
    const passwords = getPasswords(c)
    if (passwords.length > 0) {
        const providedPassword = c.req.header('x-custom-auth') || ''
        return passwords.includes(providedPassword) ? null : MESSAGES.unauthorized
    }
    return MESSAGES.disabled
}

const parseNumber = (
    value: string | undefined, fallback: number, min: number, max: number
): number => {
    const parsed = Number.parseInt(value ?? '', 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(Math.max(parsed, min), max)
}

const isEnabled = (value: string | undefined): boolean => {
    if (!value) return false
    return ["true", "1", "yes", "y", "on"].includes(value.trim().toLowerCase())
}

const toMailboxMail = async (
    row: RawMailRow, includeBody: boolean, includeHtml: boolean
): Promise<MailboxMail> => {
    const raw = row.raw ?? ''
    const parsed = raw ? await commonParseMail({ rawEmail: raw }) : undefined
    const subject = parsed?.subject ?? ''
    const code = extractCode(joinSubjectAndBody(subject, parsed?.text || parsed?.html))
    const mail: MailboxMail = {
        id: row.id,
        from: row.source ?? '',
        subject,
        created_at: row.created_at ?? '',
        code,
    }
    if (includeBody) {
        mail.text = (parsed?.text ?? '').slice(0, MAX_TEXT_LENGTH)
        if (includeHtml) {
            mail.html = (parsed?.html ?? '').slice(0, MAX_HTML_LENGTH)
        }
    }
    return mail
}

const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderHtmlPage = (
    address: string, mails: MailboxMail[], code: string | null, count: number
): string => {
    const mailItems = mails.map((mail) => `
        <li>
            <div class="meta">
                <span class="from">${escapeHtml(mail.from)}</span>
                <span class="time">${escapeHtml(mail.created_at)}</span>
            </div>
            <div class="subject">${escapeHtml(mail.subject || '(无主题)')}</div>
            ${mail.code ? `<div class="code">${escapeHtml(mail.code)}</div>` : ''}
        </li>`).join('')
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(address)}</title>
    <style>
        :root { color-scheme: light dark; }
        body { margin: 0; padding: 24px; font: 15px/1.6 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
        h1 { font-size: 18px; margin: 0 0 4px; word-break: break-all; }
        .hint { opacity: .6; font-size: 13px; margin-bottom: 16px; }
        .latest { display: inline-block; padding: 8px 16px; margin-bottom: 20px; border-radius: 8px;
                  background: #2563eb; color: #fff; font-size: 24px; letter-spacing: 2px; font-weight: 600; }
        .latest.empty { background: #6b7280; font-size: 14px; letter-spacing: 0; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { padding: 12px 0; border-bottom: 1px solid rgba(128, 128, 128, .3); }
        .meta { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; opacity: .7; }
        .from { word-break: break-all; }
        .subject { margin-top: 2px; font-weight: 500; }
        .code { margin-top: 4px; font-family: ui-monospace, Consolas, monospace; color: #2563eb; }
        .empty { opacity: .6; }
    </style>
</head>
<body>
    <h1>${escapeHtml(address)}</h1>
    <div class="hint">共 ${count} 封邮件，以下显示最新 ${mails.length} 封</div>
    <div class="latest${code ? '' : ' empty'}">${code ? escapeHtml(code) : '暂未提取到验证码'}</div>
    ${mails.length ? `<ul>${mailItems}</ul>` : '<div class="empty">收件箱为空</div>'}
</body>
</html>`
}

const getSingleMail = async (
    c: Context<HonoCustomType>, address: string, mailId: string
): Promise<Response> => {
    const row = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where id = ? and address = ?`
    ).bind(mailId, address).first<RawMailRow>()
    if (!row) {
        return c.json({ error: 'mail_not_found', message: MESSAGES.mailNotFound }, 404)
    }
    const mail = await toMailboxMail(await resolveRawEmailRow(row), true, true)
    return c.json({ address, mail })
}

api.get('/open_api/mailbox', async (c) => {
    const authError = getMailboxAuthError(c)
    if (authError) {
        return c.json({ error: 'unauthorized', message: authError }, 401)
    }

    const address = trimLower(c.req.query('address') || '')
    if (!address || !ADDRESS_PATTERN.test(address)) {
        return c.json({ error: 'invalid_address', message: MESSAGES.invalidAddress }, 400)
    }

    const addressRow = await c.env.DB.prepare(
        `SELECT id FROM address where name = ?`
    ).bind(address).first<number>("id")
    if (addressRow == null) {
        return c.json({ error: 'address_not_found', message: MESSAGES.addressNotFound, address }, 404)
    }

    const mailId = c.req.query('id')
    if (mailId) {
        return getSingleMail(c, address, mailId)
    }

    const limit = parseNumber(c.req.query('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
    const offset = parseNumber(c.req.query('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    const codeOnly = isEnabled(c.req.query('code_only'))
    const includeBody = isEnabled(c.req.query('include_body'))
    const includeHtml = includeBody && isEnabled(c.req.query('include_html'))

    const listResponse = await handleMailListQuery(
        c,
        `SELECT * FROM raw_mails where address = ?`,
        `SELECT count(id) as count FROM raw_mails where address = ?`,
        [address], limit, offset
    )
    if (listResponse.status !== 200) {
        return listResponse
    }
    const { results, count } = await listResponse.json() as {
        results: RawMailRow[], count: number
    }
    const mails = await Promise.all(
        results.map((row) => toMailboxMail(row, includeBody, includeHtml))
    )
    const matchedMails = codeOnly ? mails.filter((mail) => mail.code) : mails
    const code = matchedMails.find((mail) => mail.code)?.code ?? null

    const format = (c.req.query('format') || 'json').toLowerCase()
    if (format === 'text') {
        return c.text(code ?? '', 200, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    if (format === 'html') {
        return c.html(renderHtmlPage(address, matchedMails, code, count ?? 0))
    }
    return c.json({ address, count, code, mails: matchedMails })
})

export { api }
