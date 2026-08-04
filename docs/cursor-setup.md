# Cursor setup checklist (Edgeways)

**Updated:** 2 August 2026  

One-off in-app configuration so Cursor picks up the repo rules, the Ultra
model set, and the local backbone. Repo-side files already in place: `AGENTS.md`
(root and `edgeways/`), `edgeways/.cursor/rules/*.mdc`,
`.cursor/rules/model-routing.mdc`, `.cursorignore`.

Routing why/when: `docs/Local-vs-Cloud-Model-Strategy.md`. Day-to-day habits:
`docs/ai-playbook.md`.

## 1. Workspace
Open `MB app build/` (the git root) as the workspace, not `edgeways/`.
The root `AGENTS.md`, `edgeways/AGENTS.md`, root `.cursor/rules/`, and nested
`edgeways/.cursor/rules/` are all discovered from there.

## 2. Plan
Confirm **Cursor Ultra** (or Pro+ with on-demand if you defer Ultra).  
Other Models included: Ultra **$400**/mo, Pro+ **$70**/mo. Kimi K3 and Claude
draw from Other Models; Grok 4.5 and Composer 2.5 draw from Cursor Models.

## 3. Rules
Cursor Settings → Rules. Confirm:
- Project rules `calc-guardrails`, `design-system`, and `model-routing` are listed.
- AGENTS.md / instruction-file support is enabled (on by default).

## 4. Models to enable (hardcore set)

Cursor Settings → Models. Turn **on**:

### Daily drivers (enable first)
| Model | Pool | Use for |
| --- | --- | --- |
| **Kimi K3** | Other Models | Serious Cursor agent runs (volume frontier-ish) |
| **Cursor Grok 4.5** | Cursor Models | Default daily cloud agent (protects Other Models) |
| **Composer 2.5** | Cursor Models | Fast IDE agent / Composer work |
| **Claude Opus 5** | Other Models | Peak architecture, calc review, hard bugs |
| **Claude Sonnet 5** | Other Models | Mid Claude rung, cheaper than Opus |

### Enable if available / useful
| Model | Notes |
| --- | --- |
| **Claude Fable 5** | Peak Anthropic agentic tier when offered |
| **Kimi K2.7 Code** | Cheaper Moonshot for lighter agent work |
| **GPT-5.6 Sol** or **GPT-5.5** | Second opinion / bake-offs |
| **Gemini 3 Flash** or **3.1 Pro** | Fast / multimodal experiments |

### Keep disabled
Legacy or rarely used models (old GPT/Claude aliases, unused previews). A short
picker beats a cluttered one.

### Local custom models (Linx bridge)
Add under OpenAI API key override:
- Base URL: `http://192.168.50.54:8080/v1` (Linx bridge)
- Key: `linx` (same dummy key Zed uses)
- Model names: `qwen3-coder-ctx`, `qwen3:30b-thinking`, `bb-deepseek-70b`

Known constraints:
- Cursor Tab autocomplete cannot use custom models; `bb-qwen-14b` ghost text
  stays Zed-only.
- Custom-endpoint requests may route via Cursor's backend. If LAN verification
  fails, point at the tunnel instead.
- Kimi K3 is **hidden by default** until enabled under Models.

## 5. Default picker habit
Suggested defaults (change per chat as needed):
1. **Composer 2.5 or Grok 4.5** — open most sessions here.
2. Switch to **Kimi K3** when the job needs a serious multi-file agent.
3. Switch to **Opus 5 / Fable 5** for calc-critical, architecture, or when K3
   fails twice.
4. Use **local `qwen3-coder-ctx`** for bounded single-file / privacy-sensitive
   edits when the bridge is up.

Agents will recommend a model mismatch via `model-routing` rules; Cursor does
not auto-switch the picker for you.

## 6. Privacy
Settings → General: enable Privacy Mode (code never used for training).

## 7. Indexing
Settings → Indexing: confirm the codebase index completed after
`.cursorignore` was added; resync if `eng.traineddata` was indexed earlier.

## 8. On-demand buffer
Plan & Usage: optionally set a modest on-demand monthly limit so Other Models
does not hard-stop mid-session if you spike on K3/Opus.

## Verification
1. Open `edgeways/src/lib/calc/matched.ts`, ask chat a question about it, and
   confirm the `calc-guardrails` rule shows in the context pills.
2. Repeat with a file under `edgeways/src/components/` for `design-system`.
3. Confirm `model-routing` is attached (always-apply).
4. Enable Kimi K3, select it, send one prompt; confirm it runs (Other Models
   quota permitting).
5. Switch to Grok 4.5 or Composer 2.5; confirm Cursor Models usage moves, not
   only Other Models.
6. Switch the picker to `qwen3-coder-ctx` and send one prompt; a reply proves
   the bridge path works from Cursor, not just Zed.
7. Type `@eng.traineddata` in chat; it should no longer be suggested.
