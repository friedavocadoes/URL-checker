// background.js — service worker for URL Inspector & Multi-Checker
// Replicates main.py:process_single_url via fetch with manual redirect tracking.
// Host permissions <all_urls> let us fetch cross-origin from extension context.

const MAX_REDIRECTS = 10;
const FETCH_TIMEOUT_MS = 10000;

// Dynamic User-Agent spoofing via declarativeNetRequest
// Browsers forbid `User-Agent` in fetch headers, so we install a session rule
// that rewrites the header for the next fetch, then remove it.
const DNR_RULE_ID = 1;

async function setUserAgentRule(userAgent) {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DNR_RULE_ID],
      addRules: userAgent
        ? [
            {
              id: DNR_RULE_ID,
              priority: 1,
              action: {
                type: "modifyHeaders",
                requestHeaders: [
                  { header: "User-Agent", operation: "set", value: userAgent }
                ]
              },
              condition: {
                resourceTypes: ["xmlhttprequest"],
                // match all urls — host_permissions already grants <all_urls>
              }
            }
          ]
        : []
    });
  } catch (e) {
    // declarativeNetRequest may not be available in all browsers / contexts
    // Fallback is to just try fetch headers directly.
    console.warn("[background] DNR set UA failed:", e?.message);
  }
}

async function clearUserAgentRule() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DNR_RULE_ID]
    });
  } catch (_) {}
}

/**
 * Inspect a single URL — mirrors main.py:66 process_single_url
 * @param {string} url
 * @param {string} userAgent
 * @returns {Promise<string>} formatted output
 */
async function processSingleUrl(url, userAgent) {
  const out = [];

  // Normalize scheme like Python: if no http(s)://, prepend https://
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  // Install UA rule (best-effort) so fetch actually sends it.
  // We keep it installed for the whole redirect chain, then clear.
  if (userAgent) await setUserAgentRule(userAgent);

  try {
    const hops = [];
    let currentUrl = url;
    let finalResponse = null;
    let finalHeaders = null;
    let finalBody = "";

    for (let i = 0; i < MAX_REDIRECTS; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      // Try to send UA via fetch headers too (may be ignored, but harmless).
      // DNR rule above is the real mechanism.
      const headers = {};
      // Only set if browser allows — will be stripped if forbidden, but try.
      if (userAgent) {
        try {
          headers["User-Agent"] = userAgent;
        } catch (_) {}
      }

      let res;
      try {
        res = await fetch(currentUrl, {
          method: "GET",
          headers,
          redirect: "manual",
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const status = res.status;
      // opaque redirect (type === 'opaqueredirect') happens in some browsers
      // when redirect: manual + cross-origin. Status will be 0 and no headers.
      // We treat that as final and note limitation.
      const location = res.headers.get("Location") || res.headers.get("location");

      // If opaqueredirect (status 0), we cannot follow manually — fall back to
      // a fetch with redirect: follow to at least get final body/headers, but
      // we lose hop detail. We handle that below.
      if (res.type === "opaqueredirect" || status === 0) {
        // Fallback: do a follow fetch and synthesize hop note
        const followController = new AbortController();
        const followTimeout = setTimeout(() => followController.abort(), FETCH_TIMEOUT_MS);
        try {
          const followRes = await fetch(currentUrl, {
            method: "GET",
            headers,
            redirect: "follow",
            signal: followController.signal
          });
          finalResponse = followRes;
          finalHeaders = followRes.headers;
          finalBody = await followRes.text();
          out.push("=== HTTP REDIRECT HOPS & RESPONSE CODES ===");
          out.push(`Note: browser returned opaqueredirect (CORS/manual-redirect limitation).`);
          out.push(`Final URL may have followed redirects opaquely.`);
          out.push(`Final Destination: [${followRes.status}] ${followRes.url}\n`);
          break;
        } finally {
          clearTimeout(followTimeout);
        }
      }

      if (status >= 300 && status < 400 && location) {
        hops.push({ status, url: currentUrl, location });
        // Resolve relative Location against current URL
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch (_) {
          currentUrl = location;
        }
        // continue loop to fetch next hop
        continue;
      }

      // Non-redirect => final
      finalResponse = res;
      finalHeaders = res.headers;
      try {
        finalBody = await res.text();
      } catch (_) {
        finalBody = "";
      }
      // Build hops output
      out.push("=== HTTP REDIRECT HOPS & RESPONSE CODES ===");
      if (hops.length > 0) {
        hops.forEach((h, idx) => {
          out.push(`Hop ${idx + 1}: [${h.status}] ${h.url} -> Redirects to: ${h.location}`);
        });
        out.push(`Final Destination: [${status}] ${res.url || currentUrl}\n`);
      } else {
        out.push(`Direct Response: [${status}] ${res.url || currentUrl}\n`);
      }
      break;
    }

    if (!finalResponse) {
      out.push("=== HTTP REDIRECT HOPS & RESPONSE CODES ===");
      out.push(`ERROR: too many redirects (>${MAX_REDIRECTS}) at ${currentUrl}\n`);
      return out.join("\n");
    }

    // 2. Final Response Headers
    out.push("=== FINAL RESPONSE HEADERS ===");
    if (finalHeaders) {
      for (const [k, v] of finalHeaders.entries()) {
        out.push(`${k}: ${v}`);
      }
    } else {
      out.push("(no headers captured)");
    }
    out.push("\n");

    // 3. hreflang Extraction
    out.push("=== HREFLANG TAGS FOUND ===");
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(finalBody, "text/html");
      // Match Python: soup.find_all("link", rel=lambda x: x and "alternate" in x.lower())
      // then has_attr("hreflang")
      const candidates = doc.querySelectorAll('link[rel][hreflang]');
      const found = [];
      for (const el of candidates) {
        const rel = (el.getAttribute("rel") || "").toLowerCase();
        if (!rel.includes("alternate")) continue;
        const hreflang = el.getAttribute("hreflang");
        const href = el.getAttribute("href");
        if (hreflang) found.push(`hreflang='${hreflang}' -> ${href}`);
      }
      // Also catch <link hreflang> where rel is space-separated list containing alternate (querySelector already handles, but be thorough)
      if (found.length === 0) {
        // Fallback broader scan like Python's lambda
        const allLinks = doc.querySelectorAll("link[hreflang]");
        for (const el of allLinks) {
          const rel = (el.getAttribute("rel") || "").toLowerCase();
          if (!rel.includes("alternate")) continue;
          const hreflang = el.getAttribute("hreflang");
          const href = el.getAttribute("href");
          if (hreflang && !found.includes(`hreflang='${hreflang}' -> ${href}`)) {
            found.push(`hreflang='${hreflang}' -> ${href}`);
          }
        }
      }
      if (found.length > 0) {
        out.push(...found);
      } else {
        out.push('No <link rel="alternate" hreflang="..."> tags detected on this page.');
      }
    } catch (e) {
      out.push(`(hreflang parse error: ${e.message})`);
    }
  } catch (e) {
    // Mirrors Python: out.append(f"ERROR fetching URL: {str(e)}")
    const msg = e.name === "AbortError" ? `timeout after ${FETCH_TIMEOUT_MS}ms` : (e.message || String(e));
    out.push(`ERROR fetching URL: ${msg}`);
  } finally {
    await clearUserAgentRule();
  }

  return out.join("\n");
}

// Message handler for popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "INSPECT_URL") {
    const { url, userAgent } = msg;
    processSingleUrl(url, userAgent)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true; // keep channel open for async
  }
  if (msg?.type === "PING") {
    sendResponse({ ok: true, pong: true });
    return false;
  }
});

// Optional: context menu to inspect link/page
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: "inspect-url",
      title: "Inspect URL with URL Inspector",
      contexts: ["link", "page"]
    });
  } catch (_) {}
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "inspect-url") {
    const targetUrl = info.linkUrl || info.pageUrl || tab?.url;
    if (targetUrl) {
      // Store pending URL so popup can pick it up
      chrome.storage.local.set({ pendingUrls: targetUrl });
    }
  }
});
