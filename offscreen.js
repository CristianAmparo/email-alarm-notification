// Offscreen documents are allowed to autoplay audio even with no visible tab
// or user gesture — that's the whole reason this file exists instead of
// trying to play a sound from the service worker or the alarm popup.
// It starts playing the moment it's created and stops when the background
// script closes this document (chrome.offscreen.closeDocument).
//
// Note: offscreen documents don't reliably have direct access to
// chrome.storage, so we ask the background service worker for the sound
// instead of reading storage here directly.

const DEFAULT_SOUND_URL = chrome.runtime.getURL("mixkit-classic-winner-alarm-1997.wav");

chrome.runtime.sendMessage({ type: "get-alarm-sound" }, (response) => {
  const src = (response && response.alarmSoundDataUrl) || DEFAULT_SOUND_URL;
  const audio = new Audio(src);
  audio.loop = true;
  audio.play().catch((e) => console.error("Chat Alarm: audio play failed", e));
});
