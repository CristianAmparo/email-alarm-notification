const params = new URLSearchParams(window.location.search);
document.getElementById("ruleName").textContent = `🔔 ${params.get("ruleName") || "Chat Alarm"}`;
document.getElementById("title").textContent = params.get("title") || "";
document.getElementById("body").textContent = params.get("body") || "";

function stop() {
  chrome.runtime.sendMessage({ type: "stop-alarm" });
  window.close();
}

document.getElementById("stopBtn").addEventListener("click", stop);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    stop();
  }
});
