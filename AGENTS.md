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

1. Start your own dev server from this worktree's `edgeways/` with the
   repo's dev script. Never reuse a server started from another
   worktree, because it serves different code. If port 3000 is in use,
   use the next free port (3001, 3002 and so on), and use that port in
   every Orca URL below.
2. Open pages in Orca with `orca tab create --url
   http://localhost:<port>/<path> --worktree "$ORCA_BROWSER_WORKTREE"`
   (leave out `--worktree` if that variable is unset). Keep the returned
   page id and pass it as `--page` on later commands.

   **Every time you open a browser tab in Orca, bring it to the front so
   Sam can watch.** Create the tab with `--json`, read
   `result.browserPageId` from the output, then run:
   `orca tab switch --page <browserPageId> --worktree "$ORCA_BROWSER_WORKTREE" --focus`
   Do this for every tab you open, including repeat visits in new tabs.
 **Signed-in journeys.** For signed-in journeys, sign in as
 `agent-customer`; for `/admin`, sign in as `agent-admin`; for
 first-time and empty-state journeys (onboarding, first win, empty
 desk), sign in as `agent-new`. Never mark a signed-in journey "not
 run" for lack of an account, and never empty another agent's desk by
 hand. On `/login`, enter `agent-customer+clerk_test@example.com`,
 `agent-admin+clerk_test@example.com` or
 `agent-new+clerk_test@example.com` (or `AGENT_CUSTOMER_EMAIL` /
 `AGENT_ADMIN_EMAIL` / `AGENT_NEW_EMAIL` if set), then the Clerk test
 code `424242`. No password. `cyrus-setup.sh` seeds all three through
 `npm run seed:agent` (from `edgeways/`); re-run it for fresh desks.
 `agent-customer` is on Edge with a heavy history (about 2,400 settled
 bets); `agent-admin` has the admin role and a small desk; `agent-new`
 is on Edge, past setup (bank, exchange and bookies funded), with no
 offers or bets and £0 realised profit, and re-seeding resets it to
 empty. All three are dev Clerk and local SQLite only. Close the "Refer a friend" dialog with "Not now" if it
   opens. To switch account, sign out first
   (`orca eval --expression "window.Clerk.signOut()"`).
3. Replay every **User journey** in the ticket's agent brief, step by
   step: `orca snapshot` to find elements, `orca click --element <ref>`,
   `orca reload`, then `orca snapshot` again to check the Expect line.
   Re-snapshot after every navigation, because element refs change.
4. **Screenshot key milestones for any visible UI change.** Nobody may be
   watching Orca live, so the ticket must carry the visual evidence.
   During your journeys, capture:
   - the **final state** of each journey, plus any **new or changed UI**
     (modals, banners, empty states, error states)
   - **before and after** when changing existing UI (before from `main`,
     after from your branch)
   - **desktop** (about 1440 wide) and **mobile** (Pixel 9 emulation,
     **412 px wide at 1×**; avoid 3× devices, which Orca captures tiled)

   How, with no new tools: `orca screenshot --format png --json --page
   <id>` returns base64 in `result.data`; decode it to a PNG file.
   Desktop is a tab with no device emulation, resampled with `sips
   --resampleWidth 1440`. Before emulating, note the pane height in
   device pixels (`innerHeight * devicePixelRatio`). Mobile is a
   **separate** tab (emulation cannot be undone) after `orca set device
   --name "Pixel 9"`, which is 412 px at 2.625×. If the capture is taller
   than the pane it repeats, so crop to the pane height with `sips -c
   <paneHeight> <width> --cropOffset 1 1` (`0 0` crops from the centre),
   then `sips --resampleWidth 412`. Check each image before you upload
   it. `agent-new` lands on `/setup` after sign-in because setup
   completion is stored in the browser; go straight to `/desk` unless
   the journey is the setup wizard.

   Upload each PNG with `linear_upload_file` (cyrus-tools), then post
   them in **one** Linear comment titled **"Screenshots"** (`save_comment`
   on the issue), each embedded as `![caption](assetUrl)` with a caption:
   journey, account, viewport and resolution (for example "Journey 2,
   agent-new, mobile Pixel 9, 412 × 728"). Edit that same comment on later
   pushes (`save_comment` with its `id`) instead of posting new ones. If
   an upload fails, say so in your summary.

   Skip this step for changes with no visible UI (docs, config, pure
   backend), and say "no UI change, no screenshots" in the summary.
5. In the PR description and the Linear summary, list each journey as
   **Pass** or **Fail** with one line of evidence. If Orca or the dev
   server can't run, say so plainly. Never claim a browser check that did
   not happen.
6. At the end of the run, always stop any dev server you started, and
   close the tabs you opened (`orca tab close --page <id>`). Never stop
   a server you did not start.

Schema, DB bootstrap, settings, and `AppState` shapes: read section 0 of
`edgeways/docs/roadmap/implementation-briefs.md` only when the task touches
those. Do not load it on every change.
