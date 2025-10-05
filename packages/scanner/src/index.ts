// packages/scanner/src/index.ts
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import csstree from 'css-tree';
import parse5, { DefaultTreeDocument, DefaultTreeElement } from 'parse5';
import { enrich, type RawItem } from './enrich';

type Summary = {
  files: number;
  declarations: number;
  baseline: { high: number; low: number; none: number };
};

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

function pushDedup(
  items: RawItem[],
  seen: Set<string>,
  file: string,
  loc: number,
  property: string | null,
  bcdKey: string
) {
  const key = `${file}@${loc}@${bcdKey}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push({ file, loc, property: property ?? '', bcdKey });
}

async function scanCssFile(absFile: string, root: string): Promise<RawItem[]> {
  const css = await fs.readFile(absFile, 'utf8');
  const ast = csstree.parse(css, { positions: true });
  const items: RawItem[] = [];
  const seen = new Set<string>();

  csstree.walk(ast, (node) => {
    // Declarations → property key + value-specific keys
    if (node.type === 'Declaration') {
      const prop = node.property.toLowerCase();
      const baseKey = `css.properties.${prop}`;
      const loc = node.loc?.start?.line ?? 0;
      const rel = path.relative(root, absFile).replace(/\\/g, '/');

      // base property
      pushDedup(items, seen, rel, loc, prop, baseKey);

      // value-specific
      try {
        if (node.value) {
          const valueKeywords = new Set<string>();
          csstree.walk(node.value, (v) => {
            if (v.type === 'Identifier' || v.type === 'Keyword') {
              const raw = (v as any).name ?? (v as any).value ?? '';
              const kw = normalizeKeyword(raw);
              if (kw) valueKeywords.add(kw);
            }
          });
          for (const kw of valueKeywords) {
            pushDedup(items, seen, rel, loc, prop, `${baseKey}.${kw}`);
          }
        }
      } catch {/* ignore */}
    }

    // Minimal @rule coverage
    if (node.type === 'Atrule') {
      const loc = node.loc?.start?.line ?? 0;
      const name = node.name.toLowerCase();
      const rel = path.relative(root, absFile).replace(/\\/g, '/');
      if (name === 'container') {
        pushDedup(items, seen, rel, loc, null, 'css.at-rules.container');
      }
    }
  });

  return items;
}

function htmlTextPos(html: string, idx: number): number {
  // Convert byte offset to 1-based line number for a rough `loc`
  // (parse5 doesn’t provide positions by default)
  const slice = html.slice(0, Math.max(0, idx));
  return slice.split(/\r\n|\r|\n/).length;
}

async function scanHtmlFile(absFile: string, root: string): Promise<RawItem[]> {
  const html = await fs.readFile(absFile, 'utf8');

  // precise locations enabled here 👇
  const doc = parse5.parse(html, { sourceCodeLocationInfo: true }) as DefaultTreeDocument;

  const items: RawItem[] = [];
  const seen = new Set<string>();
  const rel = path.relative(root, absFile).replace(/\\/g, '/');

  function locOf(node: any): number {
    const loc = (node as any).sourceCodeLocation;
    return loc?.startLine ?? 0; // 1-based line number
  }

  function visit(node: any) {
    if (node.nodeName && node.tagName) {
      const el = node as DefaultTreeElement;
      const tag = el.tagName.toLowerCase();
      const attrs = Object.fromEntries(
        (el.attrs ?? []).map((a) => [a.name.toLowerCase(), a.value])
      );

      const line = locOf(el);

      // generic element key
      const elementKey = `html.elements.${tag}`;
      pushDedup(items, seen, rel, line, tag, elementKey);

      // dialog
      if (tag === 'dialog') {
        pushDedup(items, seen, rel, line, tag, 'html.elements.dialog');
      }

      // global popover attribute
      if ('popover' in attrs) {
        pushDedup(items, seen, rel, line, tag, 'html.global_attributes.popover');
      }

      // input types
      if (tag === 'input' && 'type' in attrs) {
        const t = normalizeKeyword(String(attrs['type']));
        if (t) {
          pushDedup(items, seen, rel, line, tag, `html.elements.input.input-types.${t}`);
        }
      }
    }

    if ('childNodes' in node && Array.isArray(node.childNodes)) {
      for (const c of node.childNodes) visit(c);
    }
  }

  visit(doc);
  return items;
}


async function main() {
  // CLI flags:
  // arg[0] = optional root path (defaults to repo root two levels up)
  // --no-html to skip HTML scanning
  const argv = process.argv.slice(2);
  const noHtml = argv.includes('--no-html');
  const argRoot = argv.find((a) => !a.startsWith('--'));
  const root = argRoot
    ? path.resolve(process.cwd(), argRoot)
    : path.resolve(process.cwd(), '..', '..');

  const cssPatterns = ['**/*.css', '!**/node_modules/**', '!**/dist/**'];
  const htmlPatterns = ['**/*.html', '!**/node_modules/**', '!**/dist/**'];

  const cssFiles = await fg(cssPatterns, { cwd: root, absolute: true, dot: false });
  const htmlFiles = noHtml ? [] : await fg(htmlPatterns, { cwd: root, absolute: true, dot: false });

  const raw: RawItem[] = [];

  for (const file of cssFiles) {
    try {
      const items = await scanCssFile(file, root);
      raw.push(...items);
    } catch (e) {
      console.warn('Failed to parse CSS', file, e);
    }
  }

  for (const file of htmlFiles) {
    try {
      const items = await scanHtmlFile(file, root);
      raw.push(...items);
    } catch (e) {
      console.warn('Failed to parse HTML', file, e);
    }
  }

  const enriched = await enrich(raw);

  const summary: Summary = {
    files: cssFiles.length + htmlFiles.length,
    declarations: raw.length,
    baseline: {
      high: enriched.filter((i) => i.baseline === 'high').length,
      low: enriched.filter((i) => i.baseline === 'low').length,
      none: enriched.filter((i) => i.baseline === false || i.baseline == null).length,
    },
  };

  // Sort by risk: none (0) → low (1) → high (2) → unknown (3), then file, then line
  const rank = (b: any) => (b === false ? 0 : b === 'low' ? 1 : b === 'high' ? 2 : 3);
  enriched.sort((a, b) => {
    const r = rank(a.baseline) - rank(b.baseline);
    if (r !== 0) return r;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return (a.loc || 0) - (b.loc || 0);
  });

  const report = {
    scannedAt: new Date().toISOString(),
    root: root.replace(/\\/g, '/'),
    summary,
    items: enriched,
  };

  const outPath = path.join(process.cwd(), 'report.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote report.json (root=${root}, files=${summary.files}, declarations=${summary.declarations})`);
  console.log(`  Baseline: high=${summary.baseline.high} low=${summary.baseline.low} none=${summary.baseline.none}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
