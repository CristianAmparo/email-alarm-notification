document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("stopAllBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "force-stop-all" });
});
