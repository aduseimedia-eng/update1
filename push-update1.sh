#!/bin/bash
cd "c:\Users\aduse\Desktop\Code\KudiSave"
echo "Step 1: Adding all changes..."
git add -A
echo "Step 2: Committing..."
git commit -m "fix: PWA header overlap"
echo "Step 3: Pushing to update1..."
git push https://github.com/aduseimedia-eng/update1.git main -f
echo "Done!"
