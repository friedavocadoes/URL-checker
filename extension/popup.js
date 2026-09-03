// popup.js — UI controller for URL Inspector extension
// Mirrors main.py: URLInspectorApp (start_inspection, inspect_urls, create_result_tab)

const els = {
  urlInput: document.getElementById("urlInput"),
  uaInput: document.getElementById("uaInput"),
  runBtn: document.getElementById("runBtn"),
  currentTabBtn: document.getElementById("currentTabBtn"),
  clearBtn: document.getElementById("clearBtn"),
  status: document.getElementById("status"),
  tabButtons: document.getElementById("tabButtons"),
  tabContents: document.getElementById("tabContents"),
  copyBtn: document.getElementById("copyBtn"),
  exportBtn: document.getElementById("exportBtn"),
  appVersion: document.getElementById("appVersion"),
  clipboardPrompt: document.getElementById("clipboardPrompt"),
  clipboardUrl: document.getElementById("clipboardUrl"),
  clipboardAppendBtn: document.getElementById("clipboardAppendBtn"),
  clipboardReplaceBtn: document.getElementById("clipboardReplaceBtn"),
  clipboardDismissBtn: document.getElementById("clipboardDismissBtn"),
};

let tabsData = []; // { url, content, hasError }
let activeTabIndex = 0;

// Load version from manifest
try {
  const manifest = chrome.runtime.getManifest();
  if (manifest?.version && els.appVersion) els.appVersion.textContent = "v" + manifest.version;
} catch (_) {}

// Restore last inputs from storage
chrome.storage.local.get(["lastUrls", "lastUA"], (data) => {
  if (data.lastUrls && typeof data.lastUrls === "string") {
    // don't overwrite default if user never saved
    // keep textarea as is unless stored value differs from default and not empty
    if (data.lastUrls.trim()) els.urlInput.value = data.lastUrls;
  }
  if (data.lastUA && typeof data.lastUA === "string") els.uaInput.value = data.lastUA;
  // Check for pending URL from context menu
  chrome.storage.local.get(["pendingUrls"], (p) => {
    if (p.pendingUrls) {
      const pending = p.pendingUrls;
      chrome.storage.local.remove("pendingUrls");
      // Prepend pending URL to textarea if not already there
      const current = els.urlInput.value.split("\n").map(s => s.trim()).filter(Boolean);
      if (!current.includes(pending)) {
        els.urlInput.value = [pending, ...current].join("\n");
      }
    }
  });
});

// --- Clipboard link detection prompt ---
let lastClipboardPromptUrl = null;
const dismissedClipboardUrls = new Set();
function isValidHttpUrl(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  // Basic URL check — allow http/https only, no spaces, must be single line
  if (!t || t.includes(" ") || t.includes("\n")) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (_) {
    return false;
  }
}
function showClipboardPrompt(url) {
  if (!els.clipboardPrompt || !els.clipboardUrl) return;
  // Don't show if already in textarea
  const current = els.urlInput.value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (current.includes(url)) return;
  // Don't re-show if user dismissed this exact URL in this session
  if (dismissedClipboardUrls.has(url)) return;
  // Don't duplicate if already visible for same URL
  if (lastClipboardPromptUrl === url && !els.clipboardPrompt.classList.contains("hidden")) return;
  lastClipboardPromptUrl = url;
  els.clipboardUrl.textContent = url;
  els.clipboardUrl.title = url;
  els.clipboardPrompt.classList.remove("hidden");
}
function hideClipboardPrompt() {
  if (!els.clipboardPrompt) return;
  // Remember dismissed URL to avoid nagging for same clipboard content
  const url = els.clipboardUrl?.textContent?.trim();
  if (url) dismissedClipboardUrls.add(url);
  els.clipboardPrompt.classList.add("hidden");
}
async function checkClipboardForUrl() {
  // Try to read clipboard — requires clipboardRead permission; fails silently if not granted or no gesture
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    const text = await navigator.clipboard.readText();
    if (isValidHttpUrl(text)) {
      const url = text.trim();
      // Don't prompt if already dismissed this session for same url and user didn't change clipboard
      showClipboardPrompt(url);
    }
  } catch (e) {
    // Clipboard read blocked (needs user gesture on some browsers) — ignore, no prompt
    // console.debug("clipboard read failed", e);
  }
}
// Check on load (delayed to allow popup to render) and on focus (user may have copied after opening)
setTimeout(checkClipboardForUrl, 250);
window.addEventListener("focus", () => setTimeout(checkClipboardForUrl, 100));
// Also handle append/replace/dismiss actions
if (els.clipboardAppendBtn) {
  els.clipboardAppendBtn.addEventListener("click", () => {
    const url = els.clipboardUrl?.textContent?.trim();
    if (!url) return;
    const current = els.urlInput.value.trim();
    els.urlInput.value = current ? current + "\n" + url : url;
    hideClipboardPrompt();
    setStatus(`Appended clipboard link: ${url}`, "success");
    try { chrome.storage.local.set({ lastUrls: els.urlInput.value }); } catch (_) {}
  });
}
if (els.clipboardReplaceBtn) {
  els.clipboardReplaceBtn.addEventListener("click", () => {
    const url = els.clipboardUrl?.textContent?.trim();
    if (!url) return;
    els.urlInput.value = url;
    hideClipboardPrompt();
    setStatus(`Pasted clipboard link (cleared): ${url}`, "success");
    try { chrome.storage.local.set({ lastUrls: els.urlInput.value }); } catch (_) {}
  });
}
if (els.clipboardDismissBtn) {
  els.clipboardDismissBtn.addEventListener("click", hideClipboardPrompt);
}

function setStatus(msg, kind = "") {
  els.status.textContent = msg;
  els.status.className = "status " + kind;
}

function normalizeLabel(url) {
  return url.replace(/^https?:\/\//i, "").slice(0, 25) + (url.replace(/^https?:\/\//i, "").length > 25 ? "..." : "");
}

function createResultTabs() {
  els.tabButtons.innerHTML = "";
  els.tabContents.innerHTML = "";

  if (tabsData.length === 0) {
    els.tabContents.innerHTML = `<div class="empty-state"><p>No inspection yet.</p><p class="hint">Enter URLs above and click <strong>Run Inspection</strong>.</p></div>`;
    els.copyBtn.disabled = true;
    els.exportBtn.disabled = true;
    return;
  }

  tabsData.forEach((tab, idx) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (idx === activeTabIndex ? " active" : "") + (tab.hasError ? " has-error" : "");
    btn.textContent = normalizeLabel(tab.url);
    btn.title = tab.url;
    btn.addEventListener("click", () => switchTab(idx));
    els.tabButtons.appendChild(btn);

    const panel = document.createElement("div");
    panel.className = "tab-panel" + (idx === activeTabIndex ? " active" : "");
    panel.textContent = tab.content;
    els.tabContents.appendChild(panel);
  });

  els.copyBtn.disabled = false;
  els.exportBtn.disabled = false;
}

function switchTab(idx) {
  activeTabIndex = idx;
  const btns = [...els.tabButtons.children];
  const panels = [...els.tabContents.children];
  btns.forEach((b, i) => b.classList.toggle("active", i === idx));
  panels.forEach((p, i) => p.classList.toggle("active", i === idx));
}

async function inspectSingleUrl(url, userAgent) {
  // Send to background service worker which does the actual fetch (with DNR UA spoof)
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "INSPECT_URL", url, userAgent }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(`ERROR fetching URL: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!response) {
        resolve("ERROR fetching URL: no response from background (service worker may be inactive — retry)");
        return;
      }
      if (response.ok) resolve(response.result);
      else resolve(`ERROR fetching URL: ${response.error}`);
    });
  });
}

async function startInspection() {
  const raw = els.urlInput.value;
  const urls = raw.split("\n").map((u) => u.trim()).filter(Boolean);
  const userAgent = els.uaInput.value.trim();

  if (urls.length === 0) {
    setStatus("Please enter at least one URL.", "error");
    return;
  }

  // Persist inputs
  chrome.storage.local.set({ lastUrls: raw, lastUA: userAgent });

  // UI: disable, clear tabs
  els.runBtn.disabled = true;
  els.runBtn.textContent = "Inspecting…";
  tabsData = [];
  activeTabIndex = 0;
  els.tabButtons.innerHTML = "";
  els.tabContents.innerHTML = `<div class="empty-state"><p>Inspecting ${urls.length} URL(s)…</p></div>`;
  els.copyBtn.disabled = true;
  els.exportBtn.disabled = true;
  setStatus(`Inspecting ${urls.length} URL(s) with timeout 10s…`, "");

  // Sequential like Python's inspect_urls loop, but we can run in parallel for speed.
  // Keep sequential to mirror Python ordering and avoid burst.
  for (let i = 0; i < urls.length; i++) {
    let url = urls[i];
    setStatus(`Inspecting ${i + 1}/${urls.length}: ${url} …`, "");
    const content = await inspectSingleUrl(url, userAgent);
    const normalizedUrl = url.startsWith("http://") || url.startsWith("https://") ? url : "https://" + url;
    const hasError = content.startsWith("ERROR fetching URL") || content.includes("\nERROR fetching URL");
    tabsData.push({ url: normalizedUrl, content, hasError });
    // Incrementally render so user sees progress
    createResultTabs();
    // Keep active tab on latest if first, else stay on 0 — mimic notebook adding tabs
    if (i === 0) switchTab(0);
  }

  els.runBtn.disabled = false;
  els.runBtn.textContent = "Run Inspection";
  setStatus(`Done — inspected ${urls.length} URL(s).`, "success");
  // Ensure first tab active
  if (tabsData.length > 0) switchTab(0);
}

// Current tab button
async function fillCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const cur = els.urlInput.value.split("\n").map(s => s.trim()).filter(Boolean);
      if (!cur.includes(tab.url)) {
        els.urlInput.value = els.urlInput.value.trim()
          ? els.urlInput.value.trim() + "\n" + tab.url
          : tab.url;
      }
      setStatus(`Added current tab: ${tab.url}`, "success");
    } else {
      setStatus("No active tab URL found.", "error");
    }
  } catch (e) {
    setStatus(`Cannot read current tab: ${e.message}`, "error");
  }
}

// Copy / Export
async function copyActive() {
  if (tabsData.length === 0) return;
  const text = tabsData[activeTabIndex]?.content || "";
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied active tab to clipboard.", "success");
  } catch {
    // fallback: hidden textarea
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setStatus("Copied (fallback).", "success");
  }
}

function exportActive() {
  if (tabsData.length === 0) return;
  const tab = tabsData[activeTabIndex];
  const blob = new Blob([tab.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = tab.url.replace(/[^a-z0-9]/gi, "_").slice(0, 40) || "inspection";
  a.href = url;
  a.download = `${safeName}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Exported ${safeName}.txt`, "success");
}

// Export all as zip? For now export active; user can copy others.
function exportAll() {
  // If Shift held, export all concatenated
  const all = tabsData.map(t => `===== ${t.url} =====\n${t.content}`).join("\n\n");
  const blob = new Blob([all], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "url-inspections.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Pop out — fill browser window height
// Chrome popups are capped at ~600px. This opens the same UI as a full tab
// (or side panel when available) so CSS height:100vh truly fills the window.
const popoutBtn = document.getElementById("popoutBtn");
if (popoutBtn) {
  // When already in a full tab / side panel, keep button but allow re-pop
  const isFullPage = window.location.protocol === "chrome-extension:" && window.innerHeight > 620;
  if (isFullPage) {
    popoutBtn.title = "Already in full-page mode — click to open another tab";
    popoutBtn.textContent = "⤢ Pop out again";
  }
  popoutBtn.addEventListener("click", async () => {
    const url = chrome.runtime.getURL("popup.html");
    try {
      // Try sidePanel first if API exists (fills height docked)
      if (chrome.sidePanel && typeof chrome.sidePanel.open === "function") {
        try {
          const win = await chrome.windows.getCurrent();
          await chrome.sidePanel.open({ windowId: win.id });
          // Ensure side panel points at our page (manifest default_path already does)
          if (chrome.sidePanel.setOptions) {
            await chrome.sidePanel.setOptions({ path: "popup.html", enabled: true });
          }
          return;
        } catch (_) {
          // fall through to tab
        }
      }
    } catch (_) {}
    // Fallback: open as full tab (height:100vh = browser window height)
    try {
      await chrome.tabs.create({ url });
    } catch (e) {
      // Final fallback: window.open
      window.open(url, "_blank");
    }
    // Close the popup after launching
    try { window.close(); } catch (_) {}
  });
}

// Events
els.runBtn.addEventListener("click", startInspection);
els.currentTabBtn.addEventListener("click", fillCurrentTab);
els.clearBtn.addEventListener("click", () => {
  els.urlInput.value = "";
  tabsData = [];
  createResultTabs();
  setStatus("Cleared.", "");
});
els.copyBtn.addEventListener("click", copyActive);
els.exportBtn.addEventListener("click", (e) => {
  if (e.shiftKey) exportAll();
  else exportActive();
});
// Allow Ctrl+Enter to run
els.urlInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") startInspection();
});
els.uaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startInspection();
});

// Detect full-page / side-panel mode and add class for extra styling hooks
if (window.innerHeight > 620 || window.innerWidth > 820 || window.location.search.includes("popout")) {
  document.documentElement.classList.add("full-height");
}

// --- Resizable popup via mouse edge dragging ---
// Supports: right edge (width), bottom edge (height), corner (both), and native CSS `resize` handle.
// Persists size to chrome.storage.local and restores on next open.
// Hidden in full-height mode where the browser window handles resizing.
(function setupResizablePopup() {
  // Skip in full-height / tab / side-panel — window resizes natively there
  if (document.documentElement.classList.contains("full-height")) return;

  const body = document.body;
  const resizerRight = document.getElementById("resizerRight");
  const resizerBottom = document.getElementById("resizerBottom");
  const resizerCorner = document.getElementById("resizerCorner");
  const STORAGE_KEY = "popupSize";
  const DEFAULT_WIDTH = 780;
  const DEFAULT_HEIGHT = 600;
  const MIN_WIDTH = 380;
  const MIN_HEIGHT = 480;
  const MAX_WIDTH = 800; // Chrome popup max width
  const MAX_HEIGHT = 600; // Chrome popup max height — outer window caps here; inner can't outgrow outer

  // Restore saved size
  try {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      const s = data[STORAGE_KEY];
      if (s && typeof s.width === "number" && typeof s.height === "number") {
        const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, s.width));
        const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, s.height));
        body.style.width = w + "px";
        body.style.height = h + "px";
        // Override max-height to allow larger than default 85vh/700px when user explicitly resized
        body.style.maxHeight = h + "px";
      }
    });
  } catch (_) {}

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function persistSize() {
    const w = Math.round(parseFloat(getComputedStyle(body).width) || body.offsetWidth);
    const h = Math.round(parseFloat(getComputedStyle(body).height) || body.offsetHeight);
    try { chrome.storage.local.set({ [STORAGE_KEY]: { width: w, height: h } }); } catch (_) {}
  }

  function resetSize() {
    body.style.width = DEFAULT_WIDTH + "px";
    body.style.height = DEFAULT_HEIGHT + "px";
    body.style.maxHeight = DEFAULT_HEIGHT + "px";
    try { chrome.storage.local.remove(STORAGE_KEY); } catch (_) {}
  }

  // Native CSS `resize` observer — catch corner drag via ResizeObserver and persist
  try {
    if (typeof ResizeObserver !== "undefined") {
      let resizeTimer = null;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(persistSize, 300);
      });
      ro.observe(body);
    }
  } catch (_) {}

  // Helper to attach edge drag
  function attachResizer(el, mode) {
    if (!el) return;
    let startX = 0, startY = 0, startW = 0, startH = 0, dragging = false;

    el.addEventListener("mousedown", (e) => {
      // Ignore if in full-height
      if (document.documentElement.classList.contains("full-height")) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = body.offsetWidth;
      startH = body.offsetHeight;
      document.body.style.userSelect = "none";
      document.body.style.pointerEvents = "none";
      // Keep resizers interactive
      el.style.pointerEvents = "auto";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    el.addEventListener("dblclick", (e) => {
      e.preventDefault();
      resetSize();
    });

    function onMove(e) {
      if (!dragging) return;
      let newW = startW, newH = startH;
      if (mode === "right" || mode === "corner") {
        newW = clamp(startW + (e.clientX - startX), MIN_WIDTH, MAX_WIDTH);
        body.style.width = newW + "px";
      }
      if (mode === "bottom" || mode === "corner") {
        newH = clamp(startH + (e.clientY - startY), MIN_HEIGHT, MAX_HEIGHT);
        body.style.height = newH + "px";
        body.style.maxHeight = newH + "px";
      }
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      document.body.style.pointerEvents = "";
      el.style.pointerEvents = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      persistSize();
    }
  }

  attachResizer(resizerRight, "right");
  attachResizer(resizerBottom, "bottom");
  attachResizer(resizerCorner, "corner");
})();
