// packages/scanner/src/report-html.ts
import fs from 'node:fs/promises';
import path from 'node:path';

type Item = {
  file: string;
  loc: number;
  bcdKey: string;
  property?: string;
  featureName?: string;
  baseline?: 'high' | 'low' | false;
  mdn_url?: string;
  advice?: string;
};

type Report = {
  scannedAt: string;
  root: string;
  summary: { files: number; declarations: number; baseline: { high: number; low: number; none: number } };
  items: Item[];
};

function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
}

function badge(b: Item['baseline']) {
  if (b === 'high') return '<span aria-label="Widely Baseline" title="Widely Baseline" class="b hi">Widely</span>';
  if (b === 'low') return '<span aria-label="Newly Baseline" title="Newly Baseline" class="b lo">Newly</span>';
  if (b === false) return '<span aria-label="Not in Baseline" title="Not in Baseline" class="b no">Not in</span>';
  return '<span aria-label="Unknown" title="Unknown" class="b un">Unknown</span>';
}

function toCSV(items: Item[]) {
  const header = ['file','loc','bcdKey','featureName','baseline','mdn','advice'];
  const rows = items.map(i => [
    i.file, i.loc, i.bcdKey, i.featureName ?? '', i.baseline ?? '', i.mdn_url ?? '', (i.advice ?? '').replace(/\s+/g,' ')
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}

async function main() {
  const src = path.resolve(process.cwd(), 'report.json');
  const dstHtml = path.resolve(process.cwd(), 'report.html');
  const dstCsv = path.resolve(process.cwd(), 'report.csv');

  const report: Report = JSON.parse(await fs.readFile(src, 'utf8'));

  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Baseline Compatibility Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Helvetica,Arial,sans-serif;margin:1.5rem}
h1{font-size:1.3rem;margin:0 0 .5rem}
.grid{display:grid;gap:.75rem}
sum{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin:.25rem 0 1rem}
.badges{display:flex;gap:.5rem}
.b{display:inline-block;padding:.15rem .4rem;border-radius:.5rem;font-size:.8rem;border:1px solid #ccc}
.b.hi{background:#eefbe7}
.b.lo{background:#fff8e1}
.b.no{background:#fdecea}
.b.un{background:#eef2f7}
table{border-collapse:collapse;width:100%}
caption{text-align:left;font-weight:600;margin:.25rem 0}
th,td{border:1px solid #ddd;padding:.5rem;vertical-align:top}
th{background:#f7f7f7}
code{background:#f5f5f5;padding:.1rem .25rem;border-radius:.25rem}
.actions{margin:.5rem 0 1rem;display:flex;gap:.5rem}
button{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #bbb;background:#fff;cursor:pointer}
button:hover{background:#f2f2f2}
</style>
<h1>Baseline Compatibility Report</h1>
<sum role="group" aria-label="Summary">
  <div><strong>Scanned:</strong> ${esc(new Date(report.scannedAt).toLocaleString())}</div>
  <div><strong>Root:</strong> <code>${esc(report.root)}</code></div>
  <div class="badges" aria-label="Baseline summary">
    <span class="b hi">Widely: ${report.summary.baseline.high}</span>
    <span class="b lo">Newly: ${report.summary.baseline.low}</span>
    <span class="b no">Not in: ${report.summary.baseline.none}</span>
  </div>
</sum>
<div class="actions">
  <a download="report.csv" href="report.csv"><button type="button">Download CSV</button></a>
</div>
<table>
  <caption>Findings (sorted by risk)</caption>
  <thead>
    <tr>
      <th scope="col">Baseline</th>
      <th scope="col">File</th>
      <th scope="col">Line</th>
      <th scope="col">Feature</th>
      <th scope="col">BCD Key</th>
      <th scope="col">Docs</th>
      <th scope="col">Advice</th>
    </tr>
  </thead>
  <tbody>
    ${report.items.map(i => `
      <tr>
        <td>${badge(i.baseline)}</td>
        <td><code>${esc(i.file)}</code></td>
        <td>${i.loc ?? ''}</td>
        <td>${esc(i.featureName ?? '')}</td>
        <td><code>${esc(i.bcdKey)}</code></td>
        <td>${i.mdn_url ? `<a href="${esc(i.mdn_url)}" target="_blank" rel="noopener">MDN</a>` : ''}</td>
        <td>${esc(i.advice ?? '')}</td>
      </tr>`).join('')}
  </tbody>
</table>
</html>`;

  await fs.writeFile(dstHtml, html, 'utf8');
  await fs.writeFile(dstCsv, toCSV(report.items), 'utf8');
  console.log(`Wrote ${path.basename(dstHtml)} and ${path.basename(dstCsv)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
