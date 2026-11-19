export const commonParseMail = async (parsedEmailContext: ParsedEmailContext): Promise<{
    sender: string,
    subject: string,
    text: string,
    html: string,
    headers?: Record<string, string>[],
    attachments?: ParsedEmailAttachment[],
} | undefined> => {
    // check parsed email context is valid
    if (!parsedEmailContext || !parsedEmailContext.rawEmail) {
        return undefined;
    }
    // return parsed email if already parsed
    if (parsedEmailContext.parsedEmail) {
        return parsedEmailContext.parsedEmail;
    }
    const raw_mail = parsedEmailContext.rawEmail;
    // NOTE: WASM parse email
    // try {
    //     const { parse_message_wrapper } = await import('mail-parser-wasm-worker');

    //     const parsedEmail = parse_message_wrapper(raw_mail);
    //     parsedEmailContext.parsedEmail = {
    //         sender: parsedEmail.sender || "",
    //         subject: parsedEmail.subject || "",
    //         text: parsedEmail.text || "",
    //         headers: parsedEmail.headers?.map(
    //             (header) => ({ key: header.key, value: header.value })
    //         ) || [],
    //         html: parsedEmail.body_html || "",
    //         attachments: (parsedEmail.attachments || []).map(att => ({
    //             filename: att.filename || "attachment",
    //             mimeType: att.content_type || "application/octet-stream",
    //             content: att.content,
    //             disposition: "attachment",
    //         })),
    //     };
    //     return parsedEmailContext.parsedEmail;
    // } catch (e) {
    //     console.error("Failed use mail-parser-wasm-worker to parse email", e);
    // }
    try {
        const { default: PostalMime } = await import('postal-mime');
        const parsedEmail = await PostalMime.parse(raw_mail);
        parsedEmailContext.parsedEmail = {
            sender: parsedEmail.from ? `${parsedEmail.from.name} <${parsedEmail.from.address}>` : "",
            subject: parsedEmail.subject || "",
            text: parsedEmail.text || "",
            html: parsedEmail.html || "",
            headers: parsedEmail.headers || [],
            attachments: (parsedEmail.attachments || []).map(att => ({
                filename: att.filename || "attachment",
                mimeType: att.mimeType || "application/octet-stream",
                content: new Uint8Array(att.content),
                disposition: att.disposition || "attachment",
            })),
        };
        return parsedEmailContext.parsedEmail;
    }
    catch (e) {
        console.error("Failed use PostalMime to parse email", e);
    }
    return undefined;
}
