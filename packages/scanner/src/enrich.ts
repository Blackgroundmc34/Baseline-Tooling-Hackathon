// packages/scanner/src/enrich.ts
import path from 'node:path';
import type { AnyNode } from 'css-tree';

// web-features: canonical feature list (editorial Baseline)
import { features } from 'web-features';

// BCD full tree
import bcd from '@mdn/browser-compat-data';

// compute-baseline: precise per-BCD-key baseline (subfeature level)
import { getStatus as getBaselineStatus } from 'compute-baseline';

export type RawItem = {
  file: string;
  loc: number;
  property: string;
  bcdKey: string;
};

export type EnrichedItem = RawItem & {
  featureId?: string;
  featureName?: string;
  baseline?: 'high' | 'low' | false;
  baseline_low_date?: string;
  baseline_high_date?: string;
  support?: Record<string, string | boolean>;
  mdn_url?: string;
  advice?: string;
};

// Build a map of BCD key -> featureId to quickly jump from usage to web-features entry.
const bcdToFeature: Record<string, { featureId: string; name: string }> = (() => {
  const map: Record<string, { featureId: string; name: string }> = {};
  for (const [featureId, f] of Object.entries(features)) {
    const keys = (f as any).compat_features as string[] | undefined;
    if (!keys) continue;
    for (const k of keys) map[k] = { featureId, name: (f as any).name };
  }
  return map;
})();

// Safe path getter for BCD by "css.properties.display" etc.
function getBcdByKey(key: string): any | undefined {
  const parts = key.split('.');
  let cur: any = bcd;
  for (const p of parts) {
    if (cur && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

function mdnUrlForKey(key: string): string | undefined {
  const entry = getBcdByKey(key);
  const url = entry?.__compat?.mdn_url;
  return typeof url === 'string' ? url : undefined;
}

function defaultAdvice(baseline: EnrichedItem['baseline'], key: string): string {
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

export async function enrich(items: RawItem[]): Promise<EnrichedItem[]> {
  const out: EnrichedItem[] = [];
  for (const it of items) {
    const mapped = bcdToFeature[it.bcdKey];
    let baseline: 'high' | 'low' | false | undefined;
    let lowDate: string | undefined;
    let highDate: string | undefined;
    let support: Record<string, string | boolean> | undefined;

    try {
      // compute-baseline can derive precise status directly from the BCD key
      const res = await getBaselineStatus(mapped?.featureId ?? '', it.bcdKey);
      baseline = res?.baseline as any;
      // Dates come back as ISO strings when known
      lowDate = res?.baseline_low_date;
      highDate = res?.baseline_high_date;
      support = res?.support; // per-browser version map (when provided)
    } catch {
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
