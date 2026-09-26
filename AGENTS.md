# MB app build, repo map

Git root is THIS directory. The product is Edgeways, a local-first matched
betting command centre, and it lives entirely in `edgeways/` (Next.js 16 app).
Vercel Root Directory is `edgeways/` — see `docs/repo-layout.md` for what
belongs in the app vs parent `docs/`.

**Sam daily plan:** `docs/follow-this-plan.md`.

Before doing any work:
1. If `edgeways/AGENTS.md` is already in context, do not re-read it. Hard
   rules, do-not-build list, and Neon live there. Hosted desk data is Neon,
   not SQLite. Do not ship a customer mutation that only writes `:memory:`.
2. Implementation loop: if `.cursor/rules/iterative-dev.mdc` is already in
   context, follow it. Do not also read `docs/cursor-workflow.md`. Hosts
   that do not inject that rule (Claude Code, Zed, Aider) should read
   `docs/cursor-workflow.md` and use the same loop and gates.
3. Linear: if Sam named `EDGE-n`, that is scope. Otherwise see the cheap
   protocol on the iterative-dev rule. Local models skip Linear.

The browser extension (J9 betslip fill) lives in `extension/` — plain Chrome
MV3, no build step; see `extension/README.md` for the install and the manual
test protocol.

Other pointers:
- Implementation loop: `docs/cursor-workflow.md` (hosts without the
  iterative-dev rule only). Harness map: `docs/cursor-kit.md`. Daily
  human reference: `docs/cursor-daily-guide.md`. Linear for humans:
  `docs/linear.md`. Do not load those mid-task.
- Model routing: `docs/Local-vs-Cloud-Model-Strategy.md`. Habits:
  `docs/ai-playbook.md`. Enable-list: `docs/cursor-setup.md`. Always-on rule:
  `.cursor/rules/model-routing.mdc` and `iterative-dev.mdc`.
- Cursor: `.cursor/skills/`, `.cursor/agents/`, `.cursor/commands/`. Claude
  Code mirror: `.claude/skills/`, `.claude/agents/`. MCP hub (what to auth,
  what to skip): `docs/cursor-setup.md` § 9.
- Bet-type taxonomy: `docs/betting-methods-guide.md`. Launch path:
  `docs/live-readiness.md` and `docs/follow-this-plan.md`.
- Run all npm commands from `edgeways/`, not from this directory.
- UI verify: Orca embedded browser. Aside (new window) if Orca cannot
  host or Sam names Aside. Never Playwright, Chrome, or Computer Use
  for Edgeways pages. Claude Code: see root `CLAUDE.md`.

**UI verification in agent runs.** For any change a user can see:

Cyrus worktrees are prepared by the repo-root `cyrus-setup.sh`, which
copies `$CYRUS_DEV_ENV_FILE` to `edgeways/.env.local` and runs `npm ci`
when `node_modules` is missing.

1. Start the dev server from `edgeways/` with the repo's dev script, on
   port 3000.
2. Open pages in Orca with `orca tab create --url
   http://localhost:3000/<path> --worktree "$ORCA_BROWSER_WORKTREE"`
   (leave out `--worktree` if that variable is unset). Keep the returned
   page id and pass it as `--page` on later commands.
3. Replay every **User journey** in the ticket's agent brief, step by
   step: `orca snapshot` to find elements, `orca click --element <ref>`,
   `orca reload`, then `orca snapshot` again to check the Expect line.
   Re-snapshot after every navigation, because element refs change.
4. In the PR description and the Linear summary, list each journey as
   **Pass** or **Fail** with one line of evidence. If Orca or the dev
   server can't run, say so plainly. Never claim a browser check that did
   not happen.
5. Stop the dev server and close the tabs you opened
   (`orca tab close --page <id>`).

Schema, DB bootstrap, settings, and `AppState` shapes: read section 0 of
`edgeways/docs/roadmap/implementation-briefs.md` only when the task touches
those. Do not load it on every change.
