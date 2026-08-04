# Edgeways Betslip Fill (Chrome MV3)

Fills the exchange betslip from Edgeways with one click. **Fill only — the
extension never places a bet**; you always click the exchange's own confirm.
Betdaq first (Sam's daily exchange); Betfair map to follow.

## Install (unpacked)

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Open Edgeways and a Betdaq tab. Any "Fill slip" button in Edgeways now
   fills the Betdaq stake box (and focuses the tab).

No extension? Every "Fill slip" click also copies the stake to the
clipboard, so nothing is lost.

## How it works

- Edgeways pages dispatch `edgeways:fill-slip` (CustomEvent) with
  `{ side, selection, stake, odds }`.
- `edgeways-bridge.js` (runs on Edgeways origins) relays it to the service
  worker, which focuses the first Betdaq tab and forwards the intent.
- `betdaq-fill.js` fills the stake via a **versioned selector map**
  (`SELECTOR_MAP_VERSION`) and shows an on-page banner. Selector misses fail
  loud — red banner, clipboard already has the stake.

## Manual test protocol (no live Betdaq needed)

1. Load the extension unpacked.
2. Open `fixtures/betdaq-slip.html` in a tab **via a betdaq.com URL rewrite**
   (devtools local overrides) or temporarily add `file:///*` to the manifest
   matches for a local run.
3. In Edgeways, click any "Fill slip" button → the fixture's stake input
   should fill and the green banner appear.
4. Break the fixture's input id → red banner + clipboard fallback.

## Origins

Edgeways origins covered: `http://localhost:3000`, the LAN IP, and
`https://*.ts.net` (Tailscale). Add new origins in `manifest.json`.
