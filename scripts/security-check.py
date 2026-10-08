#!/usr/bin/env python3

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent

FAIL = []
WARN = []

# --------------------------------------------------
# Helpers
# --------------------------------------------------

def fail(msg):
    FAIL.append(msg)

def warn(msg):
    WARN.append(msg)

def run(cmd):
    try:
        return subprocess.run(
            cmd,
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False
        )
    except Exception as e:
        fail(f"Command gagal: {' '.join(cmd)} -> {e}")
        return None

# --------------------------------------------------
# 1. Git repository integrity
# --------------------------------------------------

if not (ROOT / ".git").is_dir():
    fail("Git repository tidak ditemukan.")

git = run(["git", "rev-parse", "--is-inside-work-tree"])
if not git or git.stdout.strip() != "true":
    fail("Repository Git tidak valid.")

# --------------------------------------------------
# 2. Dangerous / forbidden files
# --------------------------------------------------

tracked = run(["git", "ls-files"])
untracked = run(["git", "ls-files", "--others", "--exclude-standard"])

files = []

if tracked:
    files.extend(
        x for x in tracked.stdout.splitlines()
        if x.strip()
    )

if untracked:
    files.extend(
        x for x in untracked.stdout.splitlines()
        if x.strip()
    )

files = sorted(set(files))

# --------------------------------------------------
# 3. Secret / credential scan
# --------------------------------------------------

secret_patterns = [
    (r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
     "private key"),
    (r"\bghp_[A-Za-z0-9_]{20,}\b",
     "GitHub personal access token"),
    (r"\bgithub_pat_[A-Za-z0-9_]{20,}\b",
     "GitHub fine-grained token"),
    (r"\bAKIA[0-9A-Z]{16}\b",
     "AWS access key"),
    (r"\bBearer\s+[A-Za-z0-9._\-]{20,}\b",
     "Bearer token"),
    (r"\b(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*[\"'][^\"']{12,}[\"']",
     "API/token credential"),
]

if tracked:
    for file in files:
        path = ROOT / file

        if not path.is_file():
            continue

        try:
            data = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for pattern, description in secret_patterns:
            if re.search(pattern, data, re.IGNORECASE):
                fail(f"Potential {description} ditemukan di: {file}")

# --------------------------------------------------
# 4. Dangerous dynamic execution
# --------------------------------------------------

for file in files if tracked else []:
    path = ROOT / file

    if path.suffix.lower() not in {".js", ".html", ".css"}:
        continue

    try:
        data = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue

    dynamic_patterns = [
        (r"\beval\s*\(", "eval()"),
        (r"\bnew\s+Function\s*\(", "new Function()"),
    ]

    for pattern, description in dynamic_patterns:
        if re.search(pattern, data):
            fail(f"Dynamic execution {description} ditemukan di: {file}")

# --------------------------------------------------
# 5. Required project structure
# --------------------------------------------------

required_files = [
    "index.html",
    "style.css",
    "script.js",
    "pay.html",
    "ai.html",
    "engine.html",
    ".github/workflows/static.yml",
]

for file in required_files:
    if not (ROOT / file).is_file():
        fail(f"Required file hilang: {file}")

# --------------------------------------------------
# 6. GitHub Actions workflow guard
# --------------------------------------------------

workflow = ROOT / ".github/workflows/static.yml"

if workflow.is_file():
    data = workflow.read_text(encoding="utf-8", errors="ignore")

    required_workflow_parts = [
        "actions/checkout@v4",
        "actions/configure-pages@v5",
        "actions/upload-pages-artifact@v3",
        "actions/deploy-pages@v5",
        "permissions:",
        "contents: read",
        "pages: write",
        "id-token: write",
    ]

    for item in required_workflow_parts:
        if item not in data:
            fail(f"Workflow guard gagal: '{item}' tidak ditemukan.")

# --------------------------------------------------
# 7. Placeholder / accidental configuration scan
# --------------------------------------------------

placeholder_patterns = [
    r"example\.com",
    r"example\.org",
    r"localhost(?::\d+)?",
    r"127\.0\.0\.1",
]

for file in files if tracked else []:
    path = ROOT / file

    if path.suffix.lower() not in {
        ".html", ".css", ".js", ".json", ".yml", ".yaml", ".txt"
    }:
        continue

    try:
        data = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        continue

    for pattern in placeholder_patterns:
        if re.search(pattern, data, re.IGNORECASE):
            warn(f"Placeholder/config development ditemukan di: {file}")

# --------------------------------------------------
# 8. Current critical links
# --------------------------------------------------

checks = {
    "https://nexgo.pusatdigi.com/download": "NexGo download",
    "https://www.instagram.com/nexoranx_tech/": "Instagram Nexora",
}

for url, description in checks.items():
    found = False

    for file in files if tracked else []:
        path = ROOT / file

        if path.suffix.lower() not in {".html", ".css", ".js", ".json"}:
            continue

        try:
            data = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        if url in data:
            found = True
            break

    if not found:
        warn(f"Link {description} belum ditemukan: {url}")

# --------------------------------------------------
# 9. Unexpected large tracked files
# --------------------------------------------------

if tracked:
    for file in files:
        path = ROOT / file

        if path.is_file():
            size_mb = path.stat().st_size / (1024 * 1024)

            if size_mb > 10:
                warn(f"File besar (>10 MB): {file} ({size_mb:.2f} MB)")

# --------------------------------------------------
# Result
# --------------------------------------------------

print()
print("=" * 60)
print("NEXORA SECURITY CHECK v1")
print("=" * 60)

if WARN:
    print()
    print("WARN:")
    for item in WARN:
        print(f"  ! {item}")

if FAIL:
    print()
    print("FAIL:")
    for item in FAIL:
        print(f"  X {item}")

    print()
    print("SECURITY GATE: FAIL")
    print("DEPLOYMENT: BLOCKED")
    sys.exit(1)

print()
print("SECURITY CHECK: PASS")
print("SECURITY GATE: PASS")
print("DEPLOYMENT: NOT MODIFIED")
print("=" * 60)
