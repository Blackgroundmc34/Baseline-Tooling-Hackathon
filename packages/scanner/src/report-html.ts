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
  summary: {
    files: number;
    declarations: number;
    baseline: { high: number; low: number; none: number };
  };
  items: Item[];
};

function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function badge(b: Item['baseline']) {
  if (b === 'high') return '<span aria-label="Widely Baseline" title="Widely Baseline" class="b hi">Widely</span>';
  if (b === 'low') return '<span aria-label="Newly Baseline" title="Newly Baseline" class="b lo">Newly</span>';
  if (b === false) return '<span aria-label="Not in Baseline" title="Not in Baseline" class="b no">Not in</span>';
  return '<span aria-label="Unknown" title="Unknown" class="b un">Unknown</span>';
}

function toCSV(items: Item[]) {
  const header = ['file', 'loc', 'bcdKey', 'featureName', 'baseline', 'mdn', 'advice'];
  const rows = items.map((i) =>
    [i.file, i.loc, i.bcdKey, i.featureName ?? '', i.baseline ?? '', i.mdn_url ?? '', (i.advice ?? '').replace(/\s+/g, ' ')]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
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
:root{--bd:#ddd;--bg:#fff;--ink:#111;--muted:#666;--chip:#f7f7f7;--row:#fff;--row-alt:#fafafa}
@media (prefers-color-scheme: dark){
  :root{--bd:#3a3f45;--bg:#0f1419;--ink:#e6edf3;--muted:#9aa7b1;--chip:#1b222a;--row:#0f1419;--row-alt:#121820}
}
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Helvetica,Arial,sans-serif;margin:1.5rem;background:var(--bg);color:var(--ink)}
h1{font-size:1.35rem;margin:0 0 .5rem}
.grid{display:grid;gap:.75rem}
sum{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin:.25rem 0 1rem}
.badges{display:flex;gap:.5rem}
.b{display:inline-block;padding:.15rem .45rem;border-radius:.6rem;font-size:.8rem;border:1px solid var(--bd);background:var(--chip)}
.b.hi{box-shadow:0 0 0 999px #a1f0a31f inset}
.b.lo{box-shadow:0 0 0 999px #ffd6661f inset}
.b.no{box-shadow:0 0 0 999px #ff9aa21f inset}
.b.un{box-shadow:0 0 0 999px #9fb3c81f inset}
table{border-collapse:collapse;width:100%;background:var(--row)}
caption{text-align:left;font-weight:600;margin:.25rem 0}
th,td{border:1px solid var(--bd);padding:.5rem;vertical-align:top}
th{background:var(--chip);position:sticky;top:0;z-index:2}
tbody tr:nth-child(even){background:var(--row-alt)}
code{background:var(--chip);padding:.1rem .25rem;border-radius:.25rem}
.actions{margin:.5rem 0 1rem;display:flex;gap:.5rem;flex-wrap:wrap}
button,.btn{padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--bd);background:transparent;color:var(--ink);cursor:pointer;text-decoration:none}
button:hover,.btn:hover{background:var(--chip)}
.controls{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin:.25rem 0 1rem}
.controls label{display:flex;gap:.35rem;align-items:center}
input,select{padding:.35rem .5rem;border-radius:.35rem;border:1px solid var(--bd);background:transparent;color:var(--ink)}
tbody tr.risky td{border-top:2px solid #ff9aa2aa;border-bottom:2px solid #ff9aa2aa}
.small{color:var(--muted);font-size:.85rem}
th.sortable{cursor:pointer}
th.sortable:after{content:" ⬍";opacity:.5;font-weight:normal}
</style>

<h1>Baseline Compatibility Report</h1>
<sum role="group" aria-label="Summary">
  <div><strong>Scanned:</strong> ${esc(new Date(report.scannedAt).toLocaleString())}</div>
  <div><strong>Root:</strong> <code>${esc(report.root)}</code></div>
  <div class="badges" aria-label="Baseline summary">
    <span class="b hi" title="Widely Baseline">Widely: ${report.summary.baseline.high}</span>
    <span class="b lo" title="Newly Baseline">Newly: ${report.summary.baseline.low}</span>
    <span class="b no" title="Not in Baseline">Not in: ${report.summary.baseline.none}</span>
  </div>
</sum>

<div class="actions">
  <a download="report.csv" class="btn" href="report.csv">Download CSV</a>
</div>

<div class="controls" id="filters">
  <label>Baseline:
    <select id="fBase" aria-label="Filter by Baseline">
      <option value="">All</option>
      <option value="widely">Widely</option>
      <option value="newly">Newly</option>
      <option value="not in">Not in</option>
    </select>
  </label>
  <label>File contains: <input id="fFile" placeholder="e.g. app.css" aria-label="Filter by file"/></label>
  <label>Key contains: <input id="fKey" placeholder="e.g. word-break" aria-label="Filter by BCD key"/></label>
  <label><input type="checkbox" id="fRisky"/> Show risky only</label>
  <span class="small" id="matchCount"></span>
</div>

<table id="data">
  <caption>Findings (sorted by risk)</caption>
  <thead>
    <tr>
      <th scope="col" class="sortable" data-col="baseline">Baseline</th>
      <th scope="col" class="sortable" data-col="file">File</th>
      <th scope="col" class="sortable" data-col="line">Line</th>
      <th scope="col" class="sortable" data-col="feature">Feature</th>
      <th scope="col" class="sortable" data-col="key">BCD Key</th>
      <th scope="col">Docs</th>
      <th scope="col">Advice</th>
    </tr>
  </thead>
  <tbody>
    ${report.items
      .map((i) => {
        const risky = i.baseline === false || i.baseline === 'low';
        return `
      <tr class="${risky ? 'risky' : ''}">
        <td data-base="${i.baseline === 'high' ? 'widely' : i.baseline === 'low' ? 'newly' : i.baseline === false ? 'not in' : 'unknown'}">${badge(i.baseline)}</td>
        <td data-file="${esc(i.file).toLowerCase()}"><code>${esc(i.file)}</code></td>
        <td data-line="${i.loc ?? ''}">${i.loc ?? ''}</td>
        <td data-feature="${esc(i.featureName ?? '').toLowerCase()}">${esc(i.featureName ?? '')}</td>
        <td data-key="${esc(i.bcdKey).toLowerCase()}"><code>${esc(i.bcdKey)}</code></td>
        <td>${i.mdn_url ? `<a href="${esc(i.mdn_url)}" target="_blank" rel="noopener">MDN</a>` : ''}</td>
        <td>${esc(i.advice ?? '')}</td>
      </tr>`;
      })
      .join('')}
  </tbody>
</table>

<script>
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const rows = $$('#data tbody tr');
  const fBase = $('#fBase');
  const fFile = $('#fFile');
  const fKey  = $('#fKey');
  const fRisky = $('#fRisky');
  const matchCount = $('#matchCount');

  function applyFilters(){
    const base = (fBase.value||'').toLowerCase();
    const file = (fFile.value||'').toLowerCase();
    const key  = (fKey.value||'').toLowerCase();
    let shown = 0;

    rows.forEach(tr=>{
      const b = tr.cells[0].getAttribute('data-base') || '';
      const f = tr.cells[1].getAttribute('data-file') || '';
      const k = tr.cells[4].getAttribute('data-key') || '';
      const risky = tr.classList.contains('risky');

      const okBase = !base || b.includes(base);
      const okFile = !file || f.includes(file);
      const okKey  = !key  || k.includes(key);
      const okRisk = !fRisky.checked || risky;

      const show = okBase && okFile && okKey && okRisk;
      tr.style.display = show ? '' : 'none';
      if (show) shown++;
    });

    matchCount.textContent = shown + ' / ' + rows.length + ' rows';
  }

  fBase.onchange = applyFilters;
  fFile.oninput = applyFilters;
  fKey.oninput  = applyFilters;
  fRisky.onchange = applyFilters;

  // column sort
  const rank = (txt) => txt.includes('not in') ? 0 : txt.includes('newly') ? 1 : txt.includes('widely') ? 2 : 3;
  let sortState = { col: 'baseline', dir: 1 };
  $$('#data thead th.sortable').forEach(th=>{
    th.addEventListener('click', ()=>{
      const col = th.getAttribute('data-col');
      sortState.dir = (sortState.col === col) ? -sortState.dir : 1;
      sortState.col = col;
      const tbody = $('#data tbody');
      const getVal = (tr) => {
        if (col==='baseline') return rank((tr.cells[0].innerText||'').toLowerCase());
        if (col==='file')     return (tr.cells[1].innerText||'').toLowerCase();
        if (col==='line')     return Number(tr.cells[2].innerText||0);
        if (col==='feature')  return (tr.cells[3].innerText||'').toLowerCase();
        if (col==='key')      return (tr.cells[4].innerText||'').toLowerCase();
        return tr.cells[0].innerText||'';
      };
      const sorted = rows.slice().sort((a,b)=>{
        const av=getVal(a), bv=getVal(b);
        if (av<bv) return -1*sortState.dir;
        if (av>bv) return  1*sortState.dir;
        return 0;
      });
      sorted.forEach(tr=>tbody.appendChild(tr));
      applyFilters();
    });
  });

  // initial filter state from URL (?base=not%20in&file=app.css)
  const params = new URLSearchParams(location.search);
  if (params.has('base')) fBase.value = params.get('base')!;
  if (params.has('file')) fFile.value = params.get('file')!;
  if (params.has('key'))  fKey.value  = params.get('key')!;
  if (params.get('risky') === '1') fRisky.checked = true;

  applyFilters();
</script>
</html>`;

  await fs.writeFile(dstHtml, html, 'utf8');
  await fs.writeFile(dstCsv, toCSV(report.items), 'utf8');
  console.log(`Wrote ${path.basename(dstHtml)} and ${path.basename(dstCsv)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
