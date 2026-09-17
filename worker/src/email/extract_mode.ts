/**
 * Email extraction mode, configured by the `AI_EXTRACT_MODE` variable.
 *
 * - `local`: built-in rule-based extraction only; mail content is never sent
 *   to any AI model. This is the default when the variable is unset.
 * - `ai`: Workers AI only; no local fallback when the binding is missing or
 *   the model call fails.
 */
export type ExtractMode = 'local' | 'ai';

/**
 * Resolve the configured extraction mode.
 *
 * @returns the mode, or null when the value is not a supported mode
 */
export function resolveExtractMode(value: unknown): ExtractMode | null {
    if (value === undefined || value === null) return 'local';
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return 'local';
    if (normalized === 'local' || normalized === 'ai') return normalized;
    return null;
}
