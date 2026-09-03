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
