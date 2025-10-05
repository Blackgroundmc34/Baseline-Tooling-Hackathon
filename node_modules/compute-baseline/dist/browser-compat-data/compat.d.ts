import { Browser, Feature } from "./index.js";
export declare class Compat {
    data: unknown;
    browsers: Map<string, Browser>;
    features: Map<string, Feature>;
    constructor(data?: unknown);
    /**
     * Get the version string from @mdn/browser-compat-data's `__meta` object (or
     * `"unknown"` if unset).
     */
    get version(): string;
    query(path: string): unknown;
    browser(id: string): Browser;
    feature(id: string): Feature;
    /**
     * Generate `Feature` objects by walking tree of features.
     *
     * Similar to the `traverse` command in mdn/browser-compat-data.
     *
     * @param {string[]} [entryPoints] An array of dotted paths to compat features (e.g., `css.properties.background-color`)
     */
    walk(entryPoints?: string[]): Generator<Feature>;
}
export declare const defaultCompat: Compat;
