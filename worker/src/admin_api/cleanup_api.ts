import { Context } from 'hono';

import { cleanup } from '../common';
import { CONSTANTS } from '../constants';
import { getJsonSetting, saveSetting } from '../utils';
import { CleanupSettings } from '../models';

export default {
    cleanup: async (c: Context<HonoCustomType>) => {
        const { cleanType, cleanDays } = await c.req.json();
        try {
            await cleanup(c, cleanType, cleanDays);
        } catch (error) {
            console.error(error);
            return c.text(`Failed to cleanup ${(error as Error).message}`, 500)
        }
        return c.json({ success: true })
    },
    getCleanup: async (c: Context<HonoCustomType>) => {
        const cleanupSetting = await getJsonSetting<CleanupSettings>(c, CONSTANTS.AUTO_CLEANUP_KEY);
        return c.json(cleanupSetting)
    },
    saveCleanup: async (c: Context<HonoCustomType>) => {
        const cleanupSetting = await c.req.json<CleanupSettings>();
        await saveSetting(c, CONSTANTS.AUTO_CLEANUP_KEY, JSON.stringify(cleanupSetting));
        return c.json({ success: true })
    }
}
