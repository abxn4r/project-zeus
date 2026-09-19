# CONTRIBUTING.md - Engineering Standards & Guidelines

Welcome to the **Project Zeus** infrastructure codebase. As a senior infrastructure project, all scripts and documentation must adhere to high standards of reliability, maintainability, and security.

---

## 📜 Shell Coding Conventions

All infrastructure scripts in this repository must adhere to the following POSIX shell guidelines:

### 1. POSIX Shell Compatibility
- Use `#!/system/bin/sh` or `#!/bin/sh`.
- Do **NOT** use bashisms (e.g. `[[ ... ]]`, `function foo()`, `${var//search/replace}`, or arrays) unless the script explicitly mandates `/bin/bash` in its shebang.
- Verify syntax using `sh -n <script.sh>` prior to committing.

### 2. Error Handling & Defensive Scripting
- Set defensive flags where appropriate: `set -e` or explicitly check command exit status (`$?`).
- Quote all variables to prevent word splitting: `"$VAR"` instead of `$VAR`.
- Explicitly set `PATH` at the top of boot scripts:
  ```sh
  export PATH="/data/local/server/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"
  ```

### 3. Modular Function Design
- Group logic into clear functions.
- Keep function names lower_snake_case (e.g., `check_network()`, `acquire_wakelock()`).
- Always use local variables within functions if supported, or clear variables after use.

### 4. Logging & Diagnostics
- Never silently fail. Print informative logs using standardized log helpers:
  ```sh
  log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
  log_warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
  log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*"; }
  ```

---

## 📝 Documentation Maintenance

Whenever making changes to system behavior, boot scripts, or services:
1. Update `docs/PROJECT.md` if hardware/software state changes.
2. Update `docs/CHANGELOG.md` under `[Unreleased]` using Semantic Versioning principles.
3. Update `docs/TODO.md` when completing tasks or introducing new ones.
4. Document architectural tradeoffs in `docs/DECISIONS.md` if making structural changes.
