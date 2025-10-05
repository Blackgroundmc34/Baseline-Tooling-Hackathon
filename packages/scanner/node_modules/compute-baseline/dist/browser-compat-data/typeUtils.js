export function isIndexable(o) {
    if (typeof o === "object" && o !== null) {
        return true;
    }
    return false;
}
function hasKeys(o, expectedKeys) {
    return (isIndexable(o) && Object.keys(o).every((key) => expectedKeys.includes(key)));
}
// The root BCD object
export function isCompatData(o) {
    return (isIndexable(o) &&
        hasKeys(o, [
            "__meta",
            "browsers",
            "api",
            "css",
            "html",
            "http",
            "javascript",
            "mathml",
            "svg",
            "webassembly",
            "webdriver",
            "webextensions",
        ]));
}
export function isFeatureData(o) {
    return isIndexable(o) && !isBrowsers(o);
}
export function isBrowsers(o) {
    return (isIndexable(o) &&
        Object.keys(o).includes("chrome") &&
        Object.keys(o).includes("edge") &&
        Object.keys(o).includes("firefox") &&
        Object.keys(o).includes("safari"));
}
export function isBrowserStatement(o) {
    return hasKeys(o, ["name", "type", "releases"]);
}
export function isCompatStatement(o) {
    return hasKeys(o, ["support"]);
}
export function isMetaBlock(o) {
    return hasKeys(o, ["version", "timestamp"]);
}
