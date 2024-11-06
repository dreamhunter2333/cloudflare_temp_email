import { Bindings } from "../types";
import { getBooleanValue } from "../utils";
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
    const headers = parsedEmail.headers;
    for (const header of headers) {
        if (!header["key"]) continue;
        if (!header["value"]) continue;

        // check spf
        if (header["key"].toLowerCase() == "received-spf"
            &&
            !header["value"].toLowerCase().includes("pass")
        ) {
            return true;
        }

        // check dkim and dmarc
        if (header["key"].toLowerCase() == "authentication-results") {
            if (header["value"].toLowerCase().includes("dkim=")
                &&
                !header["value"].toLowerCase().includes("dkim=pass")
            ) {
                return true;
            }
            if (header["value"].toLowerCase().includes("dmarc=")
                &&
                !header["value"].toLowerCase().includes("dmarc=pass")
            ) {
                return true;
            }
        }
    }
    return false;
}
