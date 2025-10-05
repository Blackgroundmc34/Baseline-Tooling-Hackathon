#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2); // optional path + flags
// run: scan -> report -> threshold (no thresholds by default)
const r1 = spawnSync('node', ['-e', 'require("ts-node/register"); require("./src/index.ts")', ...args], { stdio: 'inherit' });
if (r1.status !== 0) process.exit(r1.status);
const r2 = spawnSync('node', ['-e', 'require("ts-node/register"); require("./src/report-html.ts")'], { stdio: 'inherit' });
if (r2.status !== 0) process.exit(r2.status);
console.log('Done. See report.html and report.csv');
