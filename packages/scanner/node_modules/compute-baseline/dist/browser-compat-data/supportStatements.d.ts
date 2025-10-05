import { FlagStatement, SimpleSupportStatement } from "@mdn/browser-compat-data";
import { Browser } from "./browser.js";
import { Feature } from "./feature.js";
import { Release } from "./release.js";
export interface Qualifications {
    prefix?: string;
    alternative_name?: string;
    flags?: FlagStatement[];
    partial_implementation?: true;
}
export type Supported = {
    supported: true;
    qualifications?: Qualifications;
};
export type Unsupported = {
    supported: false;
};
export type UnknownSupport = {
    supported: null;
};
export declare class SupportStatement {
    data: SimpleSupportStatement;
    browser: Browser | undefined;
    feature: Feature | undefined;
    constructor(data: SimpleSupportStatement, browser?: Browser, feature?: Feature);
    /**
     * An array of `FlagStatement` objects. If there are no flags, then the array
     * is empty.
     */
    get flags(): FlagStatement[];
    /**
     * A `true` value when evidence of support exists, such an API exposure, but
     * its behavior is irregular (for example, by deviating from the
     * specification). Otherwise, `false`.
     */
    get partial_implementation(): boolean;
    /**
     * A version string for the first supporting release. If the feature was never
     * supported, then it is `false`.
     */
    get version_added(): string | false;
    /**
     * A version string for the first unsupporting release after `version_added`.
     * If the feature is still supported, then it is `undefined`.
     */
    get version_removed(): string | undefined;
    supportedInDetails(release: Release): Supported | Unsupported | UnknownSupport;
    supportedBy(): {
        release: Release;
        qualifications?: Qualifications;
    }[];
}
