const rulesBody = document.getElementById("rulesBody");

function newRowId() {
  return `r${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function addRow(rule) {
  rule = rule || { id: newRowId(), enabled: true, label: "", value: "", type: "contains" };
  const tr = document.createElement("tr");
  tr.dataset.id = rule.id;
  tr.innerHTML = `
    <td><input type="checkbox" class="enabled" ${rule.enabled ? "checked" : ""}></td>
    <td><input type="text" class="label" value="${escapeHtml(rule.label)}" placeholder="e.g. Support group"></td>
    <td><input type="text" class="value" value="${escapeHtml(rule.value)}" placeholder="e.g. SUPPORT-PRODUCTION" ${rule.type === "any" ? "disabled" : ""}></td>
    <td>
      <select class="type">
        <option value="contains" ${rule.type === "contains" ? "selected" : ""}>Contains text</option>
        <option value="exclude" ${rule.type === "exclude" ? "selected" : ""}>Exclude (never alarm)</option>
        <option value="any" ${rule.type === "any" ? "selected" : ""}>Match any</option>
      </select>
    </td>
    <td class="row-actions"><button class="delete">✕</button></td>
  `;
  tr.querySelector(".delete").addEventListener("click", () => tr.remove());
  const typeSelect = tr.querySelector(".type");
  const valueInput = tr.querySelector(".value");
  typeSelect.addEventListener("change", () => {
    valueInput.disabled = typeSelect.value === "any";
  });
  rulesBody.appendChild(tr);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function collectRules() {
  return Array.from(rulesBody.querySelectorAll("tr")).map((tr) => ({
    id: tr.dataset.id,
    enabled: tr.querySelector(".enabled").checked,
    label: tr.querySelector(".label").value.trim(),
    value: tr.querySelector(".value").value.trim(),
    type: tr.querySelector(".type").value,
  }));
}

document.getElementById("addRow").addEventListener("click", () => addRow());

document.getElementById("saveBtn").addEventListener("click", async () => {
  const rules = collectRules();
  await chrome.storage.local.set({ rules });
  const status = document.getElementById("status");
  status.textContent = "Saved.";
  setTimeout(() => (status.textContent = ""), 1500);
});

(async function init() {
  const { rules = [] } = await chrome.storage.local.get("rules");
  if (rules.length === 0) {
    addRow({ id: newRowId(), enabled: false, label: "Everything", value: "", type: "any" });
  } else {
    rules.forEach(addRow);
  }
})();

// --- Alarm sound picker ---

const DEFAULT_SOUND_URL = chrome.runtime.getURL("mixkit-classic-winner-alarm-1997.wav");
const soundNameEl = document.getElementById("soundName");
const previewAudio = document.getElementById("previewAudio");

async function refreshSoundName() {
  const { alarmSoundName } = await chrome.storage.local.get("alarmSoundName");
  soundNameEl.textContent = alarmSoundName || "Default (mixkit-classic-winner-alarm)";
}

document.getElementById("soundFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    await chrome.storage.local.set({
      alarmSoundDataUrl: reader.result,
      alarmSoundName: file.name,
    });
    refreshSoundName();
  };
  reader.readAsDataURL(file);
});

document.getElementById("previewBtn").addEventListener("click", async () => {
  const { alarmSoundDataUrl } = await chrome.storage.local.get("alarmSoundDataUrl");
  previewAudio.src = alarmSoundDataUrl || DEFAULT_SOUND_URL;
  previewAudio.loop = true;
  previewAudio.play();
});

document.getElementById("stopPreviewBtn").addEventListener("click", () => {
  previewAudio.pause();
  previewAudio.currentTime = 0;
});

document.getElementById("resetSoundBtn").addEventListener("click", async () => {
  await chrome.storage.local.remove(["alarmSoundDataUrl", "alarmSoundName"]);
  refreshSoundName();
});

refreshSoundName();

// --- Auto-stop ---

const DEFAULT_AUTO_STOP_SECONDS = 60;
const autoStopInput = document.getElementById("autoStopSeconds");
const autoStopStatus = document.getElementById("autoStopStatus");

(async function initAutoStop() {
  const { autoStopSeconds } = await chrome.storage.local.get("autoStopSeconds");
  autoStopInput.value = autoStopSeconds === undefined ? DEFAULT_AUTO_STOP_SECONDS : autoStopSeconds;
})();

document.getElementById("saveAutoStopBtn").addEventListener("click", async () => {
  const seconds = Math.max(0, parseInt(autoStopInput.value, 10) || 0);
  autoStopInput.value = seconds;
  await chrome.storage.local.set({ autoStopSeconds: seconds });
  autoStopStatus.textContent = "Saved.";
  setTimeout(() => (autoStopStatus.textContent = ""), 1500);
});
