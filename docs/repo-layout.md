# Repo layout — what lives where

> Why this exists: once Vercel deploys from `edgeways/`, we must keep a
> clean split between **shippable app** and **Sam/ops/strategy** material.
> Last updated: 12 Aug 2026.

## Picture

```text
MB app build/                          ← git root (private GitHub)
├── docs/                              ← ops, legal, launch, AI harness, strategy
│   ├── follow-this-plan.md            ← START HERE each day
│   ├── live-readiness.md
│   ├── stripe-test-rehearsal.md       ← localhost Checkout cards + listen
│   ├── hosting-and-environments.md
│   ├── legal/                         ← drafts, GC assessment (not customer HTML)
│   ├── decisions/
│   └── strategy/                      ← competitive / API cost research
├── .cursor/  .claude/                 ← agent harness (not in Next bundle)
├── extension/                         ← Chrome MV3 (separate from web deploy)
└── edgeways/                          ← Vercel Root Directory = this folder
    ├── src/  public/  drizzle/        ← the product
    ├── docs/                          ← engineering-only (design system, briefs)
    ├── .env.example                   ← safe templates only
    ├── .env.local                     ← NEVER commit (gitignored)
    └── data/                          ← local SQLite (gitignored)
```

## Two different “visibility” questions

| Surface | What is included | Risk |
|---------|------------------|------|
| **Vercel build** | Files under `edgeways/` (Root Directory) | Customer only gets **built** JS/CSS/HTML. Markdown in `edgeways/docs` is **not** served unless something imports it into the bundle. |
| **GitHub clone** | Whole monorepo | Anyone with repo access sees root `docs/` too. Keep the repo **private**. |

So: moving strategy out of `edgeways/` does **not** hide it from GitHub. It keeps the **deploy root** mentally and practically clean, and reduces the chance of accidental imports into customer UI.

## Put it here

### Repo root `docs/` — Sam, ops, legal, strategy

- Launch checklists (`follow-this-plan.md`, `live-readiness.md`)
- Stripe localhost rehearsal (`stripe-test-rehearsal.md`)
- Hosting / env design
- Legal drafts and self-assessments
- Architecture decision records
- AI / Cursor playbooks
- Competitive landscape, API cost research, product vision (`PLAN.md`)
- Temporary handoffs / bypass notes

### `edgeways/docs/` — agents coding the product

Keep only what pre-flight and calc/UI work need:

| Keep | Why |
|------|-----|
| `design-system.md` | UI work gate |
| `offer-command-centre.md` | Offers / settlement context |
| `offer-paste-learning.md` | Paste pipeline |
| `roadmap/implementation-briefs.md` | Repo conventions §0 |
| `roadmap/product-roadmap.md` | Product scope agents must respect |
| `roadmap/polish-backlog.md` | Engineering polish queue |

### Never in git

| Path | Notes |
|------|-------|
| `edgeways/.env.local` | Secrets — Vercel env UI for hosted |
| `edgeways/data/*.db` | Local SQLite + backups |
| Real Neon / Resend / Stripe keys in chat or commits | Use Vercel / 1Password |

### Customer-facing content (different again)

In-app pages under `edgeways/src/content/` and marketing copy under
`edgeways/src/app/(marketing)/` **are** shipped to users. Sweep those before
beta (EDGE-49 / EDGE-37) — no Linear IDs, no `.env.local` instructions, no
“restart the dev server”.

## Migration done 12 Aug 2026

Moved out of `edgeways/` into root `docs/`:

| From | To |
|------|----|
| `edgeways/PLAN.md` | `docs/PLAN.md` |
| `edgeways/docs/api-dependencies-and-tiers.md` | `docs/strategy/api-dependencies-and-tiers.md` |
| `edgeways/docs/roadmap/competitive-landscape.md` | `docs/strategy/competitive-landscape.md` |
| `edgeways/docs/branding-punch-list.md` | `docs/branding-punch-list.md` |

Short stubs remain at the old paths so historical links still resolve.

## Checklist when adding a new doc

1. Will an agent need it mid-edit to follow AGENTS.md pre-flight? → `edgeways/docs/`
2. Is it legal, payments, launch ops, or competitive strategy? → root `docs/`
3. Will a **customer** see it in the UI? → `src/content/` or marketing routes only, and write for them
4. Does it contain secrets or account URLs? → **do not commit**; use env / password manager
