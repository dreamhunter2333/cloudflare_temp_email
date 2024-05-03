import { cleanup } from './common'
import { CONSTANTS } from './constants'
import { getJsonSetting } from './utils';

export async function scheduled(event, env, ctx) {
    console.log("Scheduled event: ", event);
    let autoCleanupSetting = await getJsonSetting(
        { env: env, },
        CONSTANTS.AUTO_CLEANUP_KEY
    );
    console.log("autoCleanupSetting:", JSON.stringify(autoCleanupSetting));
    autoCleanupSetting = autoCleanupSetting || {};
    if (autoCleanupSetting.enableMailsAutoCleanup && autoCleanupSetting.cleanMailsDays > 0) {
        await cleanup(
            { env: env, },
            "mails",
            autoCleanupSetting.cleanMailsDays
        );
    }
    if (autoCleanupSetting.enableUnknowMailsAutoCleanup && autoCleanupSetting.cleanUnknowMailsDays > 0) {
        await cleanup(
            { env: env, },
            "mails_unknow",
            autoCleanupSetting.cleanUnknowMailsDays
        );
    }
    if (autoCleanupSetting.enableAddressAutoCleanup && autoCleanupSetting.cleanAddressDays > 0) {
        await cleanup(
            { env: env, },
            "address",
            autoCleanupSetting.cleanAddressDays
        );
    }
    if (autoCleanupSetting.enableSendBoxAutoCleanup && autoCleanupSetting.cleanSendBoxDays > 0) {
        await cleanup(
            { env: env, },
            "sendbox",
            autoCleanupSetting.cleanSendBoxDays
        );
    }
}
