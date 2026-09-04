# URL Inspector & Multi-Checker

> `curl -siL` + `hreflang` audit for any URL — as a browser extension or desktop app.

<p align="center">
  <a href="https://github.com/friedavocadoes/URL-checker/releases/latest"><img src="https://img.shields.io/github/v/release/gautham-websters/URL-checker?label=latest&color=4285F4&style=for-the-badge" alt="latest release"></a>
  <a href="https://github.com/friedavocadoes/URL-checker/blob/main/LICENSE"><img src="https://img.shields.io/github/license/gautham-websters/URL-checker?style=for-the-badge&color=00A562" alt="MIT"></a>
  <img src="https://img.shields.io/badge/manifest-v3-FF7139?style=for-the-badge&logo=googlechrome&logoColor=white" alt="MV3">
</p>

<p align="center">
  <a href="https://github.com/friedavocadoes/URL-checker/releases/latest"><img src="https://img.shields.io/badge/Download-Extension_ZIP-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download Extension"></a>
  <a href="https://github.com/friedavocadoes/URL-checker/releases/latest"><img src="https://img.shields.io/badge/Download-Desktop_EXE-00A562?style=for-the-badge&logo=windows&logoColor=white" alt="Download EXE"></a>
</p>

**For each URL:** redirect hops & status codes · final headers · `<link rel="alternate" hreflang>` tags.

---

### Download

Grab the latest from **[Releases](../../releases/latest)**:

- **`url-inspector-v*.zip`** → extension · **`*URL-Inspector-v*.exe`** → Windows app (no Python needed)

> Buttons above go to the latest release — pick your file under **Assets**.

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
