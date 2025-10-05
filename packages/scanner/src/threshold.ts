import fs from 'node:fs/promises';
import path from 'node:path';

type Report = {
  summary: { baseline: { high: number; low: number; none: number } };
  items: Array<{ bcdKey: string; baseline?: 'high' | 'low' | false }>;
};

type AllowRule = { bcdKey: string; max: number; reason?: string };
type AllowFile = { rules: AllowRule[] };

(async () => {
  const p = path.resolve(process.cwd(), 'report.json');
  const rpt: Report = JSON.parse(await fs.readFile(p, 'utf8'));

  // thresholds
  const lowMax  = Number(process.env.MAX_LOW  ?? '9999');
  const noneMax = Number(process.env.MAX_NONE ?? '0');
  const hiMax   = Number(process.env.MAX_HIGH ?? '9999');

  // load allowlist (optional)
  let allows: AllowRule[] = [];
  try {
    const allowPath = path.resolve(process.cwd(), 'baseline-allow.json');
    const allow: AllowFile = JSON.parse(await fs.readFile(allowPath, 'utf8'));
    allows = allow.rules ?? [];
  } catch { /* no allowlist present */ }

  // Count actuals by baseline
  let high = 0, low = 0, none = 0;
  rpt.items.forEach(i => {
    if (i.baseline === 'high') high++;
    else if (i.baseline === 'low') low++;
    else none++;
  });

  // Apply allowlist: subtract permitted "none" occurrences per bcdKey
  if (allows.length) {
    const countsByKey = new Map<string, number>();
    for (const i of rpt.items) {
      const key = i.bcdKey;
      const kind = i.baseline;
      if (kind === false || kind == null) {
        countsByKey.set(key, (countsByKey.get(key) ?? 0) + 1);
      }
    }
    for (const rule of allows) {
      const used = countsByKey.get(rule.bcdKey) ?? 0;
      const forgiven = Math.min(used, rule.max);
      none -= forgiven;
    }
    if (none < 0) none = 0;
  }

  console.log(`Thresholds  -> MAX_HIGH=${hiMax} MAX_LOW=${lowMax} MAX_NONE=${noneMax}`);
  console.log(`Found (raw) -> high=${rpt.summary.baseline.high} low=${rpt.summary.baseline.low} none=${rpt.summary.baseline.none}`);
  console.log(`Found (eff) -> high=${high} low=${low} none=${none}  ${allows.length ? '(after allowlist)' : ''}`);

  const errors: string[] = [];
  if (low  > lowMax)  errors.push(`low (${low}) exceeds MAX_LOW (${lowMax})`);
  if (none > noneMax) errors.push(`none (${none}) exceeds MAX_NONE (${noneMax})`);
  if (high > hiMax)   errors.push(`high (${high}) exceeds MAX_HIGH (${hiMax})`);

  if (errors.length) {
    console.error('Baseline threshold failed:', errors.join('; '));
    process.exit(1);
  } else {
    console.log('Baseline threshold passed ✅');
  }
})();
