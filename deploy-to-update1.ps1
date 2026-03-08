#!/usr/bin/env pwsh
Set-Location "c:\Users\aduse\Desktop\Code\KudiSave"

# Add all changes
git add -A
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to add files"; exit 1 }

# Commit
git commit -m "fix: PWA header overlap - remove display:contents spacer layout issue"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to commit"; exit 1 }

# Show the commit
git log -1 --oneline

# Push to update1
Write-Host "Pushing to update1..."
git push https://github.com/aduseimedia-eng/update1.git main --force
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ SUCCESSFULLY PUSHED TO GITHUB PAGES"
    Write-Host "📱 Live at: https://aduseimedia-eng.github.io/update1/"
} else {
    Write-Host "✗ Push failed"
    exit 1
}
