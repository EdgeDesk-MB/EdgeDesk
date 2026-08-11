# Tonight handoff — remaining Sam steps

## Done
- [x] Neon London + `DATABASE_URL` in `.env.local`
- [x] Smoke OK + migrations applied (`npm run db:migrate`)

## Still open (do these now)

### A. Resend API key (~2 min)

1. Open https://resend.com/api-keys
2. **Create API Key** → name `edgeways` → full access → Create
3. Copy `re_…` once
4. In `edgeways/.env.local` add (uncommented):

```text
RESEND_API_KEY=re_…
RESEND_FROM=hello@edgeways.app
```

5. Save — say “Resend saved” (don’t paste the key)

### B. Vercel import (~5–10 min)

1. Open https://vercel.com/edgeways (team **edgeways**)
2. **Add New…** → **Project**
3. Import GitHub repo **`EdgeDesk-MB/EdgeDesk`**  
   (connect GitHub if asked; grant access to that org/repo)
4. **Root Directory** → Edit → `edgeways` → Continue
5. **Deploy** (build may fail on sqlite — still fine)
6. **Settings → Environment Variables** — add for Production **and** Preview:
   - `DATABASE_URL` = same Neon pooled URL as `.env.local`  
     (skip if Neon integration already injected it)
   - `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` = from `.env.local`
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.posthog.com`
   - `RESEND_API_KEY` = same as `.env.local`
   - `RESEND_FROM` = `hello@edgeways.app`
7. **Settings → Deployment Protection** → protect **Preview** deployments
8. Paste the `*.vercel.app` URL here (or say “imported”) — agent will triage via MCP

Do **A** first while the Vercel GitHub connect screen loads if needed.
