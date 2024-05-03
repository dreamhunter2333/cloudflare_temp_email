import { cleanup } from '../common';
import { CONSTANTS } from '../constants';
import { getJsonSetting, saveSetting } from '../utils';

export default {
    cleanup: async (c) => {
        const { cleanType, cleanDays } = await c.req.json();
        try {
            await cleanup(c, cleanType, cleanDays);
        } catch (error) {
            console.error(error);
            return c.text(`Failed to cleanup ${error.message}`, 500)
        }
        return c.json({ success: true })
    },
    getCleanup: async (c) => {
        const value = await getJsonSetting(c, CONSTANTS.AUTO_CLEANUP_KEY);
        return c.json(value || {})
    },
    saveCleanup: async (c) => {
        const value = await c.req.json();
        await saveSetting(c, CONSTANTS.AUTO_CLEANUP_KEY, JSON.stringify(value));
        return c.json({ success: true })
    }
}
