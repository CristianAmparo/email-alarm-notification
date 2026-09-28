// Isolated-world content script: receives the relayed notification data from
// inject.js, checks it against the user's saved rules, and asks the
// background service worker to ring the alarm on a match.

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

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || !data.__chatAlarmExt) return;

  const { rules = [] } = await chrome.storage.local.get("rules");
  const rule = matchRule(data.title || "", rules);
  if (!rule) return;

  chrome.runtime.sendMessage({
    type: "chat-alarm-match",
    ruleName: rule.label || rule.value || "Match",
    title: data.title || "",
    body: data.body || "",
  });
});
