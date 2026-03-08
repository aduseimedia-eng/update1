@echo off
cd /d "c:\Users\aduse\Desktop\Code\KudiSave"
git add pages/ docs/ commit-fix.ps1 deploy-to-update1.ps1
git commit -m "fix: PWA header overlap - remove display:contents and use proper block layout for mtn-header-spacer"
git log -1 --oneline
echo.
echo Pushing to GitHub Pages...
git push https://github.com/aduseimedia-eng/update1.git main --force
if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS - Deployed to https://aduseimedia-eng.github.io/update1/
) else (
    echo PUSH FAILED
    exit /b 1
)
