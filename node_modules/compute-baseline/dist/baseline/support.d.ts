import { Browser } from "../browser-compat-data/browser.js";
import { Feature } from "../browser-compat-data/feature.js";
import { Release } from "../browser-compat-data/release.js";
export interface InitialSupport {
    release: Release;
    ranged: boolean;
    text: string;
}
export type SupportMap = Map<Browser, InitialSupport | undefined>;
/**
 * Map browsers to the release that most-recently introduced support for the feature.
 */
export declare function support(feature: Feature, browsers: Browser[]): SupportMap;
/**
 * Returns a number indicating whether an `InitialSupport` object comes before
 * (negative), after (positive), in the same position (0) by sort order.
 */
export declare function compareInitialSupport(i1: InitialSupport, i2: InitialSupport): number;
