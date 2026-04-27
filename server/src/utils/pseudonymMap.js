/**
 * Creates a fresh pseudonym map per pipeline run.
 * Never use a module-level singleton — it leaks state across requests.
 */
export const createPseudonymMap = () => {
    const map = new Map();
    const counters = {};

    return {
        getPseudonym(value, type = "Entity") {
            const key = `${type}::${value}`;
            if (!map.has(key)) {
                counters[type] = (counters[type] || 0) + 1;
                map.set(key, `${type}_${counters[type]}`);
            }
            return map.get(key);
        },
        size() {
            return map.size;
        },
    };
};