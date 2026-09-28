// Service worker: coordinates the offscreen audio player and the alarm popup.

async function ensureOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Loop an alarm tone until the user dismisses it.",
  });
}

async function stopOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) await chrome.offscreen.closeDocument();
}

async function centeredBounds(width, height) {
  try {
    const win = await chrome.windows.getLastFocused();
    return {
      left: Math.round(win.left + (win.width - width) / 2),
      top: Math.round(win.top + (win.height - height) / 2),
    };
  } catch (e) {
    return {};
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "chat-alarm-match") {
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
      chrome.windows.create({
        url: `alarm.html?${params.toString()}`,
        type: "popup",
        width,
        height,
        left,
        top,
      });
    } else if (message.type === "stop-alarm") {
      await stopOffscreenDocument();
    } else if (message.type === "get-alarm-sound") {
      const { alarmSoundDataUrl } = await chrome.storage.local.get("alarmSoundDataUrl");
      sendResponse({ alarmSoundDataUrl });
      return;
    }
    sendResponse?.();
  })();
  return true;
});
