# Preview checks (EDGE-226)

Headless Chromium journeys against every Vercel **Preview** deployment, run
in GitHub Actions by `.github/workflows/preview-checks.yml`. Production
deployments are ignored.

## What runs

Each journey runs at desktop (1280 × 800 at 1×) and mobile (390 × 844 at 2×):

- **Home** (`/`) and **Sign-in page** (`/login`), signed out.
- **Signed-in desk**, `agent-customer`: sign in, then desk, offers, history
  and settings.
- **First-time desk**, `agent-new`: sign in, then the desk.

Sign-in uses the dev Clerk test accounts from the root `AGENTS.md` with the
test code `424242`. Previews use the development Clerk instance and are not
behind Vercel protection, so no secret is needed.

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
