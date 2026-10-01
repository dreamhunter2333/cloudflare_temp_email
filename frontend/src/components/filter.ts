import { RE2JS } from 're2js';

export type FilterExpression = {
    operator: string;
    children?: FilterExpression[];
    field?: string;
    value?: string;
    options?: Record<string, unknown>;
};

export type FilterField = { label: string; value: string };
export type FilterOperator = FilterField & {
    options?: { key: string; label: string; placeholder?: string }[];
    validate?: (value: string, options: Record<string, unknown>) => void;
};

export function validateRegex(value: string, options: Record<string, unknown>) {
    const flags = options.flags ?? '';
    if (typeof flags !== 'string' || !/^[ims]*$/.test(flags) || new Set(flags).size !== flags.length) {
        throw new Error('Invalid regex flags');
    }
    RE2JS.compile(value,
        (flags.includes('i') ? RE2JS.CASE_INSENSITIVE : 0)
        | (flags.includes('m') ? RE2JS.MULTILINE : 0)
        | (flags.includes('s') ? RE2JS.DOTALL : 0));
}

export function isValidFilterExpression(
    input: unknown, operators: FilterOperator[], isFieldAllowed: (field: string) => boolean = () => true,
): boolean {
    if (input == null) return true;
    if (!isFilterExpression(input)) return false;
    const validate = (node: FilterExpression): boolean => {
        if (node.children) return node.children.every(validate);
        if (!isFieldAllowed(node.field!)) return false;
        const operator = operators.find(item => item.value === node.operator);
        if (!operator) return false;
        const options = node.options || {};
        if (Object.keys(options).some(key => !operator.options?.some(option => option.key === key))) return false;
        operator.validate?.(node.value!, options);
        return true;
    };
    try {
        return validate(input);
    } catch {
        return false;
    }
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
