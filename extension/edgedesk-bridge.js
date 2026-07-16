/**
 * EdgeDesk → extension bridge. EdgeDesk pages dispatch a CustomEvent
 * ("edgedesk:fill-slip") with the intent payload; this relays it to the
 * service worker. EdgeDesk ALWAYS copies the stake to the clipboard first,
 * so a missing/broken extension degrades gracefully.
 */
document.addEventListener("edgedesk:fill-slip", (event) => {
  const detail = event.detail;
  if (!detail || typeof detail !== "object") return;
  chrome.runtime.sendMessage({ type: "edgedesk-fill-slip", intent: detail });
});
