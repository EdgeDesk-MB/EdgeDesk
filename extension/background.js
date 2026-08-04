/**
 * Routes a fill intent from an Edgeways tab to the exchange tab. Focuses
 * the first open Betdaq tab; if none is open we do nothing (the stake is
 * already on the clipboard - Edgeways said so in its toast).
 */
chrome.runtime.onMessage.addListener((message, _sender) => {
  if (message?.type !== "edgeways-fill-slip") return;
  chrome.tabs.query({ url: "https://*.betdaq.com/*" }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    chrome.tabs.update(tab.id, { active: true });
    chrome.tabs.sendMessage(tab.id, { type: "fill-slip", intent: message.intent });
  });
});
