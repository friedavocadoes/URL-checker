# URL Inspector & Multi-Checker

> `curl -siL` + `hreflang` audit for any URL — as a browser extension or desktop app.

<p align="center">
  <a href="https://github.com/friedavocadoes/URL-checker/releases/latest"><img src="https://img.shields.io/github/v/release/friedavocadoes/URL-checker?label=latest&color=4285F4&style=for-the-badge" alt="latest release"></a>
  <a href="https://github.com/friedavocadoes/URL-checker/blob/main/LICENSE"><img src="https://img.shields.io/github/license/friedavocadoes/URL-checker?style=for-the-badge&color=00A562" alt="MIT"></a>
  <img src="https://img.shields.io/badge/manifest-v3-FF7139?style=for-the-badge&logo=googlechrome&logoColor=white" alt="MV3">
</p>

<!-- Direct download — always latest, no need to pick from Assets -->
<p align="center">
  <a href="https://github.com/friedavocadoes/URL-checker/releases/latest#assets" style="display:inline-block;background:#1a73e8;color:#ffffff !important;padding:14px 28px;border-radius:12px;font-weight:800;font-size:16px;text-decoration:none;margin:8px 6px;box-shadow:0 6px 18px rgba(26,115,232,0.35);border:2px solid #1557b0;letter-spacing:0.2px;">⬇️ Download Extension ZIP</a>
  <a href="https://github.com/friedavocadoes/URL-checker/releases/latest#assets" style="display:inline-block;background:#0f9d58;color:#ffffff !important;padding:14px 28px;border-radius:12px;font-weight:800;font-size:16px;text-decoration:none;margin:8px 6px;box-shadow:0 6px 18px rgba(15,157,88,0.35);border:2px solid #0b7a43;letter-spacing:0.2px;">⬇️ Download Desktop EXE</a>
</p>
<p align="center" style="margin-top:-6px;color:#64748b;font-size:12px;">One click → jump to Assets for the latest build (<code>url-inspector-v*.zip</code> · <code>URL-Inspector-v*.exe</code>)</p>

**For each URL:** redirect hops & status codes · final headers · `<link rel="alternate" hreflang>` tags.

---

### Download

**Direct (one click):** use the big buttons above — jump to Assets for the latest `url-inspector-v*.zip` / `URL-Inspector-v*.exe`.

Or browse **[Releases](../../releases/latest) → Assets** for versioned files (`url-inspector-v*.zip`, `URL-Inspector-v*.exe`).

### Use

**Extension (recommended)**

1. Unzip → `chrome://extensions` → Developer mode → **Load unpacked** → pick unzipped folder
2. Pin it → paste URLs (one per line) → **Run Inspection**

_Firefox:_ `about:debugging` → Load Temporary Add-on → `extension/manifest.json`

**Desktop**

```powershell
# .exe: double-click URL-Inspector-v*.exe
# or Python:
pip install -r requirements.txt; python main.py
```

Paste `https://example.com` and `https://httpbin.org/redirect/2` to try redirects + hreflang.

---

### For Developers

```powershell
git clone https://github.com/friedavocadoes/URL-checker && cd URL-checker
pip install -r requirements.txt; python main.py          # desktop
# extension: chrome://extensions → Load unpacked → extension/
```

Releases are automated: bump `extension/manifest.json` version + `git commit -m "chore: release vX.Y.Z"` + `git push`, or `git tag vX.Y.Z && git push origin vX.Y.Z`. Zip + exe are attached automatically.

---

### Contributing

Contributions welcome! Fork, branch, open a PR. Please keep `main.py` single-file and extension vanilla JS (no bundler).

Found a bug? Have an idea? **[Open an issue](../../issues/new)** — we’d love to hear from you.

---

### Acknowledgements

Thanks to the open-source projects that make this possible:

**Python app:** [Requests](https://requests.readthedocs.io/), [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) + [Soupsieve](https://facelessuser.github.io/soupsieve/), [Certifi](https://github.com/certifi/python-certifi), [charset-normalizer](https://github.com/Ousret/charset_normalizer), [Idna](https://github.com/kjd/idna), [urllib3](https://urllib3.readthedocs.io/), [PyInstaller](https://pyinstaller.org/) & [Pillow](https://python-pillow.org/) for the `.exe` and icons, and Python’s `tkinter`.

**Extension:** [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/develop/concepts/what-are-extensions) + `declarativeNetRequest`, `DOMParser`.

Built with Python 3.13.

### License

MIT © 2026 gautham — see [LICENSE](LICENSE).
