import assert from "assert";
import { Release } from "../browser-compat-data/release.js";
/**
 * Map browsers to the release that most-recently introduced support for the feature.
 */
export function support(feature, browsers) {
    const support = new Map();
    for (const b of browsers) {
        let lastInitial;
        let lastInitialBoundary = "";
        for (let index = b.current().releaseIndex; index >= 0; index--) {
            const release = b.releases[index];
            assert(release instanceof Release, `No index ${index} in ${b} releases`); // This shouldn't happen, but neither should off-by-one errors. 🫠
            const supported = feature.supportedIn(release);
            if (!lastInitial) {
                if ([false, null].includes(supported)) {
                    // First-iteration only: bail when the latest release does not support
                    // the feature.
                    break;
                }
                lastInitial = release;
                continue;
            }
            if (supported === null) {
                lastInitialBoundary = "≤";
                break;
            }
            if (supported === false) {
                lastInitialBoundary = "";
                break;
            }
            lastInitial = release;
        }
        if (!lastInitial) {
            support.set(b, undefined);
        }
        else {
            support.set(b, {
                release: lastInitial,
                ranged: lastInitialBoundary === "≤",
                text: `${lastInitialBoundary}${lastInitial.version}`,
            });
        }
    }
    return support;
}
/**
 * Returns a number indicating whether an `InitialSupport` object comes before
 * (negative), after (positive), in the same position (0) by sort order.
 */
export function compareInitialSupport(i1, i2) {
    if (i1.release.compare(i2.release) === 0) {
        if (i1.ranged && !i2.ranged) {
            return -1;
        }
        if (!i1.ranged && i2.ranged) {
            return 1;
        }
        return 0;
    }
    return i1.release.compare(i2.release);
}
