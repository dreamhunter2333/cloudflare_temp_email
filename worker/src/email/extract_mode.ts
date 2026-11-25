/**
 * Email extraction mode, configured by the `AI_EXTRACT_MODE` variable.
 *
 * - `local`: built-in rule-based extraction only; mail content is never sent
 *   to any AI model. This is the default when the variable is unset.
 * - `ai`: prefer Workers AI; when the AI allowlist misses, local code extraction
 *   still runs because it never sends mail content to AI.
 */
export const ExtractMode = {
    Local: 'local',
    Ai: 'ai',
} as const;

export type ExtractMode = typeof ExtractMode[keyof typeof ExtractMode];

/**
 * Resolve the configured extraction mode.
 *
 * @returns the mode, or null when the value is not a supported mode
 */
export function resolveExtractMode(value: unknown): ExtractMode | null {
    if (value === undefined || value === null) return ExtractMode.Local;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return ExtractMode.Local;
    if (normalized === ExtractMode.Local) return ExtractMode.Local;
    if (normalized === ExtractMode.Ai) return ExtractMode.Ai;
    return null;
}
