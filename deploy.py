import subprocess
import sys
import os

os.chdir(r"c:\Users\aduse\Desktop\Code\KudiSave")

# Stage changes
print("Staging changes...")
subprocess.run(["git", "add", "pages/", "docs/"], check=True)

# Check what's staged
print("\nStaged files:")
subprocess.run(["git", "diff", "--cached", "--stat"], check=True)

# Commit
print("\nCommitting...")
result = subprocess.run([
    "git", "commit", "-m", 
    "fix: PWA header overlap - calc()+env() for safe area + display:block for layout"
], capture_output=True, text=True)
print(result.stdout)
if result.returncode != 0:
    print(result.stderr)

# Show commit
print("\nLatest commit:")
subprocess.run(["git", "log", "-1", "--oneline"], check=True)

# Push
print("\nPushing to update1...")
result = subprocess.run([
    "git", "push", 
    "https://github.com/aduseimedia-eng/update1.git", 
    "main"
], capture_output=True, text=True)
print(result.stdout)
if result.returncode != 0:
    print("STDERR:", result.stderr)
    sys.exit(1)

print("\n✓ Successfully deployed to https://aduseimedia-eng.github.io/update1/")
