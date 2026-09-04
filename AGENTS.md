# AGENTS.md — URL Inspector & Multi-Checker

> Project-specific instructions for AI agents (and humans) working in this repo. Loaded via `opencode.json` `instructions`.

## 1. Project Overview

**URL Inspector & Multi-Checker** (`URL-checker` on GitHub: `gautham-websters/URL-checker`) replicates `curl -siL` + `hreflang` auditing for one or more URLs.

Dual delivery (same core logic):

- **Browser extension** (`extension/` — Manifest V3, primary, easiest) — one-click popup, no Python required.
- **Desktop GUI fallback** (`main.py` — single-file `tkinter`, 126 lines) — `python main.py`.

For each URL it reports:

1. **HTTP redirect hops & status codes** — `requests.Session.get(allow_redirects=True)` in Python; manual `fetch(redirect:'manual')` loop in extension.
2. **Final response headers** — dumped verbatim.
3. **hreflang tags** — `BeautifulSoup` parse (`main.py:92`) / `DOMParser` in extension (`background.js`).

Current state: `main` branch, Python 3.13 + Extension v1.0.0 MV3, `.github/workflows/release.yml` auto-creates releases.

## 2. Stack & Runtime

| Layer                  | Detail                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extension**          | Manifest V3 (`extension/manifest.json:1`), `popup.html/js/css` + `background.js` service worker, vanilla JS (no build, no bundler)                 |
| **Desktop**            | Python 3.13 (tested 3.13.13), `tkinter` + `ttk` (stdlib, needs display; headless CI fails on `Tk()`)                                               |
| Networking (desktop)   | `requests==2.34.2` (`urllib3==2.7.0`, `certifi`, `charset-normalizer`, `idna`)                                                                     |
| Networking (extension) | `fetch` with `host_permissions: <all_urls>`, `declarativeNetRequest` for User-Agent spoof, `AbortController` timeout 10s                           |
| HTML parsing           | Desktop: `beautifulsoup4==4.15.0` + `soupsieve==2.9.2`; Extension: `DOMParser`                                                                     |
| Concurrency            | Desktop: `threading.Thread(daemon=True)` + `root.after(0, ...)`; Extension: `async/await` + `chrome.runtime.sendMessage`                           |
| Env                    | local `.venv/` (ignored), `requirements.txt` pinned (desktop only)                                                                                 |
| OS                     | Developed on `win32` / PowerShell 5.1; paths assume Windows but code is cross-platform; extension is cross-browser (Chrome/Edge/Brave/Firefox MV3) |
| CI/CD                  | `.github/workflows/ci.yml` (validate manifest + JS syntax + py_compile), `.github/workflows/release.yml` (auto-release on `extension/**` push)     |

## 3. Repository Layout

```
URL/                             # worktree root
├── extension/                   # Browser extension — primary delivery
│   ├── manifest.json            # MV3, v1.0.0, <all_urls>, declarativeNetRequest, background.service_worker
│   ├── popup.html               # UI — textarea (one URL/line) + UA entry + Run/CurrentTab/Clear + tab bar
│   ├── popup.css                # Card layout, tab pills, dark code panel (780×560)
│   ├── popup.js                 # UI controller — mirrors URLInspectorApp.start_inspection/create_result_tab
│   ├── background.js            # Service worker — mirrors URLInspectorApp.process_single_url (hops/headers/hreflang)
│   ├── icons/icon{16,48,128}.png # Generated via Pillow, dark #0f172a + magnifier
│   └── README.md                # Extension install + architecture + troubleshooting
├── .github/workflows/
│   ├── release.yml              # Auto-release: manifest version → tag v<version> → zip → GitHub Release
│   └── ci.yml                   # Lint: jq manifest, node --check JS, py_compile
├── main.py                      # 126 lines, single class URLInspectorApp — desktop fallback
├── requirements.txt             # 9 pinned deps (desktop only)
├── README.md                    # Root overview + quick starts + release notes
├── .gitignore                   # Proper ignores: .venv/, __pycache__/, *.zip, .DS_Store (no longer ignores .git)
├── opencode.json                # opencode project config (this repo)
├── AGENTS.md                    # this file
└── .git/                        # origin https://github.com/friedavocadoes/URL-checker, branch main
```

No `pyproject.toml`/`setup.py`, no extension build step (vanilla MV3), no bundler.

## 4. How to Run / Setup

### Extension (recommended)

```powershell
# Load unpacked — no build
# Chrome/Edge: chrome://extensions → Developer mode → Load unpacked → select extension/
# Firefox: about:debugging → This Firefox → Load Temporary Add-on → extension/manifest.json

# Package for store / release (mirrors workflow)
Compress-Archive -Path extension\* -DestinationPath url-inspector-v1.0.0.zip -Force
# or: (cd extension && zip -r ../url-inspector-v1.0.0.zip . -x "*.DS_Store")
unzip -l url-inspector-v1.0.0.zip   # verify manifest at top level
```

Popup: 780px wide, `Target URLs` textarea (default `https://google.com`), `User-Agent` entry, `Run Inspection` + `Use Current Tab URL`, bottom tab bar + dark `<pre>` panel per URL. Output mirrors desktop exactly (=== sections).

### Desktop (fallback)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py                          # 1000×700 window
# smoke without GUI
python -m py_compile main.py; if ($?) { Write-Output "compile ok" }
python -c "import ast; ast.parse(open('main.py').read()); print('parse ok')"
```

## 5. Architecture

### Desktop — `main.py` (126 lines) — `class URLInspectorApp` — `main.py:7`

| Method                                   | Location      | Responsibility                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__init__(self, root)`                   | `main.py:8`   | Build UI: `input_frame` (Text + Run button), `opts_frame` (User-Agent), `notebook`                                                                                                                                                       |
| `start_inspection(self)`                 | `main.py:39`  | Parse URLs from `url_text`, validate non-empty, clear `notebook` tabs, disable button, spawn daemon thread                                                                                                                               |
| `inspect_urls(self, urls)`               | `main.py:54`  | Worker thread: normalize `http(s)://`, call `process_single_url`, schedule `create_result_tab` via `root.after(0, ...)`                                                                                                                  |
| `process_single_url(self, url, headers)` | `main.py:66`  | Core — `requests.Session().get(url, headers, allow_redirects=True, timeout=10)` → hops (`res.history`), headers, hreflang (`soup.find_all("link", rel=lambda x: x and "alternate" in x.lower())`); returns `"\n".join(out)`; catches all |
| `create_result_tab(self, url, content)`  | `main.py:110` | Main-thread UI: `ttk.Frame`, truncated label (`url[:25]+"..."`), `tk.Text(wrap="none")` + `ttk.Scrollbar`                                                                                                                                |

Data flow: `url_text` → `start_inspection` → `threading.Thread` → `inspect_urls` loop → `process_single_url` (blocking `requests`) → `root.after` → `create_result_tab`.

### Extension — MV3

| File              | Location                    | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`   | `extension/manifest.json:1` | MV3, `action.default_popup: popup.html`, `permissions: [storage, activeTab, scripting, declarativeNetRequest, declarativeNetRequestWithHostAccess]`, `host_permissions: ["<all_urls>"]`, `background.service_worker: background.js`                                                                                                                                                                                                                                                                                                                                                                                  |
| `popup.html`      | `extension/popup.html:1`    | Structure — header + input card (textarea, UA, Run/CurrentTab/Clear, #status) + results card (tabButtons + tabContents)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `popup.css`       | `extension/popup.css:1`     | Cards, tab pills, dark code panel; no framework                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `popup.js`        | `extension/popup.js:1`      | UI controller — mirrors `start_inspection`/`create_result_tab`: parses URLs, `chrome.storage.local` persist, `chrome.runtime.sendMessage({type:"INSPECT_URL", url, userAgent})` per URL sequentially, builds `tabsData[]`, `switchTab`, copy/export (clipboard + Blob download)                                                                                                                                                                                                                                                                                                                                      |
| `background.js`   | `extension/background.js:1` | Service worker — mirrors `process_single_url`: `processSingleUrl(url, userAgent)` with `MAX_REDIRECTS=10`, `FETCH_TIMEOUT_MS=10000`, `setUserAgentRule`/`clearUserAgentRule` via `chrome.declarativeNetRequest.updateDynamicRules` (id 1, `modifyHeaders` for `User-Agent`), manual `fetch(redirect:'manual')` loop resolving `Location` via `new URL(location, currentUrl)`, fallback for `opaqueredirect`/status 0 via `fetch(redirect:'follow')`, header dump via `headers.entries()`, hreflang via `DOMParser` + `querySelectorAll('link[rel][hreflang]')` filtered by `rel.toLowerCase().includes('alternate')` |
| `icons/icon*.png` | `extension/icons/`          | 16/48/128, Pillow-generated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Parity notes:

- Threading: `root.after` → `runtime.sendMessage` + `async/await`; both keep UI responsive.
- Redirects: `res.history` (`main.py:75-79`) → manual fetch loop (`background.js`); both cap at ~10 hops, `Location` fallback `"Unknown"` vs opaqueredirect note.
- hreflang: `soup.find_all(..., "alternate" in x.lower())` + `has_attr("hreflang")` → identical loose logic via `rel.toLowerCase().includes('alternate')`.
- Error surface: `try/except Exception → "ERROR fetching URL: ..."` → same string in `background.js` catch (AbortError → timeout note).
- UA spoofing: Python sets `headers={"User-Agent": ...}` directly; extension must use `declarativeNetRequest` session rule because `fetch` forbids `User-Agent` header — hint in `popup.html` explains this.

### GitHub Automation — `.github/workflows/release.yml`

Trigger: `push` to `main` when `extension/**` or workflow changes, `push` tags `v*`, `workflow_dispatch` (optional version override). Steps: `jq` read `extension/manifest.json:version` → validate MV3 + required files → `zip` `extension/` → check `git rev-parse v<version>` → `git tag -a` + push if missing + not tag push → `softprops/action-gh-release@v2` with `generate_release_notes: true` + body template + `files: url-inspector-v<version>.zip`.

## 6. Code Style & Conventions

- **Desktop:** Keep `main.py` single-file unless user explicitly asks to split. 4 spaces, `snake_case`/`CamelCase`, grouped imports (stdlib `tkinter`, `threading`; third-party `requests`, `bs4`), concise comments, double quotes + f-strings, swallow exceptions for UI stability (`main.py:105-106`).
- **Extension:** Vanilla JS, no bundler/transpiler/deps. Keep `extension/` flat (no `src/`). 2-space indent in JSON/CSS, 2 spaces in JS. `chrome.*` APIs only (no `browser.*` polyfill needed for Chrome/Edge; add if Firefox-specific bug). Don't add React/Vite/Webpack without asking.
- **Deps:** Stdlib + pinned `requirements.txt` only for desktop. Extension has zero npm deps; don't add `package.json` unless store packaging requires `web-ext`.
- **Versioning:** `extension/manifest.json:version` is source of truth (semver). Git tag is `v<version>`. Bump manifest before pushing to `main` to trigger release.

## 7. Common Tasks (for agents)

| Task                                 | How                                                                                                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bump extension version & release** | Edit `extension/manifest.json:4` `version`, `git add` + `commit -m "chore: bump extension to 1.0.1"` + `push` → workflow auto-tags `v1.0.1` and publishes Release with zip. Or `git tag v1.0.1 && git push origin v1.0.1`.                                 |
| **Add timeout/retry option**         | Desktop: `opts_frame` (`main.py:28-33`) + thread through `inspect_urls` → `process_single_url` `timeout=`. Extension: add `Spinbox` in `popup.html` opts-row, persist via `chrome.storage`, pass to `background.js` `processSingleUrl` `FETCH_TIMEOUT_MS`. |
| **Add export**                       | Desktop: button in `btn_frame` (`main.py:22-25`), iterate `notebook.tabs()`. Extension: already has `Copy`/`Export .txt` in `popup.js` (`copyActive`/`exportActive` + `exportAll` on Shift).                                                               |
| **Fix scrollbar**                    | Desktop: swap pack order in `create_result_tab:113-121` (scrollbar before text_area) — verify on Windows. Extension: CSS handles overflow in `.tab-contents`.                                                                                              |
| **Update icons**                     | `python -c "from PIL import Image..."` or replace `extension/icons/*.png`; keep 16/48/128; update `manifest.json` if paths change.                                                                                                                         |
| **Test extension locally**           | Chrome: `chrome://extensions` → Load unpacked `extension/` → inspect popup via right-click → Inspect, check Service Worker console at `chrome://extensions` → _Service worker_ link.                                                                       |
| **Add tests**                        | Desktop: `tests/` + `pytest` mock `requests.Session.get`. Extension: `node --check` already in `ci.yml`; add `web-ext lint` if needed.                                                                                                                     |

## 8. Verification & Testing

```powershell
# 1. Desktop parse & compile
python -m py_compile main.py; if ($?) { Write-Output "compile ok" }
python -c "import ast; tree=ast.parse(open('main.py').read()); print('classes:', [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)])"

# 2. Extension — validate manifest + JS + package (mirrors ci.yml)
jq empty extension/manifest.json
node --check extension/popup.js; node --check extension/background.js
Compress-Archive -Path extension\* -DestinationPath url-inspector-test.zip -Force; unzip -l url-inspector-test.zip

# 3. Full run — desktop (requires display)
python main.py
# Enter: https://example.com and https://httpbin.org/redirect/2 → Run Inspection → verify hops, headers, hreflang tabs

# 4. Full run — extension (requires Chrome/Edge)
# Load unpacked extension/ → open popup → same URLs → Run Inspection → verify hops, headers, hreflang tabs + Copy/Export + Use Current Tab

# 5. If adding pytest
pip install pytest; pytest -q
```

Network is live — mock in tests, don't hammer hosts, respect `timeout=10`. For extension, `host_permissions: <all_urls>` bypasses CORS but still hits live servers.

## 9. Permissions & Safety

- **Network:** `process_single_url` / `processSingleUrl` does outbound `GET` with user `User-Agent`. Don't auto-fetch arbitrary URLs without user intent.
- **Threading / async:** Desktop: never touch Tk widgets off main thread — use `root.after` (`main.py:62,64`). Extension: never do heavy fetch in popup — delegate to `background.js` via `runtime.sendMessage`; popup only manipulates DOM.
- **Extension permissions:** `declarativeNetRequest` is best-effort for UA spoof; `host_permissions: <all_urls>` is required for inspection but is sensitive — don't broaden. Context menu (`contextMenus`) is optional.
- **Filesystem:** Avoid temp files outside `C:\Users\webst\AppData\Local\Temp\opencode` unless task needs it; extension zips are `url-inspector-v*.zip` at repo root (ignored by `.gitignore`).
- **Secrets:** No secrets in repo. Don't commit `.venv/` or credentials in headers. `GITHUB_TOKEN` is auto-provided in workflows.

## 10. Git Conventions

- Remote: `origin https://github.com/friedavocadoes/URL-checker` — `main` tracks `origin/main`.
- Commits: `fix:` / `v1` / `chore: bump extension to ...` — concise, check `git log --oneline -10` before committing.
- `.gitignore` now properly ignores `.venv/`, `__pycache__/`, `*.zip` (old version incorrectly listed `.git` — fixed).
- Releases: `extension/manifest.json:version` → git tag `v<version>` → GitHub Release with zip. Workflow is authoritative — don't manually create releases with different zips without updating manifest.
- Before commit: `git status`, `git diff`, stage only intended files, never commit `.venv/` or zips.

## 11. opencode Integration

- Config: `opencode.json` at root with `"$schema": "https://opencode.ai/config.json"` and `instructions: ["AGENTS.md"]` so this file is auto-loaded. `watcher.ignore` covers `.venv/**`, `__pycache__/**`, `*.zip`, `web-ext-artifacts/**`.
- Config is loaded once at startup — **quit and restart opencode** after editing `opencode.json`, `AGENTS.md`, or anything under `.opencode/`.
- Escape hatches: `OPENCODE_DISABLE_PROJECT_CONFIG=1`, `OPENCODE_CONFIG=/path/to/file.json`, `OPENCODE_CONFIG_CONTENT='{"$schema":"https://opencode.ai/config.json"}'`.

## 12. What NOT to Do

- Don't split `main.py` into modules without explicit user request — desktop is intentionally single-file.
- Don't add bundler/framework (React, Vite, Webpack) to `extension/` without asking — MV3 is intentionally vanilla, no build step.
- Don't add `pyproject.toml`/`setup.py` unless packaging requested; don't add `package.json` unless `web-ext` or store tooling needs it.
- Don't add heavy Python web frameworks (Flask etc.) — desktop is `tkinter` (Flask appears in local `.venv` but is not used).
- Don't change `requirements.txt` pinned versions or `extension/manifest.json` permissions without verifying `requests`/`bs4`/`fetch`/`declarativeNetRequest` compatibility.
- Don't break parity between desktop and extension output format (`=== HTTP REDIRECT HOPS ... ===`, `=== FINAL RESPONSE HEADERS ===`, `=== HREFLANG TAGS FOUND ===`) — keep them identical.
- Don't use `bash` for file reads/writes — use `read`/`edit`/`write`; reserve `bash` for `git`, `pip`, `python`, `node`, `jq`, `zip`.
- Don't add emojis to code or `AGENTS.md` unless asked.
