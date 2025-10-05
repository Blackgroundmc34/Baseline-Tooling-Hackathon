"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fast_glob_1 = __importDefault(require("fast-glob"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const css_tree_1 = __importDefault(require("css-tree"));
const parse5_1 = __importDefault(require("parse5"));
const enrich_1 = require("./enrich");
const IGNORE_GLOBS = [
    '**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/out/**',
    '**/.next/**', '**/.vercel/**', '**/coverage/**', '**/storybook-static/**',
    '**/*.min.*', '**/*.map', '**/*bundle*.{js,css}', '**/vendor/**'
];
const MAX_CSS_HTML_BYTES = 512 * 1024; // 512 KB cap for CSS/HTML
const MAX_JS_BYTES = 350 * 1024; // 350 KB cap for JS
function normRel(root, abs) {
    return node_path_1.default.relative(root, abs).replace(/\\/g, '/');
}
function keyDecl(file, loc, bcdKey) {
    return `${file}#${loc}:${bcdKey}`;
}
function pushDedup(arr, seen, file, loc, property, bcdKey, featureName) {
    const k = keyDecl(file, loc, bcdKey);
    if (seen.has(k))
        return;
    seen.add(k);
    arr.push({ file, loc, property: property ?? undefined, bcdKey, ...(featureName ? { featureName } : {}) });
}
async function shouldSkip(absFile, maxBytes) {
    try {
        const st = await promises_1.default.stat(absFile);
        return st.size > maxBytes;
    }
    catch {
        return true;
    }
}
function countLinesUpTo(text, endIndex) {
    let count = 1;
    for (let i = 0; i < endIndex; i++) {
        if (text.charCodeAt(i) === 10)
            count++;
    }
    return count;
}
// ----------------- CSS -----------------
async function scanCssFile(absFile, root) {
    if (await shouldSkip(absFile, MAX_CSS_HTML_BYTES))
        return [];
    const css = await promises_1.default.readFile(absFile, 'utf8');
    const ast = css_tree_1.default.parse(css, { positions: true });
    const items = [];
    const seen = new Set();
    const rel = normRel(root, absFile);
    css_tree_1.default.walk(ast, (node) => {
        // Declarations (properties)
        if (node.type === 'Declaration') {
            const prop = String(node.property || '').toLowerCase();
            const loc = node.loc?.start?.line ?? 0;
            // property-level BCD key
            pushDedup(items, seen, rel, loc, prop, `css.properties.${prop}`, prop);
            // specific value mapping example: word-break:auto-phrase
            try {
                if (prop === 'word-break' && node.value) {
                    const val = css_tree_1.default.generate(node.value).toLowerCase().trim();
                    if (val.includes('auto-phrase')) {
                        pushDedup(items, seen, rel, loc, prop, 'css.properties.word-break.auto-phrase', 'word-break: auto-phrase');
                    }
                }
            }
            catch { /* ignore value parse/gen issues */ }
        }
        // @rules
        if (node.type === 'Atrule') {
            const loc = node.loc?.start?.line ?? 0;
            const name = String(node.name || '').toLowerCase();
            if (name === 'container')
                pushDedup(items, seen, rel, loc, null, 'css.at-rules.container', '@container');
            if (name === 'layer')
                pushDedup(items, seen, rel, loc, null, 'css.at-rules.layer', '@layer');
            if (name === 'starting-style')
                pushDedup(items, seen, rel, loc, null, 'css.at-rules.starting-style', '@starting-style');
        }
        // :has() selector
        if (node.type === 'PseudoClassSelector' && String(node.name || '').toLowerCase() === 'has') {
            const loc = node.loc?.start?.line ?? 0;
            pushDedup(items, seen, rel, loc, null, 'css.selectors.has', ':has()');
        }
    });
    return items;
}
// ----------------- HTML -----------------
async function scanHtmlFile(absFile, root) {
    if (await shouldSkip(absFile, MAX_CSS_HTML_BYTES))
        return [];
    const html = await promises_1.default.readFile(absFile, 'utf8');
    const doc = parse5_1.default.parse(html, { sourceCodeLocationInfo: true });
    const items = [];
    const seen = new Set();
    const rel = normRel(root, absFile);
    function locOf(node) {
        return node?.sourceCodeLocation?.startLine ?? 0; // 1-based line number
    }
    function visit(node) {
        if (node && node.tagName) {
            const el = node;
            const tag = String(el.tagName).toLowerCase();
            const attrs = Object.fromEntries((el.attrs ?? []).map((a) => [String(a.name).toLowerCase(), String(a.value)]));
            const line = locOf(el);
            // Element
            pushDedup(items, seen, rel, line, null, `html.elements.${tag}`, `<${tag}>`);
            // Global: popover attribute
            if ('popover' in attrs) {
                pushDedup(items, seen, rel, line, null, 'html.global_attributes.popover', 'popover attribute');
            }
            // input types
            if (tag === 'input' && 'type' in attrs) {
                const t = String(attrs['type']).trim().toLowerCase();
                if (t)
                    pushDedup(items, seen, rel, line, null, `html.elements.input.input-types.${t}`, `<input type="${t}">`);
            }
        }
        if (node && Array.isArray(node.childNodes)) {
            for (const c of node.childNodes)
                visit(c);
        }
    }
    visit(doc);
    return items;
}
// ----------------- JS (heuristics) -----------------
const JS_API_MAP = {
    // token/needle : BCD key
    'structuredClone(': 'api.structuredClone',
    'navigator.clipboard': 'api.Clipboard',
    'window.showOpenFilePicker': 'api.Window.showOpenFilePicker',
    'window.showSaveFilePicker': 'api.Window.showSaveFilePicker',
    'window.showDirectoryPicker': 'api.Window.showDirectoryPicker',
    'document.startViewTransition(': 'api.Document.startViewTransition',
    'navigator.serviceWorker': 'api.ServiceWorker',
    'window.Notification': 'api.Notification'
};
async function scanJsFile(absFile, root) {
    if (await shouldSkip(absFile, MAX_JS_BYTES))
        return [];
    const text = await promises_1.default.readFile(absFile, 'utf8');
    const rel = normRel(root, absFile);
    const items = [];
    const seen = new Set();
    for (const [needle, bcdKey] of Object.entries(JS_API_MAP)) {
        let idx = text.indexOf(needle);
        while (idx !== -1) {
            const line = countLinesUpTo(text, idx);
            pushDedup(items, seen, rel, line, null, bcdKey, needle.replace('(', ''));
            idx = text.indexOf(needle, idx + needle.length);
        }
    }
    return items;
}
// ----------------- Main -----------------
async function main() {
    // CLI: optional root path (default: repo root two levels up)
    const argRoot = process.argv[2];
    const root = argRoot ? node_path_1.default.resolve(process.cwd(), argRoot) : node_path_1.default.resolve(process.cwd(), '..', '..');
    // Discover files (ignore heavy paths)
    const cssFiles = await (0, fast_glob_1.default)(['**/*.css'], { cwd: root, absolute: true, dot: false, ignore: IGNORE_GLOBS });
    const htmlFiles = await (0, fast_glob_1.default)(['**/*.html', '**/*.htm'], { cwd: root, absolute: true, dot: false, ignore: IGNORE_GLOBS });
    const jsFiles = await (0, fast_glob_1.default)(['**/*.{js,jsx,ts,tsx,mjs,cjs}'], { cwd: root, absolute: true, dot: false, ignore: IGNORE_GLOBS });
    const raw = [];
    let fileCount = 0;
    for (const file of cssFiles) {
        try {
            raw.push(...(await scanCssFile(file, root)));
            fileCount++;
        }
        catch (e) {
            console.warn('Failed to parse CSS', file, e);
        }
    }
    for (const file of htmlFiles) {
        try {
            raw.push(...(await scanHtmlFile(file, root)));
            fileCount++;
        }
        catch (e) {
            console.warn('Failed to parse HTML', file, e);
        }
    }
    for (const file of jsFiles) {
        try {
            raw.push(...(await scanJsFile(file, root)));
            fileCount++;
        }
        catch (e) {
            console.warn('Failed to scan JS', file, e);
        }
    }
    const enriched = await (0, enrich_1.enrich)(raw);
    const summary = {
        files: fileCount,
        declarations: raw.length,
        baseline: {
            high: enriched.filter((i) => i.baseline === 'high').length,
            low: enriched.filter((i) => i.baseline === 'low').length,
            none: enriched.filter((i) => i.baseline === false || i.baseline == null).length
        }
    };
    const report = {
        scannedAt: new Date().toISOString(),
        root: root.replace(/\\/g, '/'),
        summary,
        items: enriched
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
