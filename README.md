
# Baseline Compatibility Dashboard

[![Baseline Compatibility](https://github.com/Blackgroundmc34/Baseline-Tooling-Hackathon/actions/workflows/baseline.yml/badge.svg)](https://github.com/Blackgroundmc34/Baseline-Tooling-Hackathon/actions/workflows/baseline.yml)
**Live demo:** https://blackgroundmc34.github.io/Baseline-Tooling-Hackathon/

## Baseline Compatibility Dashboard

**Scan → Enrich → Report → Gate.**  
Find web features used in your codebase, compute **Baseline** status (per subfeature), render an accessible report, and fail PRs when risk exceeds policy.

### Quick start
```bash
cd packages/scanner
npm run scan:full
# open packages/scanner/report.html

## Quick Start

**Live demo:** https://blackgroundmc34.github.io/Baseline-Tooling-Hackathon/

### Requirements
- Node.js **v20+**
- Git Bash/Terminal

---

### 1) Run a scan locally (30 seconds)

```bash
# from repo root
npm --prefix packages/scanner run build
node packages/scanner/dist/cli.js .
# outputs to: baseline-compat-report/
# open the HTML:
#   Windows (Git Bash):
explorer baseline-compat-report\report.html
#   macOS:
# open baseline-compat-report/report.html

