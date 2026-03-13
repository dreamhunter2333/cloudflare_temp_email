const TG_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB Telegram Bot API limit

export async function sendTelegramAttachments(
    botToken: string,
    chatId: string,
    attachments: ParsedEmailAttachment[],
    caption: string
) {
    try {
        const validAttachments = attachments.filter(att => {
            if (att.content.byteLength > TG_MAX_FILE_SIZE) {
                console.log(`Skipping attachment ${att.filename}: ${(att.content.byteLength / 1024 / 1024).toFixed(1)}MB exceeds 50MB limit`);
                return false;
            }
            return true;
        });
        if (validAttachments.length === 0) return;

        const batchSize = 6;
        for (let i = 0; i < validAttachments.length; i += batchSize) {
            const batch = validAttachments.slice(i, i + batchSize);
            const formData = new FormData();
            const media: { type: string; media: string; caption?: string }[] = [];
            for (let j = 0; j < batch.length; j++) {
                const att = batch[j];
                const attachKey = `file${j}`;
                media.push({
                    type: 'document',
                    media: `attach://${attachKey}`,
                    ...(i === 0 && j === 0 ? { caption } : {}),
                });
                const blob = new Blob([att.content], { type: 'application/octet-stream' });
                formData.append(attachKey, blob, att.filename || `attachment_${j}`);
            }
            formData.append('chat_id', chatId);
            formData.append('media', JSON.stringify(media));
            const res = await fetch(
                `https://api.telegram.org/bot${botToken}/sendMediaGroup`,
                { method: 'POST', body: formData }
            );
            if (!res.ok) {
                const text = await res.text();
                console.error(`Failed to send attachment batch ${i / batchSize + 1}: ${res.status} ${text.substring(0, 200)}`);
            }
        }
    } catch (e) {
        console.error("Failed to send telegram attachments:", e);
    }
}
