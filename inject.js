// Runs in the PAGE's own JS context (world: "MAIN"), before Gmail's scripts run.
// Gmail/Google Chat already builds a native browser Notification for every
// new chat message (title = sender or space name, body = message preview).
// We wrap the Notification constructor so we see that same data the instant
// Gmail creates one, then relay it to our isolated-world content script via
// postMessage (the only way across the world boundary).
(function () {
  const OriginalNotification = window.Notification;
  if (!OriginalNotification || OriginalNotification.__chatAlarmPatched) return;

  function PatchedNotification(title, options) {
    console.log("[Chat Alarm] Notification() called:", title, options && options.body);
    try {
      window.postMessage(
        { __chatAlarmExt: true, title, body: (options && options.body) || "" },
        "*"
      );
    } catch (e) {
      // ignore
    }
    return new OriginalNotification(title, options);
  }

  PatchedNotification.prototype = OriginalNotification.prototype;
  PatchedNotification.permission = OriginalNotification.permission;
  PatchedNotification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
  PatchedNotification.__chatAlarmPatched = true;

  window.Notification = PatchedNotification;
})();
