# Chat Alarm

A browser extension that rings a loud, must-dismiss alarm when a Google Chat
message (inside Gmail) matches your filters — a specific person, a specific
group/space, everyone except certain people, or any message at all.

It works by watching for the native browser notifications Gmail/Google Chat
already creates for new messages — no Google API, no OAuth, no Workspace
admin approval needed, since it never calls Google's servers itself.

## How it works
- `inject.js` runs inside the Gmail page itself and wraps `Notification` so
  we see the title/body Gmail generates for every new chat notification.
- `content.js` checks that title against your saved rules.
- On a match, `background.js` opens a centered popup with a **Stop Alarm**
  button and starts looping a sound (via an offscreen document, so it plays
  even if the Gmail tab isn't focused).

**Limitation:** Gmail generally only creates a notification when you're
*not* actively looking at that specific conversation. If the chat is open
and focused on screen, it won't alarm — that's Gmail's own behavior, not a
bug in the extension.

---

## Step-by-step setup

### 1. Load the extension
1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (toggle, top right).
3. Click **Load unpacked** and select the extention folder:
   ex. `D:\Users\Desktop\alarmNotification`.
4. You should see a **Chat Alarm** card with a red bell icon. Keep this
   `chrome://extensions` tab around — you'll come back to it for
   reloading/debugging.
5. Requires a recent Chrome/Edge (111+), needed for the content script's
   `world: "MAIN"` support.

### 2. Turn on Chat notifications in Gmail
1. Open `mail.google.com` and open the **Chat** panel (left sidebar).
2. Click the gear/settings icon near the top of the Chat panel (not Gmail's
   main Settings) and make sure new message notifications are turned **on**
   (not muted/"Nothing").

### 3. Grant the browser notification permission
This is the step most likely to trip you up — Gmail silently skips creating
a notification at all if this isn't granted, so nothing will ever reach the
extension.

1. On the Gmail tab, click the site-info icon just left of the URL in the
   address bar (padlock / tune / "ⓘ" icon depending on browser).
2. Look for **Notifications** in that panel. If you don't see it directly,
   click **Site settings** (or **Site permissions**) to open the full list
   for `mail.google.com`, then find **Notifications** there.
3. Set it to **Allow**.
4. If a banner appears saying *"To see settings updates, refresh the
   page"*, click **Refresh** (or press F5).
5. Verify it worked: open DevTools (`F12`) → **Console** tab on the Gmail
   tab, type `Notification.permission`, press Enter — it should print
   `'granted'`. If it still says `'default'`, the permission change hasn't
   applied yet — refresh the tab again.

### 4. Set your filters
Click the extension's toolbar icon (pin it via the puzzle-piece icon if you
don't see it) → **Edit filters**, or right-click the icon → **Options**.

For each rule, fill in:
- **Label** — just a name for your own reference (e.g. "Support group").
- **Match text** — text to look for in the sender/group name shown in the
  chat notification (e.g. `Jaypee` or `SUPPORT-PRODUCTION`).
- **Type**:
  - **Contains text** — alarms only when the match text is found.
  - **Exclude (never alarm)** — never alarms for this match, and always
    wins over other rules regardless of row order.
  - **Match any** — alarms on every message (ignores match text).

Common setups:
- *Only specific people/groups:* add one **Contains text** rule per
  person/group you care about, nothing else.
- *Everything except certain people:* add an **Exclude** rule per person you
  want to silence, then one **Match any** rule below it as the catch-all.

Click **Save** when done.

### 5. Choose the alarm sound (optional)
Still on the Options page, scroll to **Alarm sound**:
- **Choose File** to upload your own sound, then **▶ Preview** to hear it
  and **■ Stop** to stop the preview.
- **Reset to default** to go back to the bundled sound.

### 6. Test it
**Quick test (no need to wait for a real message):** on the Gmail tab
console, run:
```js
new Notification('Some Name', {body: 'test message'})
```
(Chrome may show a "Don't paste code you don't understand" warning first —
type `allow pasting` and press Enter, then run the command again.) If your
rules match `'Some Name'`, the alarm popup + sound should fire immediately.
This confirms the extension itself is wired correctly, independent of
Gmail.

**Real test:** keep the Gmail tab open (background tab is fine, just not
closed, and don't have the matching conversation actively open/focused) and
have someone send a matching message.

### After any code change
Whenever these files change, both steps below are required — reloading the
extension alone is not enough, since already-open tabs keep their old
content scripts:
1. `chrome://extensions` → click **Reload** on the Chat Alarm card.
2. Refresh the Gmail tab itself (F5).

## Troubleshooting
- **Alarm popup appears but no sound** — check the offscreen document's own
  console: on the Chat Alarm card, click **Errors** (if present) or find
  "Inspect views: offscreen.html" while the alarm is active and check its
  Console tab.
- **Nothing happens at all, even the manual test** — check
  `chrome://extensions` → Chat Alarm card → **Errors**, and the
  **service worker** console link, for exceptions.
- **Manual test works but real messages don't trigger it** — almost always
  step 3 (notification permission) not actually granted yet, or you were
  actively viewing that conversation when the message arrived.

## Limitations
- Requires the Gmail tab to be open somewhere in the browser — it can't wake
  a fully closed browser.
- Relies on Gmail's own notification content, so if Google changes how chat
  notifications are generated, matching may need small adjustments.
- Only covers Google Chat inside Gmail for now — plain email isn't handled
  by this version.
