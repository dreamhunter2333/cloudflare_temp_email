export type FilterExpression = {
    operator: string;
    children?: FilterExpression[];
    field?: string;
    value?: string;
    options?: Record<string, unknown>;
};

export type FilterValues = Record<string, string | string[]>;
export type FilterOperator = (value: string, options: Record<string, unknown>) => (input: string) => boolean;

const textOperator = (match: (input: string, value: string) => boolean, caseSensitive = false): FilterOperator => (value, options) => {
    if (Object.keys(options).length) throw new Error('Text operators do not accept options');
    const expected = caseSensitive ? value : value.toLowerCase();
    return input => match(caseSensitive ? input : input.toLowerCase(), expected);
};

export const filterOperators: Record<string, FilterOperator> = {
    equals: textOperator((input, value) => input === value),
    equalsCaseSensitive: textOperator((input, value) => input === value, true),
    contains: textOperator((input, value) => input.includes(value)),
    containsCaseSensitive: textOperator((input, value) => input.includes(value), true),
    startsWith: textOperator((input, value) => input.startsWith(value)),
    startsWithCaseSensitive: textOperator((input, value) => input.startsWith(value), true),
    endsWith: textOperator((input, value) => input.endsWith(value)),
    endsWithCaseSensitive: textOperator((input, value) => input.endsWith(value), true),
    regex: (value, options) => {
        const flags = options.flags ?? '';
        if (Object.keys(options).some(key => key !== 'flags') || typeof flags !== 'string'
            || !/^[ims]*$/.test(flags) || new Set(flags).size !== flags.length) {
            throw new Error('Invalid regex flags (use i, m, s)');
        }
        const expression = new RegExp(value, flags);
        return input => expression.test(input);
    },
};

// Compile and validate the whole tree before evaluating (including short-circuited branches).
export function compileFilter(
    expression: unknown,
    isFieldAllowed: (field: string) => boolean,
    operators: Record<string, FilterOperator> = filterOperators,
): (values: FilterValues) => boolean {
    if (expression === undefined || expression === null) return () => true;
    let nodes = 0;
    const fields = new Set<string>();
    const compile = (input: unknown, depth: number, path: string): ((values: FilterValues) => boolean) => {
        if (++nodes > 100 || depth > 8) throw new Error(`${path}: Filter exceeds 100 nodes or 8 levels`);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${path}: Invalid condition`);
        const node = input as FilterExpression;
        if (typeof node.operator !== 'string') throw new Error(`${path}: Operator is required`);
        if (['and', 'or', 'not'].includes(node.operator)) {
            if (Object.keys(node).some(key => !['operator', 'children'].includes(key))
                || !Array.isArray(node.children)
                || node.children.length !== (node.operator === 'not' ? 1 : 2)) {
                throw new Error(`${path}: Invalid ${node.operator} children`);
            }
            const children = node.children.map((child, index) => compile(child, depth + 1, `${path}.children[${index}]`));
            if (node.operator === 'and') return values => children[0](values) && children[1](values);
            if (node.operator === 'or') return values => children[0](values) || children[1](values);
            return values => !children[0](values);
        }
        if (Object.keys(node).some(key => !['operator', 'field', 'value', 'options'].includes(key))
            || typeof node.field !== 'string' || node.field.length > 100 || !isFieldAllowed(node.field)
            || typeof node.value !== 'string' || node.value.length > 500
            || !Object.hasOwn(operators, node.operator)
            || (node.options !== undefined && (!node.options || typeof node.options !== 'object' || Array.isArray(node.options)))) {
            throw new Error(`${path}: Invalid field, operator, value or options`);
        }
        const field = node.field;
        fields.add(field);
        try {
            const match = operators[node.operator](node.value, node.options || {});
            return values => {
                const value = values[field];
                return Array.isArray(value) ? value.some(match) : match(value);
            };
        } catch {
            throw new Error(`${path}: Invalid ${node.operator} value or options`);
        }
    };
    const match = compile(expression, 1, 'filter');
    return values => {
        // A missing/failed field is not false: NOT must never turn a data error into a match.
        for (const field of fields) {
            const value = Object.hasOwn(values, field) ? values[field] : undefined;
            if (typeof value !== 'string' && !(Array.isArray(value) && value.every(item => typeof item === 'string'))) {
                throw new Error(`Unavailable filter field: ${field}`);
            }
        }
        return match(values);
    };
}
