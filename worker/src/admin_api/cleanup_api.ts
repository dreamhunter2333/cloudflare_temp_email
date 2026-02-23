import { Context } from 'hono';

import { cleanup } from '../common';
import { CONSTANTS } from '../constants';
import { getJsonSetting, saveSetting } from '../utils';
import { CleanupSettings, CustomSqlCleanup } from '../models';
import i18n from '../i18n';
import { LocaleMessages } from '../i18n/type';

// SQL validation error types
type SqlValidationError = 'empty' | 'too_long' | 'not_delete' | 'multiple_statements' | 'has_comments';

// Normalize SQL: trim and remove trailing semicolon
const normalizeSql = (sql: string): string => {
    let normalized = sql.trim();
    if (normalized.endsWith(';')) {
        normalized = normalized.slice(0, -1).trim();
    }
    return normalized;
};

// Get error message from error type
const getValidationErrorMsg = (errorType: SqlValidationError, msgs: LocaleMessages): string => {
    switch (errorType) {
        case 'empty': return msgs.SqlEmptyMsg;
        case 'too_long': return msgs.SqlTooLongMsg;
        case 'not_delete': return msgs.SqlOnlyDeleteMsg;
        case 'multiple_statements': return msgs.SqlSingleStatementMsg;
        case 'has_comments': return msgs.SqlNoCommentsMsg;
    }
};

// Validate custom SQL cleanup statement
export const validateCustomSql = (sql: string): { valid: boolean; errorType?: SqlValidationError } => {
    if (!sql || !sql.trim()) {
        return { valid: false, errorType: 'empty' };
    }

    const trimmedSql = normalizeSql(sql);

    // Check SQL length (max 1000 characters)
    if (trimmedSql.length > 1000) {
        return { valid: false, errorType: 'too_long' };
    }

    const sqlUpper = trimmedSql.toUpperCase();

    // Only allow DELETE statements
    if (!sqlUpper.startsWith('DELETE ')) {
        return { valid: false, errorType: 'not_delete' };
    }

    // Only allow single statement (no semicolons after trimming)
    if (trimmedSql.includes(';')) {
        return { valid: false, errorType: 'multiple_statements' };
    }

    // Forbid SQL comments
    if (/--/.test(trimmedSql) || /\/\*/.test(trimmedSql)) {
        return { valid: false, errorType: 'has_comments' };
    }

    return { valid: true };
};

// Execute custom SQL cleanup
export const executeCustomSqlCleanup = async (
    c: Context<HonoCustomType>,
    customSql: CustomSqlCleanup
): Promise<{ success: boolean; rowsAffected?: number; error?: string }> => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!customSql || !customSql.sql) {
        return { success: false, error: msgs.InvalidCleanupConfigMsg };
    }

    const validation = validateCustomSql(customSql.sql);
    if (!validation.valid) {
        return { success: false, error: getValidationErrorMsg(validation.errorType!, msgs) };
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
        const msgs = i18n.getMessagesbyContext(c);
        const { cleanType, cleanDays } = await c.req.json();
        try {
            await cleanup(c, cleanType, cleanDays);
        } catch (error) {
            console.error(error);
            return c.text(`${msgs.OperationFailedMsg}: ${(error as Error).message}`, 500)
        }
        return c.json({ success: true })
    },
    getCleanup: async (c: Context<HonoCustomType>) => {
        const cleanupSetting = await getJsonSetting<CleanupSettings>(c, CONSTANTS.AUTO_CLEANUP_KEY);
        return c.json(cleanupSetting)
    },
    saveCleanup: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        const cleanupSetting = await c.req.json<CleanupSettings>();

        // Validate custom SQL cleanup list
        if (cleanupSetting.customSqlCleanupList && cleanupSetting.customSqlCleanupList.length > 0) {
            for (const customSql of cleanupSetting.customSqlCleanupList) {
                if (customSql.sql) {
                    const validation = validateCustomSql(customSql.sql);
                    if (!validation.valid) {
                        const errorMsg = getValidationErrorMsg(validation.errorType!, msgs);
                        return c.text(`[${customSql.name || 'unnamed'}]: ${errorMsg}`, 400);
                    }
                }
            }
        }

        await saveSetting(c, CONSTANTS.AUTO_CLEANUP_KEY, JSON.stringify(cleanupSetting));
        return c.json({ success: true })
    }
}
