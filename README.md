# URL Inspector & Multi-Checker

Replicates `curl -siL` + `hreflang` auditing for one or more URLs.

- **Browser extension** (recommended, easiest) — `extension/` Manifest V3 for Chrome/Edge/Brave/Firefox
- **Desktop GUI fallback** — `python main.py` (tkinter, single-file)

For each URL it reports:

1. **HTTP redirect hops & status codes**
2. **Final response headers**
3. **`hreflang` tags** (`<link rel="alternate" hreflang="...">`)

GitHub: `gautham-websters/URL-checker` — releases are auto-published via `.github/workflows/release.yml`.

---

## Quick Start — Browser Extension (Easiest)

1. **Download latest release** from [Releases](../../releases) → `url-inspector-v*.zip` (or clone this repo).
2. Unzip.
3. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the unzipped folder (or repo's `extension/` folder).
4. Pin & click the extension → paste URLs (one per line) → **Run Inspection**.

See `extension/README.md` for Firefox, packaging, and troubleshooting.

---

## Quick Start — Desktop App

```powershell
# 1. venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. deps
pip install -r requirements.txt

# 3. run (requires display — 1000×700 window)
python main.py
```

Default textarea contains `https://google.com`.

---

## Repository Layout

```
URL/
├── extension/               # Browser extension (MV3) — popup + background + icons
│   ├── manifest.json
│   ├── popup.html / popup.js / popup.css
│   ├── background.js
│   ├── icons/icon{16,48,128}.png
│   └── README.md
├── .github/workflows/
│   ├── release.yml          # Auto-release on push to main (manifest version → tag → zip → GitHub Release)
│   └── ci.yml               # Validate manifest / JS syntax / Python compile
├── main.py                  # Desktop tkinter app (126 lines, URLInspectorApp)
├── requirements.txt         # requests, beautifulsoup4, etc. (desktop only)
├── opencode.json            # opencode project config
├── AGENTS.md                # Agent instructions (loaded via opencode.json)
└── README.md                # this file
```

---

## Releases (Automation)

Push to `main` affecting `extension/**` → workflow reads `extension/manifest.json` `version`, creates tag `v<version>` (if missing), zips `extension/` → `url-inspector-v<version>.zip`, publishes GitHub Release with auto release notes.

Manual:

- Bump `extension/manifest.json` `version` (e.g. `1.0.1`).
- `git add extension/manifest.json && git commit -m "chore: bump extension to 1.0.1" && git push origin main`

Or trigger manually: Actions → _Release Extension_ → _Run workflow_ (optional version override).

Tag-triggered: `git tag v1.0.1 && git push origin v1.0.1` also builds the same release.

Download zips from the Releases page. Verify SHA256 shown in release body.

---

## Versioning

- Extension store version = `extension/manifest.json` `version` (semver).
- Git tag = `v<version>` (e.g. `v1.0.0`).
- Desktop `main.py` has no version — it is coupled to extension releases for parity.
