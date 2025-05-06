import { getBooleanValue } from "../utils";
import { commonParseMail } from "../common";
import { createMimeMessage } from "mimetext";

export const remove_attachment_if_need = async (
    env: Bindings,
    parsedEmailContext: ParsedEmailContext,
    from_address: string,
    to_address: string,
    size: number
): Promise<void> => {
    // if configured, remove all attachment
    const removeAllAttachment = getBooleanValue(env.REMOVE_ALL_ATTACHMENT);
    // if attachment size > 2MB, remove attachment
    const removeExceedSizeAttachment = getBooleanValue(env.REMOVE_EXCEED_SIZE_ATTACHMENT) && size >= 2 * 1024 * 1024;
    const shouldRemoveAttachment = removeAllAttachment || removeExceedSizeAttachment;
    if (!shouldRemoveAttachment) return;

    const parsedEmail = await commonParseMail(parsedEmailContext);
    if (!parsedEmail) return;

    const msg = createMimeMessage();
    if (parsedEmail?.headers) {
        for (const header of parsedEmail.headers) {
            try {
                msg.setHeader(header["key"], header["value"]);
            } catch (error) {
                // ignore
            }
        }
    }
    msg.setSender({
        name: parsedEmail?.sender || from_address,
        addr: from_address
    });
    msg.setRecipient(to_address);
    msg.setSubject(parsedEmail?.subject || "Failed to parse email subject");
    if (parsedEmail?.html) {
        msg.addMessage({
            contentType: 'text/html',
            data: parsedEmail.html
        });
    }
    if (parsedEmail?.text) {
        msg.addMessage({
            contentType: 'text/plain',
            data: parsedEmail.text
        });
    }
    parsedEmailContext.rawEmail = msg.asRaw();
}
