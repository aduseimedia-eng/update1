/**
 * Fix encoding corruption in restored files.
 * Re-extracts files from git history using raw binary I/O
 * to avoid PowerShell's UTF-8 string mangling.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Source commit: parent of c14c11f (last commit WITH frontend/ folder intact)
const COMMIT = 'c14c11f^';

// Map: git path in that commit → local destination path
const FILE_MAP = [
  ['frontend/pages/dashboard.html',     'pages/dashboard.html'],
  ['frontend/pages/goals.html',         'pages/goals.html'],
  ['frontend/pages/expenses.html',      'pages/expenses.html'],
  ['frontend/pages/bills.html',         'pages/bills.html'],
  ['frontend/pages/reports.html',       'pages/reports.html'],
  ['frontend/pages/settings.html',      'pages/settings.html'],
  ['frontend/pages/achievements.html',  'pages/achievements.html'],
  ['frontend/pages/challenges.html',    'pages/challenges.html'],
  ['frontend/assets/css/style.css',     'pages/assets/css/style.css'],
  ['frontend/assets/js/dashboard.js',   'pages/assets/js/dashboard.js'],
  ['frontend/assets/js/api.js',         'pages/assets/js/api.js'],
  ['frontend/assets/js/config.js',      'pages/assets/js/config.js'],
];

let ok = 0, fail = 0;

for (const [gitPath, destPath] of FILE_MAP) {
  const result = spawnSync('git', ['show', `${COMMIT}:${gitPath}`], {
    encoding: 'buffer',   // raw bytes — no string conversion
    maxBuffer: 10 * 1024 * 1024,
    cwd: __dirname,       // make sure git runs from repo root
  });

  if (result.status !== 0 || !result.stdout || result.stdout.length === 0) {
    console.error(`FAIL: ${gitPath} — ${(result.stderr || '').toString().trim()}`);
    fail++;
    continue;
  }

  const fullDest = path.join(__dirname, destPath);
  fs.mkdirSync(path.dirname(fullDest), { recursive: true });
  fs.writeFileSync(fullDest, result.stdout); // write raw bytes directly
  console.log(`OK  : ${destPath} (${result.stdout.length} bytes)`);
  ok++;
}

console.log(`\nDone: ${ok} restored, ${fail} failed.`);
