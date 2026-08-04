/**
 * Betdaq betslip filler. FILL ONLY - this script NEVER clicks place/confirm;
 * the user always places the bet on the exchange's own button.
 *
 * Selector maps are versioned and expected to break when Betdaq ships a new
 * DOM: every lookup fails LOUD via an on-page banner, and the stake is
 * already on the user's clipboard (Edgeways copies before emitting).
 */
const SELECTOR_MAP_VERSION = "betdaq-2026-07";
const SELECTORS = {
  // Ordered candidates - first match wins.
  stakeInputs: [
    'input[data-testid="betslip-stake-input"]',
    'input[name="stake"]',
    ".betslip input[type=number]",
    "#betslip input[type=text]",
  ],
  searchInputs: ['input[type="search"]', 'input[placeholder*="Search"]'],
};

function firstMatch(candidates) {
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function banner(text, ok) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:2147483647;padding:10px 14px;" +
    "border-radius:8px;font:13px/1.4 system-ui;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.3);" +
    (ok ? "background:#166534;" : "background:#991b1b;");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function setNativeValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "fill-slip") return;
  const { selection, stake, side } = message.intent ?? {};

  // Selection search assist: type the selection into the site search so the
  // user can jump to the market. Optional - the stake is the critical part.
  if (selection) {
    const search = firstMatch(SELECTORS.searchInputs);
    if (search) setNativeValue(search, selection);
  }

  const stakeInput = firstMatch(SELECTORS.stakeInputs);
  if (stakeInput && typeof stake === "number") {
    setNativeValue(stakeInput, stake.toFixed(2));
    stakeInput.focus();
    banner(
      `Edgeways filled ${side === "back" ? "back" : "lay"} stake £${stake.toFixed(2)} - check odds and place it yourself.`,
      true
    );
  } else {
    banner(
      `Edgeways couldn't find the betslip (map ${SELECTOR_MAP_VERSION}) - the stake is on your clipboard.`,
      false
    );
  }
});
