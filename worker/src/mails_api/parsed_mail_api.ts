import { Context } from 'hono'

import { commonParseMail, handleMailListQuery, updateAddressUpdatedAt } from '../common'
import { resolveRawEmailRow } from '../gzip'

const toParsedMailRow = async (row: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const raw = typeof row.raw === 'string' ? row.raw : '';
    const parsed = raw ? await commonParseMail({ rawEmail: raw }) : undefined;
    const { raw: _raw, ...rest } = row;
    return {
        ...rest,
        sender: parsed?.sender?.trim() ?? '',
        subject: parsed?.subject ?? '',
        text: parsed?.text ?? '',
        html: parsed?.html ?? '',
        attachments: (parsed?.attachments ?? []).map(a => ({
            filename: a.filename,
            mimeType: a.mimeType,
            disposition: a.disposition,
            size: a.content?.length ?? 0,
        })),
    };
};

const listParsedMails = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload");
    if (!address) return c.json({ "error": "No address" }, 400);
    const { limit, offset } = c.req.query();
    if (Number.parseInt(offset) <= 0) updateAddressUpdatedAt(c, address);
    const listRes = await handleMailListQuery(c,
        `SELECT * FROM raw_mails where address = ?`,
        `SELECT count(*) as count FROM raw_mails where address = ?`,
        [address], limit, offset
    );
    if (listRes.status !== 200) return listRes;
    const { results, count } = await listRes.json() as { results: Record<string, unknown>[], count: number };
    const parsed = await Promise.all(results.map(toParsedMailRow));
    return c.json({ results: parsed, count });
};

const getParsedMail = async (c: Context<HonoCustomType>) => {
    const { address } = c.get("jwtPayload");
    const { mail_id } = c.req.param();
    const row = await c.env.DB.prepare(
        `SELECT * FROM raw_mails where id = ? and address = ?`
    ).bind(mail_id, address).first();
    if (!row) return c.json(null);
    const resolved = await resolveRawEmailRow(row);
    return c.json(await toParsedMailRow(resolved as Record<string, unknown>));
};

export default { listParsedMails, getParsedMail };
