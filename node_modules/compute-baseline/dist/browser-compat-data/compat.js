import bcd from "@mdn/browser-compat-data" with { type: "json" };
import { browser, feature, query, walk } from "./index.js";
import { isIndexable, isMetaBlock } from "./typeUtils.js";
export class Compat {
    data;
    browsers;
    features;
    constructor(data = bcd) {
        this.data = data;
        this.browsers = new Map();
        this.features = new Map();
    }
    /**
     * Get the version string from @mdn/browser-compat-data's `__meta` object (or
     * `"unknown"` if unset).
     */
    get version() {
        if (isIndexable(this.data) && isMetaBlock(this.data.__meta)) {
            return this.data.__meta.version;
        }
        return "unknown";
    }
    query(path) {
        return query(path, this.data);
    }
    browser(id) {
        return browser(id, this);
    }
    feature(id) {
        return feature(id, this);
    }
    /**
     * Generate `Feature` objects by walking tree of features.
     *
     * Similar to the `traverse` command in mdn/browser-compat-data.
     *
     * @param {string[]} [entryPoints] An array of dotted paths to compat features (e.g., `css.properties.background-color`)
     */
    *walk(entryPoints) {
        if (!entryPoints) {
            entryPoints = Object.keys(this.data).filter((key) => !["__meta", "browsers"].includes(key));
        }
        for (const { path } of walk(entryPoints, this.data)) {
            yield this.feature(path);
        }
    }
}
export const defaultCompat = new Compat(bcd);
