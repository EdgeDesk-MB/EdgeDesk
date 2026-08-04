/**
 * Edgeways → extension bridge. Edgeways pages dispatch a CustomEvent
 * ("edgeways:fill-slip") with the intent payload; this relays it to the
 * service worker. Edgeways ALWAYS copies the stake to the clipboard first,
 * so a missing/broken extension degrades gracefully.
 */
document.addEventListener("edgeways:fill-slip", (event) => {
  const detail = event.detail;
  if (!detail || typeof detail !== "object") return;
  chrome.runtime.sendMessage({ type: "edgeways-fill-slip", intent: detail });
});
