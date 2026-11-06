import { Context } from 'hono';
import { cleanup } from './common'
import { CONSTANTS } from './constants'
import { getJsonSetting } from './utils';
import { CleanupSettings } from './models';
import { executeCustomSqlCleanup } from './admin_api/cleanup_api';

export async function scheduled(event: ScheduledEvent, env: Bindings, ctx: any) {
    console.log("Scheduled event: ", event);
    const autoCleanupSetting = await getJsonSetting<CleanupSettings>(
        { env: env, } as Context<HonoCustomType>,
        CONSTANTS.AUTO_CLEANUP_KEY
    );
    if (!autoCleanupSetting) {
        console.log("No auto cleanup settings found, skipping cleanup.");
        return;
    }
    console.log("autoCleanupSetting:", JSON.stringify(autoCleanupSetting));
    if (autoCleanupSetting.enableMailsAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "mails",
                autoCleanupSetting.cleanMailsDays
            );
        } catch (error) {
            console.error("Cleanup [mails] failed:", error);
        }
    }
    if (autoCleanupSetting.enableUnknowMailsAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "mails_unknow",
                autoCleanupSetting.cleanUnknowMailsDays
            );
        } catch (error) {
            console.error("Cleanup [mails_unknow] failed:", error);
        }
    }
    if (autoCleanupSetting.enableSendBoxAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "sendbox",
                autoCleanupSetting.cleanSendBoxDays
            );
        } catch (error) {
            console.error("Cleanup [sendbox] failed:", error);
        }
    }
    if (autoCleanupSetting.enableInactiveAddressAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "inactiveAddress",
                autoCleanupSetting.cleanInactiveAddressDays
            );
        } catch (error) {
            console.error("Cleanup [inactiveAddress] failed:", error);
        }
    }
    if (autoCleanupSetting.enableAddressAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "addressCreated",
                autoCleanupSetting.cleanAddressDays
            );
        } catch (error) {
            console.error("Cleanup [addressCreated] failed:", error);
        }
    }
    if (autoCleanupSetting.enableUnboundAddressAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "unboundAddress",
                autoCleanupSetting.cleanUnboundAddressDays
            );
        } catch (error) {
            console.error("Cleanup [unboundAddress] failed:", error);
        }
    }
    if (autoCleanupSetting.enableEmptyAddressAutoCleanup) {
        try {
            await cleanup(
                { env: env, } as Context<HonoCustomType>,
                "emptyAddress",
                autoCleanupSetting.cleanEmptyAddressDays
            );
        } catch (error) {
            console.error("Cleanup [emptyAddress] failed:", error);
        }
    }
    // Execute custom SQL cleanup tasks
    if (autoCleanupSetting.customSqlCleanupList && autoCleanupSetting.customSqlCleanupList.length > 0) {
        for (const customSql of autoCleanupSetting.customSqlCleanupList) {
            if (customSql.enabled && customSql.sql) {
                try {
                    const result = await executeCustomSqlCleanup(
                        { env: env, } as Context<HonoCustomType>,
                        customSql
                    );
                    if (!result.success) {
                        console.error(`Custom SQL cleanup [${customSql.name}] failed: ${result.error}`);
                    }
                } catch (error) {
                    console.error(`Custom SQL cleanup [${customSql.name}] failed:`, error);
                }
            }
        }
    }
}
