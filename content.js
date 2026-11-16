// Isolated-world content script. Two independent ways of detecting a new
// chat message, since Gmail's own Notification() calls turned out to be
// unreliable for Chat (Google suppresses them based on its own "are you
// actually away" presence heuristic):
//
// 1. inject.js relays Gmail's own Notification() calls to us — reliable for
//    regular email, flaky for Chat.
// 2. A MutationObserver below watches the Chat conversation list directly
//    for its data-display-timestamp attribute changing, which happens the
//    instant a new message arrives, regardless of Google's presence logic.

function matchRule(title, rules) {
  const lower = title.toLowerCase();

  // Excludes always win first, regardless of row order.
  for (const rule of rules) {
    if (rule.enabled && rule.type === "exclude" && rule.value && lower.includes(rule.value.toLowerCase())) {
      return null;
    }
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.type === "any") return rule;
    if (rule.type === "contains" && rule.value && lower.includes(rule.value.toLowerCase())) {
      return rule;
    }
  }
  return null;
}

// Reloading/updating the extension doesn't remove this script from tabs
// that were already open — the old copy keeps running, but every chrome.*
// call it makes throws "Extension context invalidated". Detect that and
// shut this orphaned copy down quietly (refreshing the tab loads the new one).
let chatListObserver = null;

function isExtensionContextValid() {
  try {
    return !!(chrome.runtime?.id && chrome.storage?.local);
  } catch (e) {
    return false;
  }
}

function shutDownOrphanedScript() {
  if (chatListObserver) chatListObserver.disconnect();
  chatListObserver = null;
}

async function handleMatch(title, body) {
  if (!isExtensionContextValid()) return shutDownOrphanedScript();
  try {
    const { rules = [] } = await chrome.storage.local.get("rules");
    const rule = matchRule(title || "", rules);
    if (!rule) return;

    await chrome.runtime.sendMessage({
      type: "chat-alarm-match",
      ruleName: rule.label || rule.value || "Match",
      title: title || "",
      body: body || "",
    });
  } catch (e) {
    if (!isExtensionContextValid()) return shutDownOrphanedScript();
    console.error("[Chat Alarm] failed to send alarm", e);
  }
}

// --- Method 1: Gmail's own Notification() calls (relayed from inject.js) ---

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || !data.__chatAlarmExt) return;
  handleMatch(data.title, data.body);
});

// --- Method 2: watch the Chat conversation list directly ---

const ROW_SELECTOR = 'span[role="listitem"][data-display-timestamp]';
const lastSeenTimestamps = new Map(); // row id -> last known data-display-timestamp
let chatBaselineReady = false; // ignore whatever's already there when we start

// Gmail marks the row of whichever conversation you currently have open
// with this class instead of the normal "WD3P7" (found by comparing the
// open row's classes against a closed one). Fragile (an obfuscated class
// Google could rename), but it's the only signal available right now.
const SELECTED_ROW_CLASS = "qs41qe";

function processRow(row) {
  const rowId = row.id || row.getAttribute("data-group-id");
  const timestampStr = row.getAttribute("data-display-timestamp");
  if (!rowId || !timestampStr) return;
  const timestamp = Number(timestampStr);
  const isSelected = row.classList.contains(SELECTED_ROW_CLASS);

  const previous = lastSeenTimestamps.get(rowId);

  if (!chatBaselineReady) {
    // Baseline pass: only ever record the highest timestamp seen so far,
    // since a stale/duplicate DOM node (e.g. the same conversation also
    // shown in an open Thread side-panel) could otherwise regress it.
    if (previous === undefined || timestamp > previous) lastSeenTimestamps.set(rowId, timestamp);
    return;
  }

  if (previous === undefined) {
    lastSeenTimestamps.set(rowId, timestamp);
    return; // first time seeing this row (e.g. scrolled into view) — not a new message
  }

  if (timestamp <= previous) return; // not newer than what we already know — also filters duplicate/stale nodes

  // Keep the row's recorded timestamp current even while it's selected —
  // otherwise leaving it stale here would look like a batch of "new"
  // messages just arrived the moment you switch to another conversation.
  lastSeenTimestamps.set(rowId, timestamp);

  if (isSelected) return; // currently viewing this conversation — no alarm needed

  // Row ids can get recycled for different content when Gmail re-renders
  // the list (switching Home/Thread view, scrolling, etc.), which looks
  // like a "changed timestamp" but is really old history being redisplayed.
  // A genuine new message's timestamp is always close to right now.
  const RECENT_WINDOW_MS = 2 * 60 * 1000;
  if (Date.now() - timestamp > RECENT_WINDOW_MS) return;

  const NOISE_PHRASES = [
    /Open in a pop-?up/gi,
    /\bOptions\b/gi,
    /\bPinned\b/gi,
    /\bMuted\b/gi,
    /\bAway\b/gi,
    /\bActive\b/gi,
    /\bUnread\b/gi,
    /\bNotification\b/gi,
    /\bDo not disturb\b/gi,
  ];
  let text = (row.innerText || "").replace(/\s+/g, " ").trim();

  // Your own outgoing message updates the same "last activity" timestamp
  // as an incoming one — Gmail's own list prefixes your own last message
  // with "You:" in the preview, so use that to skip self-sent messages.
  if (/\bYou:/i.test(text)) return;

  for (const phrase of NOISE_PHRASES) text = text.replace(phrase, "");
  text = text.replace(/(^|\s)\d+(?=\s|$)/g, " "); // strip standalone unread-count digits
  text = text.replace(/\s+/g, " ").trim();

  console.log("[Chat Alarm] DOM watcher detected change:", rowId, previous, "->", timestamp, "|", text);
  if (!text) return;

  handleMatch(text.split(" ").slice(0, 6).join(" "), text);
}

function scanChatRows() {
  if (!isExtensionContextValid()) return shutDownOrphanedScript();
  const rows = document.querySelectorAll(ROW_SELECTOR);
  console.log("[Chat Alarm] DOM watcher scan:", rows.length, "row(s) found");
  rows.forEach(processRow);
}

let scanPending = false;
function scheduleScan() {
  if (scanPending) return;
  scanPending = true;
  setTimeout(() => {
    scanPending = false;
    scanChatRows();
  }, 400);
}

function startChatListWatcher() {
  scanChatRows(); // baseline pass, no alarms yet
  chatBaselineReady = true;

  chatListObserver = new MutationObserver(scheduleScan);
  chatListObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-display-timestamp"],
  });
}

function waitForChatListThenStart() {
  if (!isExtensionContextValid()) return;
  if (document.querySelector(ROW_SELECTOR)) {
    console.log("[Chat Alarm] DOM watcher: chat list found, starting.");
    startChatListWatcher();
  } else {
    setTimeout(waitForChatListThenStart, 2000);
  }
}

waitForChatListThenStart();
