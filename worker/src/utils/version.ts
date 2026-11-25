export const compareVersions = (left: string, right: string): number => {
    const [leftParts, rightParts] = [left, right].map(version => {
        const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
        if (!match) {
            throw new Error(`Invalid database version: ${version}`);
        }
        const parts = match.slice(1).map(Number);
        if (!parts.every(Number.isSafeInteger)) {
            throw new Error(`Invalid database version: ${version}`);
        }
        return parts;
    });

    for (let index = 0; index < 3; index++) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] < rightParts[index] ? -1 : 1;
        }
    }
    return 0;
};
