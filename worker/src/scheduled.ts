import { Context } from 'hono';
import { cleanup } from './common'
import { CONSTANTS } from './constants'
import { getJsonSetting } from './utils';
import { CleanupSettings } from './models';

export async function scheduled(event: ScheduledEvent, env: Bindings, ctx: any) {
    console.log("Scheduled event: ", event);
    const value = await getJsonSetting(
        { env: env, } as Context<HonoCustomType>,
        CONSTANTS.AUTO_CLEANUP_KEY
    );
    const autoCleanupSetting = new CleanupSettings(value);
    console.log("autoCleanupSetting:", JSON.stringify(autoCleanupSetting));
    if (autoCleanupSetting.enableMailsAutoCleanup && autoCleanupSetting.cleanMailsDays > 0) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "mails",
            autoCleanupSetting.cleanMailsDays
        );
    }
    if (autoCleanupSetting.enableUnknowMailsAutoCleanup && autoCleanupSetting.cleanUnknowMailsDays > 0) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "mails_unknow",
            autoCleanupSetting.cleanUnknowMailsDays
        );
    }
    if (autoCleanupSetting.enableSendBoxAutoCleanup && autoCleanupSetting.cleanSendBoxDays > 0) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "sendbox",
            autoCleanupSetting.cleanSendBoxDays
        );
    }
}
