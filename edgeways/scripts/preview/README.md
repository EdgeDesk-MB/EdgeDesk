# Preview checks (EDGE-226)

Headless Chromium journeys against every Vercel **Preview** deployment, run
in GitHub Actions by `.github/workflows/preview-checks.yml`. Production
deployments only take the visual baseline (see Visual regression).

## What runs

Each journey runs at desktop (1280 × 800 at 1×) and mobile (390 × 844 at 2×):

- **Home** (`/`) and **Sign-in page** (`/login`), signed out.
- **Signed-in desk**, `agent-customer`: sign in, then desk, offers, history
  and settings.
- **First-time desk**, `agent-new`: sign in, then the desk.

Sign-in uses the dev Clerk test accounts from the root `AGENTS.md` with the
test code `424242`. Previews use the development Clerk instance and are not
behind Vercel protection, so no secret is needed.

**Screenshots are public.** The repo is public, so anyone can read the
`preview-checks-assets` branch, the PR comment images and the workflow
artefact. Journeys must only ever sign in as the agent test accounts
(`agent-customer`, `agent-new`, `agent-admin`), never a real customer or
Sam's own login, and must not open pages that show secrets or keys.

On a preview the desk is the hosted (Neon) one, so it may be brand new. The
journeys never assert on seeded data. If the 18+ gate opens it is
screenshotted and confirmed. If a page lands on the setup wizard it is
screenshotted and the journey stops there as a pass, because completing
setup would write accounts to the desk. "Refer a friend" is closed with
"Not now".

## What fails a journey

- The page document is not 200 (signed-out pages) or is 4xx/5xx (signed in).
- The ready element (main landmark, or the Clerk email field on `/login`)
  is not visible within the timeout.
- Sign-in does not leave `/login`, or a signed-in page bounces to `/login`.
- An uncaught app-origin exception, an app 5xx, or a missing `/_next/` asset
  (the filters in `../smoke/noise.ts`).

App console errors are listed as warnings and do not fail the run. A failing
journey takes a "failed here" screenshot.

## Outputs

- Commit status **Preview checks**: pending while running, then success or
  failure with "N of M journeys passed".
- One PR comment, marked `<!-- preview-checks -->`, edited in place on
  re-runs. Images are served from the `preview-checks-assets` branch, which
  holds the newest 40 runs as one force-pushed commit and has Vercel
  deployments switched off.
- With the `LINEAR_API_KEY` repository secret set, one comment on the
  ticket named in the branch (`edge-123`), starting with `**Screenshots**`.
  Images are uploaded to Linear. Without the secret, or with no ticket in
  the branch, this is skipped. A Linear error is a warning only.
- The workflow artefact holds `results.json` and every PNG for 14 days.

No secret is printed. Response URLs in errors have their query strings
removed, because Clerk handshake tokens travel there.

## Visual regression (EDGE-228)

Every screenshot is compared with a baseline of the same page on `main`.
A difference is listed for Sam to judge, it never fails the status.

- **Baseline.** Each successful Production deployment runs the signed-out
  journeys (home and sign-in) against `https://edgeways.app` (override
  with the `PREVIEW_BASELINE_URL` repository variable) and replaces
  `baseline/` on `preview-checks-assets` with the PNGs and
  `baseline.json`. The production domain, not the deployment URL, because
  live Clerk only loads on its configured domains. Only journeys that
  passed are baselined. To seed one by hand, run the workflow with
  `baseline` ticked and `preview_url` set to `https://edgeways.app`.
- **Signed-in pages are not compared.** Production uses the live Clerk
  instance, where the agent test accounts do not exist, so main has no
  signed-in baseline. The comment says how many were skipped. A baseline
  never contains an account.
- **Comparison.** `visual.ts compare` pairs screenshots by journey,
  viewport and label, and diffs pixels in Node (`png.ts`, zlib only, no
  image dependency). A pixel differs above pixelmatch's YIQ threshold of
  0.1; a screenshot is flagged when over 0.1% of its pixels differ. Also
  flagged: a new screenshot in a baselined journey, and a baseline
  screenshot the branch no longer reaches.
- **Masking.** Every screenshot freezes animations, hides the caret, and
  paints magenta over `time`, `canvas`, NumberFlow, toasts and anything
  marked `data-visual-mask`. Add that attribute to a clock, live score or
  odds element that shows up on a journey page. Clerk's "Development
  mode" strip, previews only, is hidden while the screenshot is taken.
- **Outputs.** `visual.json` in the artefact; for each flagged screenshot,
  `diff-<key>.png` (main, this branch, difference in red, left to right),
  embedded in the PR comment under **Visual changes** and on the Linear
  Screenshots comment after "Check these". The status description adds
  "N visual changes to check".

Local run, from `edgeways/`:

```bash
npm run -s preview:journeys -- --base-url https://edgeways.app --out /tmp/base --baseline
RESULTS_DIR=/tmp/base npm run -s preview:visual -- manifest
npm run -s preview:journeys -- --base-url https://<preview>.vercel.app --out /tmp/pr
RESULTS_DIR=/tmp/pr npm run -s preview:visual -- compare --baseline-dir /tmp/base/baseline
```

## Token scope

The repo is public and `main` is unprotected, so the workflow is split:

- **Mark pending**: `statuses: write` only, sets the pending status.
- **Run journeys**: read-only, and no step gets a GitHub token (the
  checkout does not keep credentials). It fetches the baseline
  anonymously, runs the preview's code, compares, and uploads the
  artefact.
- **Publish results**: the only job with `contents: write`,
  `pull-requests: write`, `issues: write` and `statuses: write`. It
  downloads the artefact, pushes the screenshots, posts the comments and
  sets the final status. It fails when a journey fails.

## Redirects

A signed-in page that redirects while loading (for example `/desk` to the
setup wizard) aborts the first navigation. That is a normal landing: the
journey waits for the page the app sent it to and notes where it landed.

## Run locally

From `edgeways/`, once per machine `npx playwright install chromium`, then:

```bash
npm run -s preview:journeys -- --base-url https://<preview>.vercel.app
npm run -s preview:journeys -- --base-url https://<preview>.vercel.app --extra-path /definitely-missing   # fails, exit 1
```

Options: `--out` (default `artifacts/preview-checks`), `--timeout` per step
in ms (default 30000), `--extra-path` adds a signed-out page, repeatable.
`AGENT_CUSTOMER_EMAIL`, `AGENT_NEW_EMAIL` and `CLERK_TEST_CODE` override the
defaults.

To prove the failure path on GitHub, run the workflow by hand (Actions,
Preview checks, Run workflow) with a preview URL and `extra_path` set to
`/definitely-missing`. The status goes red.
