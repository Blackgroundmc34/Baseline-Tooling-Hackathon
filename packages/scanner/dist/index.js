"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// packages/scanner/src/index.ts
const fast_glob_1 = __importDefault(require("fast-glob"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const css_tree_1 = __importDefault(require("css-tree"));
const parse5_1 = __importDefault(require("parse5"));
const enrich_1 = require("./enrich");
function normalizeKeyword(value) {
    return value.trim().toLowerCase();
}
function pushDedup(items, seen, file, loc, property, bcdKey) {
    const key = `${file}@${loc}@${bcdKey}`;
    if (seen.has(key))
        return;
    seen.add(key);
    items.push({ file, loc, property: property ?? '', bcdKey });
}
async function scanCssFile(absFile, root) {
    const css = await promises_1.default.readFile(absFile, 'utf8');
    const ast = css_tree_1.default.parse(css, { positions: true });
    const items = [];
    const seen = new Set();
    css_tree_1.default.walk(ast, (node) => {
        // Declarations → property key + value-specific keys
        if (node.type === 'Declaration') {
            const prop = node.property.toLowerCase();
            const baseKey = `css.properties.${prop}`;
            const loc = node.loc?.start?.line ?? 0;
            const rel = node_path_1.default.relative(root, absFile).replace(/\\/g, '/');
            // base property
            pushDedup(items, seen, rel, loc, prop, baseKey);
            // value-specific
            try {
                if (node.value) {
                    const valueKeywords = new Set();
                    css_tree_1.default.walk(node.value, (v) => {
                        if (v.type === 'Identifier' || v.type === 'Keyword') {
                            const raw = v.name ?? v.value ?? '';
                            const kw = normalizeKeyword(raw);
                            if (kw)
                                valueKeywords.add(kw);
                        }
                    });
                    for (const kw of valueKeywords) {
                        pushDedup(items, seen, rel, loc, prop, `${baseKey}.${kw}`);
                    }
                }
            }
            catch { /* ignore */ }
        }
        // Minimal @rule coverage
        if (node.type === 'Atrule') {
            const loc = node.loc?.start?.line ?? 0;
            const name = node.name.toLowerCase();
            const rel = node_path_1.default.relative(root, absFile).replace(/\\/g, '/');
            if (name === 'container') {
                pushDedup(items, seen, rel, loc, null, 'css.at-rules.container');
            }
        }
    });
    return items;
}
function htmlTextPos(html, idx) {
    // Convert byte offset to 1-based line number for a rough `loc`
    // (parse5 doesn’t provide positions by default)
    const slice = html.slice(0, Math.max(0, idx));
    return slice.split(/\r\n|\r|\n/).length;
}
async function scanHtmlFile(absFile, root) {
    const html = await promises_1.default.readFile(absFile, 'utf8');
    // precise locations enabled here 👇
    const doc = parse5_1.default.parse(html, { sourceCodeLocationInfo: true });
    const items = [];
    const seen = new Set();
    const rel = node_path_1.default.relative(root, absFile).replace(/\\/g, '/');
    function locOf(node) {
        const loc = node.sourceCodeLocation;
        return loc?.startLine ?? 0; // 1-based line number
    }
    function visit(node) {
        if (node.nodeName && node.tagName) {
            const el = node;
            const tag = el.tagName.toLowerCase();
            const attrs = Object.fromEntries((el.attrs ?? []).map((a) => [a.name.toLowerCase(), a.value]));
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
            for (const c of node.childNodes)
                visit(c);
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
        ? node_path_1.default.resolve(process.cwd(), argRoot)
        : node_path_1.default.resolve(process.cwd(), '..', '..');
    const cssPatterns = ['**/*.css', '!**/node_modules/**', '!**/dist/**'];
    const htmlPatterns = ['**/*.html', '!**/node_modules/**', '!**/dist/**'];
    const cssFiles = await (0, fast_glob_1.default)(cssPatterns, { cwd: root, absolute: true, dot: false });
    const htmlFiles = noHtml ? [] : await (0, fast_glob_1.default)(htmlPatterns, { cwd: root, absolute: true, dot: false });
    const raw = [];
    for (const file of cssFiles) {
        try {
            const items = await scanCssFile(file, root);
            raw.push(...items);
        }
        catch (e) {
            console.warn('Failed to parse CSS', file, e);
        }
    }
    for (const file of htmlFiles) {
        try {
            const items = await scanHtmlFile(file, root);
            raw.push(...items);
        }
        catch (e) {
            console.warn('Failed to parse HTML', file, e);
        }
    }
    const enriched = await (0, enrich_1.enrich)(raw);
    const summary = {
        files: cssFiles.length + htmlFiles.length,
        declarations: raw.length,
        baseline: {
            high: enriched.filter((i) => i.baseline === 'high').length,
            low: enriched.filter((i) => i.baseline === 'low').length,
            none: enriched.filter((i) => i.baseline === false || i.baseline == null).length,
        },
    };
    // Sort by risk: none (0) → low (1) → high (2) → unknown (3), then file, then line
    const rank = (b) => (b === false ? 0 : b === 'low' ? 1 : b === 'high' ? 2 : 3);
    enriched.sort((a, b) => {
        const r = rank(a.baseline) - rank(b.baseline);
        if (r !== 0)
            return r;
        if (a.file !== b.file)
            return a.file.localeCompare(b.file);
        return (a.loc || 0) - (b.loc || 0);
    });
    const report = {
        scannedAt: new Date().toISOString(),
        root: root.replace(/\\/g, '/'),
        summary,
        items: enriched,
    };
    const outPath = node_path_1.default.join(process.cwd(), 'report.json');
    await promises_1.default.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Wrote report.json (root=${root}, files=${summary.files}, declarations=${summary.declarations})`);
    console.log(`  Baseline: high=${summary.baseline.high} low=${summary.baseline.low} none=${summary.baseline.none}`);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
