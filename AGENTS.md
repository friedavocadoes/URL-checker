# AGENTS.md — URL Inspector & Multi-Checker

> Project-specific instructions for AI agents (and humans) working in this repo. Loaded via `opencode.json` `instructions`.

## 1. Project Overview

**URL Inspector & Multi-Checker** (`URL-checker` on GitHub: `gautham-websters/URL-checker`) is a single-file desktop GUI that replicates `curl -siL` + `hreflang` auditing for one or more URLs.

For each URL it reports:
1. **HTTP redirect hops & status codes** — `requests.Session.get(allow_redirects=True)` history walk.
2. **Final response headers** — dumped verbatim.
3. **hreflang tags** — `BeautifulSoup` parse for `<link rel="alternate" hreflang="...">`.

No CLI, no server, no build step — just `python main.py`.

Current state: `main` branch, 2 commits (`v1`, `fix: line issue`), clean working tree, Python 3.13.

## 2. Stack & Runtime

| Layer | Detail |
|-------|--------|
| Language | Python 3.13 (tested on 3.13.13) |
| GUI | `tkinter` + `ttk` (stdlib, no install needed) — requires a display; headless CI will fail on `Tk()` |
| Networking | `requests==2.34.2` (`urllib3==2.7.0`, `certifi`, `charset-normalizer`, `idna`) |
| HTML parsing | `beautifulsoup4==4.15.0` + `soupsieve==2.9.2` (`bs4==0.0.2` shim) |
| Concurrency | `threading.Thread(daemon=True)` + `root.after(0, ...)` for thread-safe UI updates |
| Env | local `.venv/` (ignored by `.gitignore`), `requirements.txt` pinned |
| OS | Developed on `win32` / PowerShell 5.1; paths and shell commands assume Windows but code is cross-platform |

## 3. Repository Layout

```
URL/                         # worktree root (opencode walks up to here)
├── main.py                  # ~126 lines, single class URLInspectorApp — all app logic
├── requirements.txt         # 9 pinned deps (see Stack)
├── .gitignore               # ignores .git and .venv  (note: ignoring .git is unusual)
├── .venv/                   # local venv (not committed)
├── opencode.json            # opencode project config (this repo)
├── AGENTS.md                # this file
└── .git/                    # git — origin https://github.com/gautham-websters/URL-checker, branch main
```

No `pyproject.toml`, `setup.py`, `setup.cfg`, linter config, formatter config, or tests. No `.opencode/` sub-agents/commands yet.

## 4. How to Run / Setup

```powershell
# 1. Create / activate venv (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install deps
pip install -r requirements.txt

# 3. Run (requires display)
python main.py
# or
python3 main.py

# Quick smoke without GUI — import check
python -c "import ast; ast.parse(open('main.py').read()); print('parse ok')"
python -c "import requests, bs4; print(requests.__version__, bs4.__version__)"
```

Expected GUI: 1000×700 window, top `Target URLs` text area (default `https://thehealthyhomeme.com/en/ae/packages-and-contracts`), `User-Agent` entry, `Run Inspection` button, bottom `ttk.Notebook` with one tab per URL.

## 5. Architecture — `main.py` (126 lines)

### `class URLInspectorApp` — `main.py:7`

| Method | Location | Responsibility |
|--------|----------|----------------|
| `__init__(self, root)` | `main.py:8` | Build UI: `input_frame` (Text + Run button), `opts_frame` (User-Agent), `notebook` |
| `start_inspection(self)` | `main.py:39` | Parse URLs from `url_text`, validate non-empty, clear `notebook` tabs, disable button, spawn daemon thread |
| `inspect_urls(self, urls)` | `main.py:54` | Worker thread: normalize `http(s)://`, call `process_single_url`, schedule `create_result_tab` via `root.after(0, ...)` |
| `process_single_url(self, url, headers)` | `main.py:66` | Core logic — `requests.Session().get(url, headers, allow_redirects=True, timeout=10)` → build string with redirect hops, headers, hreflang; returns `"\n".join(out)`; catches all exceptions |
| `create_result_tab(self, url, content)` | `main.py:110` | Main-thread UI: create `ttk.Frame`, truncated label (`url[:25]+"..."`), `tk.Text(wrap="none")` + vertical `ttk.Scrollbar` |

**Data flow:** `url_text` → `start_inspection` → `threading.Thread` → `inspect_urls` loop → `process_single_url` (blocking `requests`) → `root.after` → `create_result_tab`.

**Key patterns:**
- Threading: Never touch Tk widgets off the main thread — use `self.root.after(0, callable)` (`main.py:62`, `main.py:64`).
- Redirects: Iterate `res.history` (`main.py:75-79`), final URL in `res.url` (`main.py:79/81`). `Location` header fallback `"Unknown"`.
- hreflang: `soup.find_all("link", rel=lambda x: x and "alternate" in x.lower())` then `has_attr("hreflang")` (`main.py:92-100`). Intentionally loose to catch `rel="alternate hreflang"` / multi-value rels; case-insensitive.
- Error surface: single `try/except Exception` around whole fetch → `out.append(f"ERROR fetching URL: ...")` (`main.py:105-106`).

### UI Gotchas Already Fixed / Still Present

- Fixed in `75cafb5`: `self.root.geometry("1000x700")` was `"1000"x"700"` syntax error (`main.py:11`).
- `create_result_tab:113-121`: `text_area.pack(fill="both", expand=True)` before `scrollbar.pack(side="right", fill="y")` means scrollbar is packed after text area has expanded — on some themes the scrollbar is clipped. Canonical order is scrollbar first, then text area with `fill`. Don't "fix" without visual verification on Windows.
- No `yscrollcommand`/`command` mismatch, no `wrap="none"` horizontal scroll, no timeout/retry config, no cancellation.

## 6. Code Style & Conventions

- **Single file, no modules.** Keep `main.py` self-contained unless user explicitly asks to split. Prefer small edits over re-architecture.
- **Stdlib + pinned deps only.** Don't add new dependencies without asking. If you must, pin in `requirements.txt`.
- **Indentation:** 4 spaces, no tabs (current file uses 4 spaces).
- **Naming:** `snake_case` for methods/vars, `CamelCase` for `URLInspectorApp`.
- **Imports:** Keep top-of-file imports grouped (stdlib: `tkinter`, `threading`; third-party: `requests`, `bs4`). Don't reorder without reason.
- **Comments:** Concise only; don't add long chain-of-thought comments. Existing comments are minimal (`# Top Frame: Input & Options`, etc.).
- **Strings:** Double quotes for UI text, f-strings for formatted output.
- **Error handling:** Current code swallows all exceptions in `process_single_url` — preserve that behavior for UI stability unless task asks for structured errors.

## 7. Common Tasks (for agents)

| Task | How |
|------|-----|
| **Add a CLI mode** | Gate `if __name__ == "__main__"` — check `sys.argv` before creating `Tk()`. Keep GUI path default. |
| **Add timeout / retry options** | Expose as `ttk.Entry`/`Spinbox` in `opts_frame` (`main.py:28-33` pattern), thread through `inspect_urls` → `process_single_url` `session.get(timeout=...)`. |
| **Export results** | Add button in `btn_frame` (`main.py:22-25`); iterate `notebook.tabs()` or cache `tab_data` list. |
| **Fix scrollbar** | Swap pack order: `scrollbar.pack(side="right", fill="y")` before `text_area.pack(fill="both", expand=True, side="left")` — verify visually on Windows. |
| **Add tests** | No test harness exists. Create `tests/` + `pytest`; mock `requests.Session.get` with `history`/`headers`/`text`. Run `pytest -q` and `python -m py_compile main.py`. |
| **Update deps** | Edit `requirements.txt` then `pip install -r requirements.txt`; note `bs4==0.0.2` is a shim for `beautifulsoup4` — keep both or drop `bs4` if cleaning. |

## 8. Verification & Testing

No existing tests. After any edit, at minimum:

```powershell
# 1. Parse & compile
python -m py_compile main.py; if ($?) { Write-Output "compile ok" }

# 2. Import smoke (no display)
python -c "import ast; tree=ast.parse(open('main.py').read()); print('classes:', [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)])"

# 3. Full run (requires display) — manual
python main.py
# Enter: https://example.com  and  https://httpbin.org/redirect/2  → Run Inspection → verify hops, headers, hreflang sections appear in tabs

# 4. If adding pytest
pip install pytest
pytest -q
```

Network calls are live — don't hammer external hosts in loops. Mock in tests. Respect `timeout=10`; consider adding `pytest -k "not network"` marker if adding integration tests.

## 9. Permissions & Safety

- **Network:** `process_single_url` does outbound `GET` with the user-supplied `User-Agent`. Don't auto-fetch arbitrary URLs in agents without user intent.
- **Threading:** Don't call `messagebox`, `notebook.add`, or `Text.insert` from `inspect_urls` directly — always via `root.after`.
- **Filesystem:** Project is small — avoid writing temp files outside `C:\Users\webst\AppData\Local\Temp\opencode` unless task needs it.
- **Secrets:** No secrets in repo. Don't commit `.venv/` or add credentials to `requests` headers.

## 10. Git Conventions

- Remote: `origin https://github.com/gautham-websters/URL-checker` — `main` tracks `origin/main`.
- Commits: recent history uses short prefix `fix:` / `v1` — keep messages concise, check `git log --oneline -10` before committing.
- `.gitignore` currently ignores `.git` itself (line 1) — don't remove without asking; flag to user that this prevents nested-repo tooling from seeing `.git`.
- Before commit: `git status`, `git diff`, stage only intended files, never commit secrets or `.venv`.

## 11. opencode Integration

- Config: `opencode.json` at worktree root with `"$schema": "https://opencode.ai/config.json"` and `instructions: ["AGENTS.md"]` so this file is auto-loaded.
- Config is loaded once at startup — **quit and restart opencode** after editing `opencode.json`, `AGENTS.md`, or anything under `.opencode/`.
- Escape hatches if config breaks startup:
  `OPENCODE_DISABLE_PROJECT_CONFIG=1`, `OPENCODE_CONFIG=/path/to/file.json`, `OPENCODE_CONFIG_CONTENT='{"$schema":"https://opencode.ai/config.json"}'`.

## 12. What NOT to Do

- Don't split `main.py` into modules without explicit user request — project is intentionally single-file.
- Don't add `pyproject.toml`/`setup.py` unless packaging is requested.
- Don't add heavy frameworks (Flask, etc.) — this is a desktop `tkinter` app (Flask appears in `.venv` but is not used).
- Don't change `requirements.txt` pinned versions without verifying `requests`/`bs4` API compatibility.
- Don't use `bash` tool for file reads/writes — use `read`/`edit`/`write`; reserve `bash` for `git`, `pip`, `python`, etc.
- Don't add emojis to code or `AGENTS.md` unless asked.
