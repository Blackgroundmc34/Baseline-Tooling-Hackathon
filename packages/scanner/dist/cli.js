#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * baseline-compat CLI
 * Usage:
 *   node dist/cli.js [path-to-repo]
 *   (after linking) baseline-compat [path-to-repo]
 *
 * It will:
 *   - run the scanner with the provided root (or repo root default)
 *   - generate report.json/html/csv in a temp work dir
 *   - copy them into <target>/baseline-compat-report/
 */
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
function die(msg) {
    console.error(msg);
    process.exit(1);
}
async function main() {
    // target repo path (defaults to two levels up from the CLI package location)
    const arg = process.argv.slice(2).find((a) => !a.startsWith('-'));
    const targetRoot = arg
        ? node_path_1.default.resolve(process.cwd(), arg)
        : node_path_1.default.resolve(process.cwd(), '..', '..');
    if (!node_fs_1.default.existsSync(targetRoot))
        die(`Target path not found: ${targetRoot}`);
    // Work in a temporary directory to avoid touching the project during generation
    const tmp = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'baseline-compat-'));
    // 1) Run the compiled scanner (index.js) with more heap
    {
        const res = (0, node_child_process_1.spawnSync)(process.execPath, ['--max-old-space-size=4096', node_path_1.default.join(__dirname, 'index.js'), targetRoot], { stdio: 'inherit', cwd: tmp, env: { ...process.env } });
        if (res.status !== 0)
            die('Scan failed.');
    }
    // 2) Build the HTML/CSV (report-html.js)
    {
        const res = (0, node_child_process_1.spawnSync)(process.execPath, ['--max-old-space-size=2048', node_path_1.default.join(__dirname, 'report-html.js')], { stdio: 'inherit', cwd: tmp, env: { ...process.env } });
        if (res.status !== 0)
            die('Report build failed.');
    }
    // 3) Copy artifacts back to the target repo
    const outDir = node_path_1.default.join(targetRoot, 'baseline-compat-report');
    await promises_1.default.mkdir(outDir, { recursive: true });
    for (const file of ['report.json', 'report.html', 'report.csv']) {
        const src = node_path_1.default.join(tmp, file);
        if (node_fs_1.default.existsSync(src)) {
            await promises_1.default.copyFile(src, node_path_1.default.join(outDir, file));
        }
    }
    console.log('\nBaseline report written to:');
    console.log('  ' + outDir);
    console.log('Open:');
    console.log('  ' + node_path_1.default.join(outDir, 'report.html'));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
