import { Bindings } from "../types";
import { getBooleanValue, getStringArray } from "../utils";
import { commonParseMail } from "../common";

export const check_if_junk_mail = async (
    env: Bindings, address: string,
    raw_mail: string, message_id: string | null
): Promise<boolean> => {
    if (!getBooleanValue(env.ENABLE_CHECK_JUNK_MAIL)) {
        return false;
    }
    const parsedEmail = await commonParseMail(raw_mail);
    if (!parsedEmail?.headers) return false;

    const forcePassList = getStringArray(env.JUNK_MAIL_FORCE_PASS_LIST);
    const passedList: string[] = [];

    const headers = parsedEmail.headers;
    for (const header of headers) {
        if (!header["key"]) continue;
        if (!header["value"]) continue;

        // check spf
        if (header["key"].toLowerCase() == "received-spf") {
            if (!header["value"].toLowerCase().includes("pass")) {
                return true;
            }
            passedList.push("spf");
        }

        // check dkim and dmarc
        if (header["key"].toLowerCase() == "authentication-results") {
            if (header["value"].toLowerCase().includes("dkim=")) {
                if (!header["value"].toLowerCase().includes("dkim=pass")) {
                    return true;
                }
                passedList.push("dkim");
            }
            if (header["value"].toLowerCase().includes("dmarc=")) {
                if (!header["value"].toLowerCase().includes("dmarc=pass")) {
                    return true;
                }
                passedList.push("dmarc");
            }
        }
    }

    if (forcePassList?.length == 0) return false;

    // check force pass list
    return forcePassList.some(
        (checkName) => !passedList.includes(checkName.toLowerCase())
    );
}
