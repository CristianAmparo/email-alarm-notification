// Service worker: coordinates the offscreen audio player and the alarm popup.

async function ensureOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Loop an alarm tone until the user dismisses it.",
    });
  } catch (e) {
    // Two frames (mail.google.com + chat.google.com) can both trigger a
    // match around the same time; whichever call loses this race just
    // reuses the offscreen document the other one already created.
    if (!String(e && e.message).includes("single offscreen document")) throw e;
  }
}

async function stopOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) await chrome.offscreen.closeDocument();
}

// Multiple alarm popups can be open at once (separate messages, more than
// DEDUPE_WINDOW_MS apart). They all share one audio player, so it should
// only stop once every open alarm window has actually been closed —
// however it was closed (Stop button, Enter/Space, auto-stop, or the
// window's own native close button).
//
// Don't track the windows in a module-level variable: MV3 service workers
// are shut down after ~30s idle, which wipes that state, so a window closed
// later (e.g. by auto-stop) would no longer be recognised and the audio
// would keep playing. Ask Chrome which alarm pages are open instead.
const ALARM_PAGE_URL = chrome.runtime.getURL("alarm.html");

async function getOpenAlarmWindowIds() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
  const tabIds = [
    ...new Set(
      contexts
        .filter(
          (context) =>
            context.documentUrl?.startsWith(ALARM_PAGE_URL) &&
            Number.isInteger(context.tabId)
        )
        .map((context) => context.tabId)
    ),
  ];
  const windowIds = await Promise.all(
    tabIds.map(async (tabId) => {
      try {
        const tab = await chrome.tabs.get(tabId);
        return tab.windowId;
      } catch (error) {
        if (String(error && error.message).startsWith("No tab with id:")) return undefined;
        throw error;
      }
    })
  );
  return [...new Set(windowIds.filter(Number.isInteger))];
}

chrome.windows.onRemoved.addListener(async () => {
  const remaining = await getOpenAlarmWindowIds();
  if (remaining.length === 0) await stopOffscreenDocument();
});

async function centeredBounds(width, height) {
  try {
    const win = await chrome.windows.getLastFocused();
    const left = Math.round(win.left + (win.width - width) / 2);
    const top = Math.round(win.top + (win.height - height) / 2);
    // A disconnected second monitor can leave stale-but-valid-looking
    // coordinates that would place the popup somewhere off-screen and
    // effectively invisible. Fall back to Chrome's own default placement
    // (on the current display) rather than trust obviously-off values.
    if (left < -50 || top < -50 || left > 10000 || top > 10000) return {};
    return { left, top };
  } catch (e) {
    return {};
  }
}

// The same real message can be detected twice — once by Gmail's own
// Notification() call, once by the DOM watcher — since both run in both
// frames. Ignore a second match that arrives right after the first.
let lastAlarmAt = 0;
const DEDUPE_WINDOW_MS = 4000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "chat-alarm-match") {
      const now = Date.now();
      if (now - lastAlarmAt < DEDUPE_WINDOW_MS) {
        sendResponse?.();
        return;
      }
      lastAlarmAt = now;

      await ensureOffscreenDocument();

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: `Chat alarm: ${message.ruleName}`,
        message: `${message.title}\n${message.body}`,
        priority: 2,
      });

      const params = new URLSearchParams({
        ruleName: message.ruleName,
        title: message.title,
        body: message.body,
      });
      const width = 420;
      const height = 260;
      const { left, top } = await centeredBounds(width, height);
      await chrome.windows.create({
        url: `alarm.html?${params.toString()}`,
        type: "popup",
        width,
        height,
        left,
        top,
      });
    } else if (message.type === "get-alarm-sound") {
      const { alarmSoundDataUrl } = await chrome.storage.local.get("alarmSoundDataUrl");
      sendResponse({ alarmSoundDataUrl });
      return;
    } else if (message.type === "force-stop-all") {
      // Last-resort panic button (toolbar popup) for when an alarm window
      // doesn't render on screen — closes everything unconditionally,
      // even if an alarm window is in a bad state.
      const ids = await getOpenAlarmWindowIds();
      for (const id of ids) {
        try {
          await chrome.windows.remove(id);
        } catch (e) {
          // window may already be gone — fine
        }
      }
      await stopOffscreenDocument();
    }
    sendResponse?.();
  })();
  return true;
});
