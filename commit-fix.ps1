#!/usr/bin/env pwsh
cd c:\Users\aduse\Desktop\Code\KudiSave
git add pages/ docs/
$status = git commit -m @"
fix: PWA header overlap - remove display:contents from mtn-header-spacer

PROBLEM: .mtn-header-spacer had display:contents which removes the element 
from layout, causing page content to hide under the fixed header.

SOLUTION: 
- Replaced display:contents with display:block
- Changed from calc() height to fixed pixel values
- Removed problematic body padding-top overrides
- Content now flows naturally below the spacer div

FILES MODIFIED: 16 pages across pages/ and docs/ directories

SPACER HEIGHTS PER PAGE:
  310px: Dashboard, Goals, Expenses, Subscriptions
  280px: Settings
  245px: Bills, Achievements  
  260px: Challenges
  160px: Reports

RESULT: Buttons and content no longer hidden under header in PWA standalone mode
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Commit successful"
    git log -1 --oneline
} else {
    Write-Host "✗ Commit failed"
    exit 1
}
