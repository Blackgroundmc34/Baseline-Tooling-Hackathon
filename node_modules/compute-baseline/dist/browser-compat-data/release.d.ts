import { Temporal } from "@js-temporal/polyfill";
import { ReleaseStatement } from "@mdn/browser-compat-data";
import { Browser } from "./browser.js";
export declare class Release {
    browser: Browser;
    version: string;
    data: ReleaseStatement;
    releaseIndex: number;
    constructor(browser: Browser, version: string, data: ReleaseStatement, index: number);
    toString(): string;
    get date(): Temporal.PlainDate | null;
    compare(otherRelease: Release): number;
    /**
     * Check if this release is the same as or after a starting release and,
     * optionally, before an ending release.
     */
    inRange(start: Release, end?: Release): boolean;
    isPrerelease(): boolean;
}
