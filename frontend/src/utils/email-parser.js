import PostalMime from 'postal-mime';

function humanFileSize(size) {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return parseFloat((size / Math.pow(1024, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}

async function processAttachment(item, { content, contentType, contentId, filename }, prepareInlineImages) {
    const blob = new Blob([content], { type: contentType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const attachment = {
        id: contentId || Math.random().toString(36).substring(2, 15),
        filename: filename || contentId || '',
        size: humanFileSize(content?.length || 0),
        url,
        blob,
    };
    if (!contentId) return attachment;

    const exactCid = `cid:${contentId}`;
    const cid = item.message.includes(exactCid)
        ? exactCid
        : `cid:${contentId.replace(/^<(.+)>$/, '$1')}`;
    if (!item.message.includes(cid)) return attachment;

    item.message = item.message.replace(cid, url);
    if (prepareInlineImages) {
        attachment.inlineImageUrl = await getInlineImageUrl(blob);
    }
    return attachment;
}

export async function processItem(item, { prepareInlineImages = false } = {}) {
    // Try to parse the email using mail-parser-wasm
    item.originalSource = item.source;
    try {
        const { parse_message } = await import('mail-parser-wasm');
        const parsedEmail = parse_message(item.raw);
        item.source = parsedEmail.sender || item.source;
        item.subject = parsedEmail.subject || '';
        item.message = parsedEmail.body_html || parsedEmail.text || '';
        item.text = parsedEmail.text || '';
        item.attachments = await Promise.all(parsedEmail.attachments?.map((attachment) => processAttachment(item, {
            content: attachment.content,
            contentType: attachment.content_type,
            contentId: attachment.content_id,
            filename: attachment.filename,
        }, prepareInlineImages)) ?? []);
    } catch (error) {
        console.log('Error parsing email with mail-parser-wasm');
        console.error(error);
    }
    if (item.subject && item.subject.length > 0 && item.message && item.message.length > 0) {
        return item;
    }
    // Fallback to PostalMime
    try {
        const parsedEmail = await PostalMime.parse(item.raw);
        item.source = parsedEmail.from?.address || item.source;
        if (parsedEmail.from?.address && parsedEmail.from.name) {
            item.source = `${parsedEmail.from.name} <${parsedEmail.from.address}>`;
        }
        item.subject = parsedEmail.subject || 'No Subject';
        item.message = parsedEmail.html || parsedEmail.text || item.raw;
        item.text = parsedEmail.text || '';
        item.attachments = await Promise.all(parsedEmail.attachments?.map((attachment) => processAttachment(item, {
            content: attachment.content,
            contentType: attachment.mimeType,
            contentId: attachment.contentId,
            filename: attachment.filename,
        }, prepareInlineImages)) ?? []);
    } catch (error) {
        console.log('Error parsing email with PostalMime');
        console.error(error);
        item.subject = 'No Subject';
        item.message = item.raw;
    }
    return item;
}

async function getInlineImageUrl(blob) {
    const type = blob.type.split(';', 1)[0].trim();
    const generic = type === 'application/octet-stream';
    if (!generic && !/^image\/[a-z0-9.+-]+$/.test(type)) return null;

    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob.slice(0, blob.size, type));
    });
    if (!dataUrl || !generic) return dataUrl;

    const image = new Image();
    image.src = dataUrl;
    return image.decode().then(() => dataUrl, () => null);
}

export function getDownloadEmlUrl(raw) {
    return URL.createObjectURL(
        new Blob([raw], { type: 'text/plain' }
        ))
}

