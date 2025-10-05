"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrich = enrich;
// web-features: canonical feature list (editorial Baseline)
const web_features_1 = require("web-features");
// BCD full tree
const browser_compat_data_1 = __importDefault(require("@mdn/browser-compat-data"));
// compute-baseline: precise per-BCD-key baseline (subfeature level)
const compute_baseline_1 = require("compute-baseline");
// Build a map of BCD key -> featureId to quickly jump from usage to web-features entry.
const bcdToFeature = (() => {
    const map = {};
    for (const [featureId, f] of Object.entries(web_features_1.features)) {
        const keys = f.compat_features;
        if (!keys)
            continue;
        for (const k of keys)
            map[k] = { featureId, name: f.name };
    }
    return map;
})();
// Safe path getter for BCD by "css.properties.display" etc.
function getBcdByKey(key) {
    const parts = key.split('.');
    let cur = browser_compat_data_1.default;
    for (const p of parts) {
        if (cur && p in cur)
            cur = cur[p];
        else
            return undefined;
    }
    return cur;
}
function mdnUrlForKey(key) {
    const entry = getBcdByKey(key);
    const url = entry?.__compat?.mdn_url;
    return typeof url === 'string' ? url : undefined;
}
function defaultAdvice(baseline, key) {
    if (baseline === false) {
        return `Feature is not in Baseline. Consider a fallback or feature detect before using (${key}).`;
    }
    if (baseline === 'low') {
        return `Newly Baseline. Some older browsers may break; add a fallback or progressive enhancement where feasible.`;
    }
    if (baseline === 'high') {
        return `Widely Baseline. Generally safe; still test on your supported browsers.`;
    }
    return `No Baseline info found; review MDN and test before relying on it.`;
}
async function enrich(items) {
    const out = [];
    for (const it of items) {
        const mapped = bcdToFeature[it.bcdKey];
        let baseline;
        let lowDate;
        let highDate;
        let support;
        try {
            // compute-baseline can derive precise status directly from the BCD key
            const res = await (0, compute_baseline_1.getStatus)(mapped?.featureId ?? '', it.bcdKey);
            baseline = res?.baseline;
            // Dates come back as ISO strings when known
            lowDate = res?.baseline_low_date;
            highDate = res?.baseline_high_date;
            support = res?.support; // per-browser version map (when provided)
        }
        catch {
            // Swallow API shape/version differences; we’ll still output feature/MDN data
        }
        const mdn_url = mdnUrlForKey(it.bcdKey);
        const advice = defaultAdvice(baseline ?? false, it.bcdKey);
        out.push({
            ...it,
            featureId: mapped?.featureId,
            featureName: mapped?.name,
            baseline,
            baseline_low_date: lowDate,
            baseline_high_date: highDate,
            support,
            mdn_url,
            advice,
        });
    }
    return out;
}
