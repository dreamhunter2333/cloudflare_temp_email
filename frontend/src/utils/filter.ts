export type FilterExpression = {
    operator: string;
    children?: (FilterExpression | null)[];
    field?: string;
    value?: string;
    options?: Record<string, unknown>;
};

export type FilterField = { label: string; value: string };
export type FilterOperator = FilterField & {
    options?: { key: string; label: string; placeholder?: string }[];
};

export function isValidFilterExpression(
    input: unknown, operators: FilterOperator[], isFieldAllowed: (field: string) => boolean = () => true,
): boolean {
    if (input == null) return true;
    return isFilterExpression(input, node => {
        if (!isFieldAllowed(node.field!)) return false;
        const operator = operators.find(item => item.value === node.operator);
        if (!operator) return false;
        const options = node.options || {};
        if (Object.keys(options).some(key => !operator.options?.some(option => option.key === key))) return false;
        return true;
    });
}

export function isFilterExpression(input: unknown, checkCondition: (node: FilterExpression) => boolean = () => true): input is FilterExpression {
    let nodes = 0;
    const validate = (input: unknown, depth: number): boolean => {
        if (++nodes > 100 || depth > 8 || !input || typeof input !== 'object' || Array.isArray(input)) return false;
        const node = input as FilterExpression;
        if (typeof node.operator !== 'string') return false;
        if (['and', 'or', 'not'].includes(node.operator)) {
            return Object.keys(node).every(key => ['operator', 'children'].includes(key))
                && Array.isArray(node.children) && node.children.length === (node.operator === 'not' ? 1 : 2)
                && node.children.every(child => validate(child, depth + 1));
        }
        return Object.keys(node).every(key => ['field', 'operator', 'value', 'options'].includes(key))
            && typeof node.field === 'string' && typeof node.value === 'string'
            && node.field.length <= 100 && node.value.length <= 500
            && (node.options === undefined || !!node.options && typeof node.options === 'object' && !Array.isArray(node.options))
            && checkCondition(node);
    };
    try {
        return validate(input, 1);
    } catch {
        return false;
    }
}
