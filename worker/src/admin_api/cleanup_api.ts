import { Context } from 'hono';

import { cleanup } from '../common';
import { CONSTANTS } from '../constants';
import { getJsonSetting, saveSetting } from '../utils';
import { CleanupSettings, CustomSqlCleanup } from '../models';

// Normalize SQL: trim and remove trailing semicolon
const normalizeSql = (sql: string): string => {
    let normalized = sql.trim();
    if (normalized.endsWith(';')) {
        normalized = normalized.slice(0, -1).trim();
    }
    return normalized;
};

// Validate custom SQL cleanup statement
export const validateCustomSql = (sql: string): { valid: boolean; error?: string } => {
    if (!sql || !sql.trim()) {
        return { valid: false, error: "SQL statement is empty" };
    }

    const trimmedSql = normalizeSql(sql);

    // Check SQL length (max 1000 characters)
    if (trimmedSql.length > 1000) {
        return { valid: false, error: "SQL statement is too long (max 1000 characters)" };
    }

    const sqlUpper = trimmedSql.toUpperCase();

    // Only allow DELETE statements
    if (!sqlUpper.startsWith('DELETE ')) {
        return { valid: false, error: "Only DELETE statements are allowed" };
    }

    // Only allow single statement (no semicolons after trimming)
    if (trimmedSql.includes(';')) {
        return { valid: false, error: "Only single SQL statement is allowed" };
    }

    // Forbid SQL comments
    if (/--/.test(trimmedSql) || /\/\*/.test(trimmedSql)) {
        return { valid: false, error: "SQL comments are not allowed" };
    }

    return { valid: true };
};

// Execute custom SQL cleanup
export const executeCustomSqlCleanup = async (
    c: Context<HonoCustomType>,
    customSql: CustomSqlCleanup
): Promise<{ success: boolean; rowsAffected?: number; error?: string }> => {
    if (!customSql || !customSql.sql) {
        return { success: false, error: "Invalid custom SQL cleanup config" };
    }

    const validation = validateCustomSql(customSql.sql);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    const sql = normalizeSql(customSql.sql);

    try {
        console.log(`Executing custom SQL cleanup [${customSql.name}]: ${sql}`);
        const result = await c.env.DB.prepare(sql).run();
        const rowsAffected = result.meta?.changes ?? 0;
        console.log(`Custom SQL cleanup [${customSql.name}] completed, rows affected: ${rowsAffected}`);
        return { success: true, rowsAffected };
    } catch (error) {
        const errorMessage = (error as Error).message || "Unknown error";
        console.error(`Custom SQL cleanup [${customSql.name}] failed:`, errorMessage);
        return { success: false, error: errorMessage };
    }
};

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

        // Validate custom SQL cleanup list
        if (cleanupSetting.customSqlCleanupList && cleanupSetting.customSqlCleanupList.length > 0) {
            for (const customSql of cleanupSetting.customSqlCleanupList) {
                if (customSql.sql) {
                    const validation = validateCustomSql(customSql.sql);
                    if (!validation.valid) {
                        return c.text(`Invalid SQL [${customSql.name || 'unnamed'}]: ${validation.error}`, 400);
                    }
                }
            }
        }

        await saveSetting(c, CONSTANTS.AUTO_CLEANUP_KEY, JSON.stringify(cleanupSetting));
        return c.json({ success: true })
    }
}
