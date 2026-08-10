---
name: error-triage
description: Cadence for reviewing NEW PostHog error issues and filing the worthwhile ones to Linear (EDGE-42). Use on a scheduled loop (e.g. /loop 1d), when Sam says "triage errors", or when error volume is mentioned. Spikes are already auto-filed by the PostHog→Linear alert (EDGE-35) — this catches everything else.
---

# Error triage cadence (PostHog → Linear)

The PostHog project ("Edgeways app", EU) captures unhandled exceptions from
the app. A PostHog-native alert auto-files **spiking** issues to Linear; this
loop is the human-paced sweep for new issues that never spike.

## Procedure

1. **List new issues** via the PostHog MCP (`query-error-tracking-issues-list`),
   newest first. Skip any already marked resolved/ignored in PostHog.
2. **Dedupe before drafting.** For each candidate, search Linear
   (`list_issues` with a query) for the error signature (type + top frame).
   If a ticket exists, comment the fresh occurrence count there instead of
   filing a duplicate.
3. **Inspect** (`query-error-tracking-issue` + a sample event): error type,
   message, top app frame, first/last seen, occurrence count, affected page.
4. **Draft one Linear issue per genuinely new problem:**
   - Title: `[Error] <type>: <short message>` (e.g. `[Error] TypeError: Cannot read properties of null`)
   - Body: first/last seen, count, page/route, top frame, PostHog issue link,
     and a one-line hypothesis if obvious
   - Labels: `Bug`, `Feedback` not required; project "Launch QA & Polish"
5. **Present drafts and wait for approval** — this cadence never auto-files;
   the spiking alert is the only automatic filer. On approval, create the
   issues and resolve (or assign) the PostHog issue so it drops out of the
   next sweep.

## Judgement calls

- **Transient dev-server noise** (HMR reconnects, 404s during restarts) —
  resolve in PostHog without a ticket.
- **One-off, single-occurrence errors** with no user impact — note in the
  sweep summary, don't file.
- **Anything touching calc/settlement/balances** — always file, label `Bug`,
  and flag that the calc-change workflow applies to the fix.
