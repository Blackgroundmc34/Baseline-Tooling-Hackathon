import { Temporal } from "@js-temporal/polyfill";
import { Browser } from "../browser-compat-data/browser.js";
import { Compat } from "../browser-compat-data/compat.js";
import { InitialSupport } from "./support.js";
export { identifiers as coreBrowserSet } from "./core-browser-set.js";
export { parseRangedDateString } from "./date-utils.js";
interface Logger {
    debug?: typeof console.debug;
    info?: typeof console.info;
    log?: typeof console.log;
    warn?: typeof console.warn;
}
export declare let logger: Logger | undefined;
export declare function setLogger(logFacility: Logger | undefined): void;
export declare const BASELINE_LOW_TO_HIGH_DURATION: Temporal.Duration;
type BaselineStatus = "low" | "high" | false;
type BaselineDate = string | null;
interface SupportDetails {
    compatKey?: string;
    baseline: BaselineStatus;
    baseline_low_date: BaselineDate;
    baseline_high_date: BaselineDate;
    discouraged: boolean;
    support: Map<Browser, InitialSupport | undefined>;
    toJSON: () => string;
}
interface SupportStatus {
    baseline: "low" | "high" | false;
    baseline_low_date: string;
    baseline_high_date?: string;
    support: Record<string, string>;
}
/**
 * Calculate a Baseline status for specific browser compat data keys within a
 * web-features feature, in the style of a web-feature's `status` key. Use this
 * method to calculate fine-grained support statuses. This is the only method
 * approved to compute Baseline statuses not otherwise published in the
 * `web-features` package.
 *
 * For example, suppose you want to show a Baseline status for a specific method
 * in a feature, which might've been supported earlier or later than the broader
 * feature overall. Then you'd call `getStatus('example-feature',
 * 'api.ExampleManager.doExample')`.
 */
export declare function getStatus(featureId: string, compatKey: string, compat?: Compat): SupportStatus;
/**
 * Given a set of compat keys, compute the aggregate Baseline support ("high",
 * "low" or false, dates, and releases) for those keys.
 */
export declare function computeBaseline(featureSelector: {
    compatKeys: [string, ...string[]];
    checkAncestors?: boolean;
}, compat?: Compat): SupportDetails;
/**
 * Given several dates, find the most-recent date and determine the
 * corresponding Baseline status and high and low dates.
 */
export declare function keystoneDateToStatus(dateSpec: string | null, cutoffDate: Temporal.PlainDate, discouraged: boolean): {
    baseline: BaselineStatus;
    baseline_low_date: BaselineDate;
    baseline_high_date: BaselineDate;
};
