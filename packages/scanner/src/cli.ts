#!/usr/bin/env node
/**
 * baseline-compat CLI
 * Usage:
 *   npx baseline-compat [path-to-repo]
 *   node dist/cli.js [path-to-repo]
 *
 * It will:
 *   - run the scanner with the provided root (or default)
 *   - generate report.json/html/csv in a temp work dir
 *   - copy them into <target>/baseline-compat-report/
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function die(msg: string) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  // target repo path (defaults to two levels up from the CLI package location)
  const arg = process.argv.slice(2).find(a => !a.startsWith('-'));
  const targetRoot = arg
    ? path.resolve(process.cwd(), arg)
    : path.resolve(process.cwd(), '..', '..');

  if (!fs.existsSync(targetRoot)) die(`Target path not found: ${targetRoot}`);

  // temp work dir where index.js/report-html.js will write outputs
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'baseline-compat-'));

  // 1) run the compiled scanner with root param; cwd = temp dir
  {
    const res = spawnSync(
      process.execPath, // 'node'
      [path.join(__dirname, 'index.js'), targetRoot],
      { stdio: 'inherit', cwd: tmp }
    );
    if (res.status !== 0) die('Scan failed.');
  }

  // 2) build HTML/CSV in same temp dir
  {
    const res = spawnSync(
      process.execPath,
      [path.join(__dirname, 'report-html.js')],
      { stdio: 'inherit', cwd: tmp }
    );
    if (res.status !== 0) die('Report build failed.');
  }

  // 3) copy artifacts back to the target repo
  const outDir = path.join(targetRoot, 'baseline-compat-report');
  await fsp.mkdir(outDir, { recursive: true });
  for (const file of ['report.json', 'report.html', 'report.csv']) {
    const src = path.join(tmp, file);
    if (fs.existsSync(src)) {
      await fsp.copyFile(src, path.join(outDir, file));
    }
  }

  // 4) print the location
  console.log('');
  console.log('Baseline report written to:');
  console.log('  ' + outDir);
  console.log('Open:');
  console.log('  ' + path.join(outDir, 'report.html'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
