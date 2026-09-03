# URL Inspector & Multi-Checker — Browser Extension

Replicates `curl -siL` + `hreflang` auditing — now as a one-click browser extension.  
Ported from the Python `tkinter` desktop app (`main.py`) to Manifest V3 (Chrome / Edge / Brave / Firefox).

For each URL it reports:

1. **HTTP redirect hops & status codes** — manual `fetch(redirect: 'manual')` loop, max 10 hops
2. **Final response headers** — dumped verbatim
3. **hreflang tags** — `DOMParser` extraction of `<link rel="alternate" hreflang="...">` (same loose logic as `BeautifulSoup` in `main.py:92`)

---

## Install — Load Unpacked (development)

### Chrome / Edge / Brave

1. Download or clone this repo:
   ```powershell
   git clone https://github.com/gautham-websters/URL-checker.git
   cd URL-checker
   ```
2. Open `chrome://extensions` (or `edge://extensions`) → toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select the `extension/` folder (must contain `manifest.json` at top level).
4. Pin the extension (puzzle piece icon → pin) and click **URL Inspector** to open the popup.

### Firefox (temporary)

1. Open `about:debugging` → _This Firefox_ → **Load Temporary Add-on…**
2. Select `extension/manifest.json`.

For permanent Firefox install, package with `web-ext`:

```bash
npx web-ext build --source-dir=extension --artifacts-dir=web-ext-artifacts
# then submit web-ext-artifacts/*.zip to AMO
```

---

## Usage

1. Click the extension icon → popup opens (780×700).
2. **Target URLs** — one per line. Default is `https://google.com` (same as desktop). Example to test redirects:
   ```
   https://example.com
   https://httpbin.org/redirect/2
   https://httpbin.org/response-headers?Link=%3Chttps://example.com/en%3E;%20rel=%22alternate%22;%20hreflang=%22en%22
   ```
3. **User-Agent** — editable. Note: browsers forbid overriding `User-Agent` via `fetch` headers; the extension installs a `declarativeNetRequest` session rule to spoof it — if that fails, the browser default UA is used (hint explains this).
4. Click **Run Inspection** (or `Ctrl+Enter`). Each URL gets a tab (like `ttk.Notebook`).
5. **Use Current Tab URL** — fills the textarea with the active tab's URL.
6. **Copy** / **Export .txt** — copy active tab or download as text file. Hold `Shift` while clicking Export to download all tabs concatenated.

Output format mirrors `main.py:66-108`:

```
=== HTTP REDIRECT HOPS & RESPONSE CODES ===
Hop 1: [301] https://example.com -> Redirects to: https://www.example.com/
Final Destination: [200] https://www.example.com/

=== FINAL RESPONSE HEADERS ===
content-type: text/html
...

=== HREFLANG TAGS FOUND ===
hreflang='en' -> https://example.com/en
...
```

---

## Architecture

```
extension/
├── manifest.json      # MV3, host_permissions <all_urls>, declarativeNetRequest, background service worker
├── popup.html         # UI — textarea + UA + buttons + tab bar + tab contents
├── popup.css          # Card layout, tab pills, dark code panel (mirrors tkinter 1000x700)
├── popup.js           # UI controller — mirrors URLInspectorApp.start_inspection / create_result_tab
├── background.js      # Service worker — mirrors URLInspectorApp.process_single_url
└── icons/icon*.png    # Generated 16/48/128 via Pillow (dark #0f172a, magnifier)
```

- **Threading parity:** Desktop used `threading.Thread + root.after` to keep UI responsive. Extension uses `chrome.runtime.sendMessage` + `async/await` — popup stays responsive while `background.js` fetches sequentially (same order as Python loop).
- **Redirects:** Python `res.history` → JS manual loop with `fetch(redirect:'manual')`, resolving relative `Location` via `new URL(location, currentUrl)`, fallback for `opaqueredirect` (status 0) via second `fetch(redirect:'follow')`.
- **Timeout:** `AbortController` with `10000ms` (matches `requests timeout=10`).
- **hreflang:** `DOMParser` + `querySelectorAll('link[rel][hreflang]')` filtered by `rel.toLowerCase().includes('alternate')` (same as `BeautifulSoup` lambda).
- **Storage:** `chrome.storage.local` persists last URLs/UA and pending URL from context menu.

---

## Permissions Explained

| Permission                                                     | Why                                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                      | Remember last URLs/UA, pending context-menu URL                                                                             |
| `activeTab`, `scripting`                                       | _Use Current Tab URL_ button                                                                                                |
| `declarativeNetRequest`, `declarativeNetRequestWithHostAccess` | Spoof `User-Agent` header (browsers block `fetch` header override otherwise)                                                |
| `host_permissions: <all_urls>`                                 | Fetch arbitrary user-supplied URLs + read their headers/body + follow redirects. Without this, CORS would block inspection. |

---

## Packaging for Store

```powershell
# Chrome Web Store — zip the extension/ folder contents (not the folder itself)
Compress-Archive -Path extension\* -DestinationPath url-inspector-v1.0.0.zip -Force
# Or on Linux/macOS
(cd extension && zip -r ../url-inspector-v1.0.0.zip . -x "*.DS_Store")

# Verify
unzip -l url-inspector-v1.0.0.zip
```

Upload the zip to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) or Edge Add-ons. Bump `extension/manifest.json` `version` for each store update — the GitHub release workflow does this automatically via git tags.

---

## Desktop Fallback

The original Python desktop app still works unchanged:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py   # 1000x700 tkinter window
```

---

## Troubleshooting

- **No hops shown / opaqueredirect note:** Some browsers return `opaqueredirect` (status 0) for `redirect: manual` on cross-origin. The extension falls back to `redirect: follow` and notes the limitation while still showing final headers/hreflang. For full hop visibility, consider adding a tiny native host or CORS proxy — or use the desktop app which has full `requests` redirect history.
- **User-Agent not applied:** Expected on some Chromium builds. The `declarativeNetRequest` rule is best-effort; check `chrome://extensions` → _Errors_ for DNR failures. Headers/hops still work.
- **CORS error in console:** Ensure `<all_urls>` is granted. Reinstall unpacked if manifest changed.
- **Service worker inactive:** Click _Service worker_ link in `chrome://extensions` to inspect, or retry inspection — the popup auto-retries via `chrome.runtime.sendMessage`.

---

## Versioning

`extension/manifest.json` `version` is the source of truth. The GitHub Actions workflow (`.github/workflows/release.yml`) reads it, creates tag `v<version>`, packages `url-inspector-v<version>.zip`, and publishes a GitHub Release automatically on push to `main` when `extension/**` changes (and on `v*` tag pushes / manual dispatch).
