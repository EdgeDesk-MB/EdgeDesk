# Offer paste learning (self-improving capture)

**Status:** design intent / not built yet  
**Scope:** how Edgeways should improve offer paste parsing over time without
jumping straight to cloud ML or multi-tenant training.

Related code today: `src/lib/offers/parse-offer-text.ts`,
`src/lib/offers/offer-intelligence/`, `src/components/paste-capture.tsx`,
inline paste on the offer editor and casino log dialogs.

---

## Goal

Customers (and Sam first) paste promo emails / MBB text / screenshots. The
parser fills the form. People correct mistakes. The product should **learn from
those corrections** so the next similar paste needs fewer edits, and so we can
say things like: “From 50 new pastes, title edit rate fell 18% → 12%.”

That scoreboard is product analytics over corrections. It is not a neural net
by default.

---

## What we will not do first

- Train a large model on every customer paste from day one
- Silent cloud upload of promo text without explicit opt-in
- Replace the deterministic parser with an opaque LLM as the only path
- Heavy OCR R&D (still optional fallback; see `offer-command-centre.md`)

The parser + offer-intelligence archetypes stay the source of truth. Learning
feeds **rules and scoreboards**, then optionally models later.

---

## Phased approach

### Phase 1 — Local correction log (do this first)

On offer / casino save after paste, persist a row (SQLite, local-first):

| Field | Purpose |
| --- | --- |
| `rawPaste` | Text / OCR merge the user applied |
| `parsedDraft` | JSON snapshot from `parseOfferFromText` (or casino twin) |
| `finalForm` | What was actually saved |
| `fieldDiffs` | Keys the user changed after paste (`title`, `minStake`, …) |
| `bookmaker`, `category`, `archetype` | Cheap facets for grouping |
| `createdAt` | When |

Sam’s own uploads alone are enough to start. No multi-user sync required.

**Operator scorecard (examples):**

- Title needed edits: 18 / 50 pastes (36%)
- After a title-format fix lands: 6 / 50 (12%) → “confidence / quality +N”
- Min stake missed on deposit-gated football: count by bookie

Ship as a small Settings or internal “Paste quality” panel before any customer
facing ML language.

### Phase 2 — Rule promotion from corrections

When the same miss repeats (e.g. Dynobet “worth of bets”, reward-only titles,
monthly-cap false free-bet amounts):

1. Cluster diffs by bookie + archetype + field
2. Promote a parser or intelligence rule with a regression test from a real paste
3. Re-score the correction log against the new parser (offline replay)

This is how “confidence” actually goes up in a way we can trust.

### Phase 3 — Optional real ML (later)

Only after hundreds of paste → final pairs exist:

- Embeddings for bookie / archetype clustering and “similar pastes”
- Small local model for messy OCR cleanup (optional)
- Customer contribution only with explicit opt-in and clear retention rules

Cloud fine-tuning is optional and not on the critical path.

---

## Confidence today vs learning later

**Parse confidence** (`high` / `medium` / `low` on the draft) is a heuristic:
stake + free bet + bookie present, etc. It is genuine but coarse.

**Form readiness** (required-field progress bar) is separate: title/stakes,
bookie, expiry, qualifier stake, min odds, reward. It answers “can I save and
run this campaign?”, not “how clever was the parse?”.

**Learning scoreboard** would be a third signal: edit rates over a window of
pastes, before/after rule ships. That is the “confidence can improve 2 points”
story, grounded in measured corrections.

---

## Title format (standard campaign titles)

Process-first, not reward-only. Preferred patterns:

| Offer type | Preferred title |
| --- | --- |
| Bet & get free bet | `Bet £X get £Y free bet (Sport)` |
| Racing place refund | `Bet £X get £Y free bet (2nd–4th)` |
| Money back | `Money Back 2nd & 3rd` |
| Extra place | `Paying 4 places instead of 3` |
| Acca / multiples | `Bet £X Acca get £Y free bet (Sport)` (not wired yet) |
| Bet builder | `Bet £X Bet builder get £Y free bet (Sport)` (not wired yet) |
| Deposit + bet & get | Bet/get in the title; deposit in Important / playbook |
| Reward-only (no qual stake) | `£Y free bet (Sport)` |
| Casino | Casino-specific wording (`£Y casino reward`, spins, etc.) |

Implemented in `buildOfferTitle` inside `parse-offer-text.ts`. Racing already
used process-first titles; non-racing sports now match.

---

## Privacy

1. Local log by default (Sam / single-tenant home server)
2. Any multi-customer learning pool requires opt-in copy and a retention policy
3. Prefer shipping anonymised field-diff stats over raw email bodies when syncing

---

## Suggested first build slice

1. Table + write path on save-after-paste  
2. Replay script: re-parse stored `rawPaste`, compare to `finalForm`  
3. Tiny dashboard: top edited fields, top bookies, before/after a known fix  
4. Acca / Bet builder title grammar once 5–10 real pastes exist  

Do not block paste UX on ML. The correction log is the learning substrate.
