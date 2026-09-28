# Production smoke (EDGE-217)

A headless Chromium pass over the signed-out pages, run after every
production deploy. It never signs in and never writes data.

## Setup

Once per machine, from `edgeways/`:

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npm run -s smoke:prod                                   # https://edgeways.app
npm run -s smoke:prod -- --base-url https://<preview>.vercel.app
npm run -s smoke:prod -- --extra-path /definitely-missing   # should fail, exit 1
```

Use `-s` so npm does not print its banner, then stdout is one JSON object and
nothing else. Options:

- `--base-url` (default `https://edgeways.app`). A path prefix is kept, so
  `https://edgeways.app/nope` smokes `/nope/demo` and so on.
- `--extra-path` adds a page, repeatable.
- `--timeout` per page, in ms (default 30000).

## Pages

`/`, `/demo`, `/desk?demo=1&view=edge`, `/calculators/matched` and
`/#pricing`. Pricing is a section of the home page, there is no `/pricing`
route, so that entry also waits for `#pricing` to be visible.

## What fails a page

- The document status is not 200.
- No visible `main` landmark within the timeout.
- An app-origin console error, for example React #418.
- An uncaught exception whose stack touches the app origin, or has no stack.
- An app-origin 5xx response, or a 4xx on a `/_next/` asset.
- A timeout or network failure, reported as `Smoke unavailable: ...`.

Not counted: Chromium's "Failed to load resource" lines (signed-out APIs
answer 401/403 by design, the response check covers real failures), errors
from other origins, and the allowlist in `noise.ts`: browser extensions,
Tabee, Datadog `contentScript.js` and CSP `unsafe-eval` reports.

`ms` is the time from navigation start until the main landmark is visible.

The browser identifies as normal Chrome plus `EdgewaysSmoke/1`, because
PostHog drops `HeadlessChrome` as a bot and the analytics check relies on
these pageviews.

## Output

```json
{
  "ok": true,
  "baseUrl": "https://edgeways.app",
  "startedAt": "2026-09-28T15:25:35.862Z",
  "pages": [
    { "path": "/", "status": 200, "ok": true, "ms": 393, "errors": [] }
  ]
}
```

Exit code 0 when every page passes, else 1. If Chromium cannot launch, or the
arguments are wrong, `pages` is empty and `error` says why.
