# Local AI Stack vs Cursor/Cloud Frontier Models

**Updated:** 2 August 2026  
**Hardware:** 2x Mac Studio M3 Ultra (96GB each)  
**Stack:** Ollama (Backbone) + Linx bridge + Cursor Ultra (HQ) + Claude Code (specialist)  
**Companion:** day-to-day how-to lives in `docs/ai-playbook.md`; Cursor enable-list in `docs/cursor-setup.md`. This file is the why, the routing analysis, and the subscription maths.

---

## Snapshot (August 2026)

| Layer | Role | Notes |
| --- | --- | --- |
| **Cursor Ultra** | Home base / HQ | IDE + agents + multi-model. $200/mo includes **$400** Other Models usage. |
| **Claude Code** | Specialist agent harness | Best for long autonomous loops (explore → edit → test → fix). Claude family only. |
| **Local Ollama** | Unlimited backbone | Surgical edits, privacy, no usage anxiety. Weak on long agentic horizons. |
| **Kimi K3** | Strong cheap daily cloud agent | Not "the standard", top-tier value. Burns Other Models pool. |
| **Claude Opus 5 / Fable 5** | Peak quality | Hardest architecture, calc review, stakeholder writing. Use sparingly. |
| **Grok 4.5 / Composer 2.5** | Cursor Models pool | Protects Other Models budget for day-to-day agent work. |

**Kimi K3 is not the default best model.** It is an excellent workhorse: roughly top-5 coding agent quality at about half the $/task of Opus/Sol. Peak work still goes to Claude Opus/Fable (or Claude Code).

---

## Your Current Local Stack

| Model | Size | Role | Roughly Equivalent To |
| --- | --- | --- | --- |
| **qwen3-coder-ctx** | 30B MoE | Surgical coding, multi-file edits | Strong mid-tier coder for bounded scope |
| **qwen3:30b-thinking** | 30B MoE | Product strategy, architecture reasoning | Good structured reasoning, not frontier agentic |
| **bb-deepseek-70b** | 70B dense | Heavy logic, math, complex analysis | Strong local logic; escalate if stuck |
| **bb-qwen-14b** | 14B dense | Ghost text, autocomplete, speed | Fast local ghost text (Zed) |

Equivalence anchors drift every few months. Treat the right-hand column as "good enough for bounded work", not "equals Opus 5".

**What Cursor Ultra + Claude Code give you:**
- Multi-model picker: Kimi K3, Claude Opus/Fable/Sonnet, GPT-5.x, Gemini, Grok 4.5, Composer 2.5
- Claude Code skills, subagents, hooks, long-horizon task execution
- Large context (200K–1M depending on model) vs 32K–64K practical local
- Guaranteed uptime (no tunnels, CORS, or port conflicts when cloud-only)

---

## Cursor Ultra vs Claude Code (use both)

| | **Cursor** | **Claude Code** |
| --- | --- | --- |
| Form | AI IDE (edit + agents) | Terminal / side-panel agent |
| Strength | Day-to-day coding, Tab, diffs, multi-model, UI in context | Long autonomous loops with verify-as-you-go |
| Models | Claude, Kimi, GPT, Gemini, Grok, Composer | Claude only |
| Best when | You are in the driver's seat | You are delegating a chunk of work |

**Verdict:** Cursor Ultra is HQ. Keep Claude Code for peak Claude agent loops and guarded workflows. Do not drop one for the other unless budget forces it.

---

## Benchmark anchors (late July / early August 2026)

Independent numbers move weekly. Re-check [Artificial Analysis](https://artificialanalysis.ai) before big subscription changes.

| Model | AA Intelligence Index (approx) | AA Coding Agent Index (approx) | Approx $/coding task |
| --- | ---: | ---: | ---: |
| Claude Opus 5 | ~61 | ~66.7 | ~$8 |
| GPT-5.6 Sol | ~59 | ~66.6 | ~$7 |
| Claude Fable 5 | ~60 | high | higher |
| **Kimi K3** | ~57 | ~61 | **~$3** |
| Grok 4.5 | competitive | ~58 | often cheaper than K3 |

Sources:
- [Artificial Analysis](https://artificialanalysis.ai)
- [AA Opus 5 article](https://artificialanalysis.ai/articles/opus-5)
- [Sol vs K3 vs Opus early coding comparison](https://ddewhurst.com/blog/gpt-5-6-sol-vs-kimi-k3-vs-claude-opus-5-early-coding-comparison/)
- [Cursor models & pricing](https://cursor.com/docs/models-and-pricing)
- [Cursor Kimi K3 notes](https://cursor.com/docs/models/kimi-k3)
- [Zapier: Claude Code vs Cursor](https://zapier.com/blog/claude-code-vs-cursor/)

---

## Usage pools (Cursor Ultra)

Two separate monthly pools:

| Pool | Models | Ultra included |
| --- | --- | --- |
| **Cursor Models** | Grok 4.5, Composer 2.5 | Generous |
| **Other Models** | Kimi K3, Claude, GPT, Gemini, etc. | **$400**/mo (Pro+ was $70) |

Kimi K3 rates (per 1M tokens, flat across context): ~$3 input / $0.30 cache read / $15 output. No long-context surcharge.

**Budget habit:** day-to-day agent work on **Grok/Composer** when quality is enough; spend Other Models on **K3** for serious agent runs and **Opus/Fable** only when quality > cost.

---

## Where cloud wins

| Scenario | Cloud wins with | Why |
| --- | --- | --- |
| Complex multi-file architecture (10+ files) | Opus 5 / Fable 5 | Frontier coherence across large working sets |
| Long autonomous agent loops | Claude Code + Opus, or Cursor agent + K3/Opus | Harness + persistence; local drifts after many tool calls |
| Very long documents / huge logs | Claude / K3 (large context) | Local slows hard at long context |
| Creative / stakeholder writing | Claude | Tone and persuasion still Claude's moat |
| Nasty edge-case debugging | Opus / Fable | Wider training + better agentic recovery |
| When you are tired | Any cloud in Cursor | No setup, just works |

## Where local wins

| Scenario | Local wins | Why |
| --- | --- | --- |
| Latency and speed | qwen3-coder-ctx | 80+ tok/s, zero network |
| Cost | All local | Hardware is sunk cost |
| Privacy | All local | Code never leaves the LAN |
| Unlimited usage | All local | No pool anxiety |
| Surgical edits | qwen3-coder-ctx | Excellent for precise, small-context changes |
| Local ghost text | bb-qwen-14b (Zed) | Cursor Tab cannot use custom models |

---

## Decision matrix

Default: **local for bounded work**, **Cursor Models (Grok/Composer) for daily cloud agents**, escalate to **K3 / Opus / Claude Code** on triggers below.

### 1. Coding and Engineering

| Task | Use this | Why |
| --- | --- | --- |
| Refactoring, bug fixes, tests (bounded) | `qwen3-coder-ctx` or Composer/Grok | Fast, cheap |
| Feature work, a few files | Cursor agent: **Composer / Grok**, or **K3** if agentic depth needed | Protect Other Models when possible |
| Serious multi-file agent run | **Kimi K3** in Cursor | Best $/quality for volume agent work |
| Architecture across 10+ files / migrations | **Opus 5 / Fable 5**, or Claude Code | Peak coherence |
| Unfamiliar large dump (100k+ tokens) | Claude or K3 (large context) | Local crawls |
| Complex algorithm design | `bb-deepseek-70b` first | Two strikes → Opus |
| Calc / settlement maths | Frontier only + `/calc-change` + audit | Real money; never local-unreviewed |

### 2. Product Strategy and Planning

| Task | Use this | Why |
| --- | --- | --- |
| Roadmap reasoning, story decomposition | `qwen3:30b-thinking` or Claude | Thinking mode / Claude for polish |
| Stakeholder presentations, pitch decks | **Claude** | Persuasive writing |
| Regulatory / compliance analysis | `bb-deepseek-70b` or Opus | Logic-heavy; escalate if stakes high |
| Competitive analysis | Claude (web + long context) | Synthesis + search |

### 3. Design and UX

| Task | Use this | Why |
| --- | --- | --- |
| Design system token logic | Local coder or Composer/Grok | Code-adjacent |
| UX copy, microcopy, errors | **Claude** | Tone |
| Accessibility reasoning | `qwen3:30b-thinking` or Claude | Structured checks |
| Creative concept generation | Claude / Fable | More generative |

### 4. Tool choice by shape of work

| Shape | Tool |
| --- | --- |
| Inline edit, Tab, visual diffs, multi-model | **Cursor** |
| Long "finish this PR" autonomy | **Claude Code** |
| Bulk mechanical transforms | Claude Code `/delegate-local` → Ollama |
| Review before commit (calc/UI) | Subagents / `/calc-audit` / `/design-review` on frontier |

### 5. Emergency / Fallback

| Situation | Action |
| --- | --- |
| Local model looping | One cloud prompt (Grok/K3/Opus), then return local |
| SSH tunnel / Linx down | Stay on Cursor cloud until local restored |
| Need 50K+ tokens of logs pasted | Cloud large-context model |
| Need an answer in 30 seconds | `bb-qwen-14b` or a fast cloud mini |

---

## The hybrid rule (updated)

**Not a rigid 80/20 local split anymore.** With Ultra + intense daily agent use:

1. **Local** for surgical, private, unlimited grind.
2. **Cursor Models (Grok / Composer)** for most cloud agent sessions (protects the $400 Other Models pot).
3. **Kimi K3** for serious Cursor agent runs when you want frontier-ish quality at volume.
4. **Opus / Fable / Claude Code** for peak difficulty, calc-critical work, and long autonomous jobs.
5. **Always:** local may draft calc/settlement; frontier reviews before commit.

Cheapest high-quality pattern:  
**Composer/Grok day-to-day → K3 for serious agents → Opus/Claude Code when stuck or architecture-critical → local for unlimited mechanical work.**

---

## Subscription strategy (August 2026)

| Plan | Keep? | Rationale |
| --- | --- | --- |
| **Cursor Ultra ($200)** | **Yes (primary)** | $400 Other Models. Matches power-user burn (Pro+ $70 Other Models can vanish in days on K3/Claude). |
| **Claude Code (Pro/Max)** | **Keep** | Different harness, not replaced by Ultra. Use for peak Claude agent loops and skills. |
| **Local Ollama** | **Keep** | Sunk hardware; privacy; unlimited mechanical work. |

Observed pattern on Pro+: Other Models at 100% early in the cycle while Cursor Models still had headroom → Ultra + deliberate Grok/Composer use is the fix, not "K3 for everything".

On-demand spend remains useful as a buffer if Other Models hits 100% before reset.

---

## Models to enable in Cursor (hardcore set)

See `docs/cursor-setup.md` for the checklist. Enable at least:

**Always on (daily):**
- Kimi K3
- Cursor Grok 4.5
- Composer 2.5
- Claude Opus 5 (and/or Fable 5 if available)
- Claude Sonnet 5 (cheaper Claude rung)

**Useful secondary:**
- Kimi K2.7 Code (cheaper Moonshot)
- GPT-5.6 Sol or GPT-5.5 (second opinion / coding bake-offs)
- Gemini 3.x Flash or Pro (fast / multimodal experiments)

**Local custom (Linx):**
- `qwen3-coder-ctx`, `qwen3:30b-thinking`, `bb-deepseek-70b`

Hide clutter: leave rarely used legacy models disabled so the picker stays usable.

---

## Quick reference: Cursor model ladder

| Model | When |
| --- | --- |
| `qwen3-coder-ctx` | Default local coding |
| Composer 2.5 / Grok 4.5 | Default cloud daily agent (Cursor Models pool) |
| Kimi K3 | Serious agent runs, volume frontier-ish work |
| Claude Sonnet 5 | Mid Claude quality, lower Other Models burn than Opus |
| Claude Opus 5 / Fable 5 | Hardest architecture, calc review, stakeholder writing |
| Claude Code + Opus | Long autonomous "finish this" jobs |
| `qwen3:30b-thinking` | Product / architecture chat on local |

---

## Orchestration note

No tool auto-switches the model picker for you. Routing is:
1. **You** (this matrix + playbook), or
2. **Agents** reading `AGENTS.md` / `.cursor/rules/model-routing.mdc`, which should **recommend** the right model at the start of a task if the current one is a mismatch, or
3. **Claude Code** as foreman via `/delegate-local` for bounded Ollama jobs.

---

## Bottom line

You are building a **hardcore hybrid**: Ultra as HQ, Claude Code as specialist, local as unlimited backbone, K3 as the volume cloud agent, Opus for the hard 5–10%.

You are not at a meaningful disadvantage for engineering. Watch only:
- Burning Other Models by defaulting everything to K3/Opus
- Using local models as multi-step agents beyond their horizon
- Letting calc/settlement land without frontier audit

**The plan:** Route by task type and horizon. Protect the Other Models pool. Escalate deliberately. Re-check Artificial Analysis monthly; this space moves fast.

---

## Backbone Node Monitoring Commands

```bash
# Live model ticker
while true; do clear; date; echo "==="; ollama ps; echo "==="
memory_pressure; sleep 3; done

# Token speed filter (ollama logs to stderr, so redirect it)
ollama serve 2>&1 | grep -E "eval rate|POST|GET"

# Health check snapshot
echo "=== Loaded Models ==="; ollama ps
echo "=== Memory ==="; memory_pressure
echo "=== GPU Power ==="; sudo powermetrics --samplers gpu_power -n 1 2>/dev/null | head -n 5
```

---

## Changelog

### 2 August 2026
- Upgraded framing from Pro+/local-first to **Cursor Ultra HQ + Claude Code + local**.
- Documented Kimi K3 as strong value workhorse, not the standard peak model.
- Added usage-pool maths ($400 Other Models), benchmark anchors, enable-list, and tool-shape matrix (Cursor vs Claude Code).
- Softened rigid 80/20 local split into a three-lane cloud pattern (Cursor Models → K3 → Opus) plus local.

### 13 July 2026
- Fable/Claude family naming corrections; harness-vs-model note; calc escalation-by-task-type; local-draft/cloud-review pattern.
