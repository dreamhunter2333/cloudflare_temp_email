export type FilterExpression = {
    operator: string;
    children?: FilterExpression[];
    field?: string;
    value?: string;
    options?: Record<string, unknown>;
};

export type FilterField = { label: string; value: string };
export type FilterOperator = FilterField & {
    operator?: string;
    presetOptions?: Record<string, unknown>;
    options?: { key: string; label: string; type: 'text' | 'boolean'; placeholder?: string }[];
};

export function getFilterOperator(node: FilterExpression | null | undefined, operators: FilterOperator[]) {
    return operators.find(item => item.operator === node?.operator && item.presetOptions
        && Object.entries(item.presetOptions).every(([key, value]) => node?.options?.[key] === value))
        || operators.find(item => item.value === node?.operator);
}

export function isFilterExpression(input: unknown, depth = 1, budget = { nodes: 0 }): input is FilterExpression {
    if (++budget.nodes > 100 || depth > 8 || !input || typeof input !== 'object' || Array.isArray(input)) return false;
    const node = input as FilterExpression;
    if (typeof node.operator !== 'string') return false;
    if (['and', 'or', 'not'].includes(node.operator)) {
        return Object.keys(node).every(key => ['operator', 'children'].includes(key))
            && Array.isArray(node.children) && node.children.length > 0
            && (node.operator !== 'not' || node.children.length === 1)
            && node.children.every(child => isFilterExpression(child, depth + 1, budget));
    }
    return Object.keys(node).every(key => ['field', 'operator', 'value', 'options'].includes(key))
        && typeof node.field === 'string' && typeof node.value === 'string'
        && node.field.length <= 100 && node.value.length <= 500
        && (node.options === undefined || !!node.options && typeof node.options === 'object' && !Array.isArray(node.options));
}
