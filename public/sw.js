/* nudge service worker — web push (app notifications) + installability. */

// A no-op fetch handler so the app meets PWA installability criteria
// (required for the share target to appear in the system share sheet).
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "nudge", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "nudge";
  // Offer one-tap actions when the push is about a specific task.
  const actions = data.taskId
    ? [
        { action: "done", title: "✓ Done" },
        { action: "snooze", title: "Snooze 1h" },
      ]
    : [];
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/",
      taskId: data.taskId,
      doneStatus: data.doneStatus || "done",
    },
    tag: data.tag || data.taskId,
    actions,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Pad a number to 2 digits for the snooze date/time payload.
function pad(n) {
  return String(n).padStart(2, "0");
}

self.addEventListener("notificationclick", (event) => {
  const d = event.notification.data || {};
  event.notification.close();

  // Action buttons: complete or snooze the task without opening the app.
  if (event.action === "done" && d.taskId) {
    event.waitUntil(
      fetch(`/api/tasks/${d.taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: d.doneStatus || "done" }),
      }).catch(() => {}),
    );
    return;
  }
  if (event.action === "snooze" && d.taskId) {
    const t = new Date(Date.now() + 60 * 60 * 1000); // +1 hour
    const date = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    const time = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
    event.waitUntil(
      fetch(`/api/tasks/${d.taskId}/snooze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, time }),
      }).catch(() => {}),
    );
    return;
  }

  // Default tap: focus/open the app at the relevant page.
  const url = d.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
