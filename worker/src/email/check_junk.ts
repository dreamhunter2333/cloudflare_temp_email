import { getBooleanValue, getStringArray } from "../utils";
import { commonParseMail } from "../common";

export const check_if_junk_mail = async (
    env: Bindings, address: string,
    parsedEmailContext: ParsedEmailContext,
    message_id: string | null
): Promise<boolean> => {
    if (!getBooleanValue(env.ENABLE_CHECK_JUNK_MAIL)) {
        return false;
    }
    const parsedEmail = await commonParseMail(parsedEmailContext);
    if (!parsedEmail?.headers) return false;

    const checkListWhenExist = getStringArray(env.JUNK_MAIL_CHECK_LIST);
    const forcePassList = getStringArray(env.JUNK_MAIL_FORCE_PASS_LIST);
    const passedList: string[] = [];
    const existList: string[] = [];

    const headers = parsedEmail.headers;
    for (const header of headers) {
        if (!header["key"]) continue;
        if (!header["value"]) continue;

        // check spf
        if (header["key"].toLowerCase() == "received-spf") {
            existList.push("spf");
            if (header["value"].toLowerCase().includes("pass")) {
                passedList.push("spf");
            }
        }

        // check dkim and dmarc
        if (header["key"].toLowerCase() == "authentication-results") {
            if (header["value"].toLowerCase().includes("dkim=")) {
                existList.push("dkim");
                if (header["value"].toLowerCase().includes("dkim=pass")) {
                    passedList.push("dkim");
                }
            }
            if (header["value"].toLowerCase().includes("dmarc=")) {
                existList.push("dmarc");
                if (header["value"].toLowerCase().includes("dmarc=pass")) {
                    passedList.push("dmarc");
                }
            }
        }
    }
    // check if all checkListWhenExist item passed when exist
    if (checkListWhenExist?.some(
        (checkName) => existList.includes(checkName.toLowerCase())
            && !passedList.includes(checkName.toLowerCase())
    )) {
        return true;
    }

    if (forcePassList?.length == 0) return false;

    // check force pass list
    return forcePassList.some(
        (checkName) => !passedList.includes(checkName.toLowerCase())
    );
}
