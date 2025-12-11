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
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "mails",
            autoCleanupSetting.cleanMailsDays
        );
    }
    if (autoCleanupSetting.enableUnknowMailsAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "mails_unknow",
            autoCleanupSetting.cleanUnknowMailsDays
        );
    }
    if (autoCleanupSetting.enableSendBoxAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "sendbox",
            autoCleanupSetting.cleanSendBoxDays
        );
    }
    if (autoCleanupSetting.enableInactiveAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "inactiveAddress",
            autoCleanupSetting.cleanInactiveAddressDays
        );
    }
    if (autoCleanupSetting.enableAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "addressCreated",
            autoCleanupSetting.cleanAddressDays
        );
    }
    if (autoCleanupSetting.enableUnboundAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "unboundAddress",
            autoCleanupSetting.cleanUnboundAddressDays
        );
    }
    if (autoCleanupSetting.enableEmptyAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "emptyAddress",
            autoCleanupSetting.cleanEmptyAddressDays
        );
    }
    // Execute custom SQL cleanup tasks
    if (autoCleanupSetting.customSqlCleanupList && autoCleanupSetting.customSqlCleanupList.length > 0) {
        for (const customSql of autoCleanupSetting.customSqlCleanupList) {
            if (customSql.enabled && customSql.sql) {
                const result = await executeCustomSqlCleanup(
                    { env: env, } as Context<HonoCustomType>,
                    customSql
                );
                if (!result.success) {
                    console.error(`Custom SQL cleanup [${customSql.name}] failed: ${result.error}`);
                }
            }
        }
    }
}
