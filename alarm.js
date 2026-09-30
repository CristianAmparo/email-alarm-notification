const params = new URLSearchParams(window.location.search);
document.getElementById("ruleName").textContent = `🔔 ${params.get("ruleName") || "Chat Alarm"}`;
document.getElementById("title").textContent = params.get("title") || "";
document.getElementById("body").textContent = params.get("body") || "";

function stop() {
  // Just close the window — background.js stops the shared audio player
  // once every open alarm window has closed, however it was closed
  // (this button, Enter/Space, or the window's own native close button).
  window.close();
}

document.getElementById("stopBtn").addEventListener("click", stop);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    stop();
  }
});

const DEFAULT_AUTO_STOP_SECONDS = 60;

chrome.storage.local.get("autoStopSeconds", ({ autoStopSeconds }) => {
  const seconds = autoStopSeconds === undefined ? DEFAULT_AUTO_STOP_SECONDS : autoStopSeconds;
  if (seconds > 0) setTimeout(stop, seconds * 1000);
});
