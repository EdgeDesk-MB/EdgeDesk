# Vercel import stuck — bypasses

GitHub App access to `EdgeDesk-MB/EdgeDesk` is fine. If **Import** does nothing, use one of these.

## Fix A — Direct create URL (try first)

1. Open this while logged into Vercel as team **edgeways**:

https://vercel.com/new?teamSlug=edgeways

2. Or the clone-style flow:

https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEdgeDesk-MB%2FEdgeDesk&project-name=edgeways-app&root-directory=edgeways

3. Set **Root Directory** to `edgeways` if the form asks.

## Fix B — CLI (most reliable when UI hangs)

In Terminal:

```bash
cd "/Users/samhayter/Documents/MB app build/edgeways"
npx vercel@latest login
npx vercel@latest link --scope edgeways --yes
npx vercel@latest --scope edgeways
```

`login` opens a browser. After link, the first `vercel` deploy creates the project from this folder (root is already `edgeways`).

Then in the dashboard: **Settings → Git** → Connect `EdgeDesk-MB/EdgeDesk` if not auto-linked, so pushes deploy.

## Fix C — UI checks

- Top-left team must be **edgeways** (Pro), not a personal Hobby account (private org repos can silently fail there)
- Incognito / disable ad blockers
- Browser console (F12) — look for red errors / GitHub **403** rate limit; wait 5 min and retry
- Account Settings → Login Connections → disconnect/reconnect GitHub (only one GitHub account per Vercel user)

When a project appears, tell me the name/`*.vercel.app` URL.
