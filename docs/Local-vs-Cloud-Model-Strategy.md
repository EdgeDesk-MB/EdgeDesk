# Local AI Stack vs Cursor/Cloud Frontier Models

**Date:** July 2026  
**Hardware:** 2x Mac Studio M3 Ultra (96GB each)  
**Stack:** Ollama (Backbone) + Linx bridge + Cursor/Zed (Frontline)  
**Companion:** day-to-day how-to lives in `docs/ai-playbook.md`; this file is the why and the routing analysis.

---

## Your Current Local Stack

| Model | Size | Role | Roughly Equivalent To |
| --- | --- | --- | --- |
| **qwen3-coder-ctx** | 30B MoE | Surgical coding, multi-file edits | Claude 3.5 Sonnet / GPT-4o for code |
| **qwen3:30b-thinking** | 30B MoE | Product strategy, architecture reasoning | Claude 3.5 Sonnet for reasoning |
| **bb-deepseek-70b** | 70B dense | Heavy logic, math, complex analysis | Claude 3 Opus / o1-mini (sometimes) |
| **bb-qwen-14b** | 14B dense | Ghost text, autocomplete, speed | Claude Haiku / GPT-4o-mini |

**What Cursor Pro+ / Claude Max gives you:**
- **Claude 5 family: Fable 5** (Anthropic's frontier agentic model, a tier above Opus), plus **Opus 4.8 / Sonnet 5**
- **Claude Code** (skills, subagents, hooks, background tasks: an agent harness, not just a chat window)
- **Massive context** (200K+ tokens reliably vs 32K-64K practical local)
- **Guaranteed uptime** (no tunnels, no CORS, no port conflicts)

---

## Where You Are at a Disadvantage

| Scenario | Cloud Wins | Why |
| --- | --- | --- |
| Complex multi-file architecture (10+ files) | Fable 5 / Opus 4.8 | Frontier models hold more context in working memory and reason across large codebases more coherently. |
| Very long documents | Claude (200K context) | Local models claim 256K but slow to 5-10 tok/s at that length. Claude stays fast. |
| Creative / stakeholder writing | Claude | Tone, nuance, and persuasive writing are still Claude's moat. |
| Debugging nasty edge cases | Fable 5 / Opus 4.8 | Frontier models have seen more edge cases in training. |
| When you are tired | Cloud | No setup, no troubleshooting, just works. |

## Where Your Local Stack Wins

| Scenario | Local Wins | Why |
| --- | --- | --- |
| Latency and speed | qwen3-coder-ctx | 80+ tok/s with zero network round-trip. Composer feels instant. |
| Cost | All local | Hardware is sunk cost. Cursor Pro+ is $60/mo, Claude Max is $100+/mo. |
| Privacy | All local | Proprietary code and product plans never leave your network. |
| Unlimited usage | All local | No rate limits, no "fast requests depleted" anxiety. |
| Surgical edits | qwen3-coder-ctx | MoE models excel at precise, small-context code changes. |

---

## The Plan of Attack: Decision Matrix

Default to local. Escalate to cloud only when you hit a specific trigger.

### 1. Coding and Engineering

| Task | Use This | Why |
| --- | --- | --- |
| Refactoring, bug fixes, tests | `qwen3-coder-ctx` | Fast, precise, understands code structure. |
| New feature implementation (<5 files) | `qwen3-coder-ctx` | Excellent for bounded scope. |
| Architecture across 10+ files | **Fable 5 / Opus 4.8** | Local models lose coherence at this scale. |
| Unfamiliar codebase (100k+ tokens) | **Claude Max** | Dump the entire repo into Claude's 200K context. |
| Complex algorithm design | `bb-deepseek-70b` first | If it struggles after 2 attempts, escalate to Claude. |

### 2. Product Strategy and Planning

| Task | Use This | Why |
| --- | --- | --- |
| Roadmap reasoning, user story decomposition | `qwen3:30b-thinking` | Thinking mode is purpose-built for this. |
| Stakeholder presentations, pitch decks | **Claude Max** | Claude writes persuasively. Local models write technically. |
| Regulatory / compliance analysis | `bb-deepseek-70b` | Dense 70B model handles logic-heavy analysis well. |
| Competitive analysis (scraping + synthesis) | **Claude Max** | Long context + web search beats local. |

### 3. Design and UX

| Task | Use This | Why |
| --- | --- | --- |
| Design system token logic | `qwen3-coder-ctx` | Code-adjacent, fast. |
| UX copy, microcopy, error messages | **Claude** | Tone and brevity matter. |
| Accessibility reasoning | `qwen3:30b-thinking` | Good for structured compliance checks. |
| Creative concept generation | **Claude / Fable** | Frontier models are more generative and surprising. |

### 4. Emergency / Fallback

| Situation | Action |
| --- | --- |
| Local model is stuck in a loop | Switch to Claude for 1 prompt, then return to local. |
| SSH tunnel is down | Use Claude as bridge until local is restored. |
| Need to paste 50K tokens of logs | Use Claude Max (local models will crawl at that context). |
| Need an answer in 30 seconds | Use `bb-qwen-14b` or Claude Haiku (fastest options). |

---

## The 80/20 Rule

**80% of your work should happen on local models.** Your stack is genuinely good enough for:
- Daily coding (Cursor Composer)
- Architecture reasoning (Qwen3-Thinking)
- Quick product decisions
- Code review

**20% should escalate to cloud:**
- Stakeholder-facing writing
- Massive context ingestion
- Complex creative problems
- When you are debugging why the local stack is not working (meta)

---

## Subscription Strategy

| Plan | Keep or Cancel? | Rationale |
| --- | --- | --- |
| **Cursor Pro+** | **Downgrade to Pro ($20)** or cancel | You are routing Composer to local Qwen3. You only need Pro+ for Fable access. If you find yourself hitting the 10+ file architecture wall daily, keep Pro+. Otherwise, Pro is enough for local model override. |
| **Claude Max** | **Decision pending — see note below** | You are currently on Claude Pro with Fable 5 access extended free until 19 July 2026. After that, Fable 5 on Pro costs usage credits; Max gives unlimited Fable 5. Test whether the local stack covers 90% of your work before that date and decide then. |

---

## Quick Reference: Cursor Model Overrides

| Model Override | When |
| --- | --- |
| `qwen3-coder-ctx:latest` | Default for all coding |
| `qwen3:30b-thinking` | Architecture chat, product questions in Composer |
| Sonnet 5 (Cursor cloud) | When local fails after 2 attempts, or first attempt for calc/settlement work |
| Fable 5 (Cursor cloud, or Claude Code) | Complex multi-file agentic work |

(Check the exact ids in Cursor's model picker; `claude-4-sonnet` is a retired name.)

---

## Bottom Line

You are **not at a meaningful disadvantage** for engineering and product work. Your local stack covers the core loop. You are at a disadvantage only for:
- Massive context windows (200K+)
- Persuasive / creative writing
- The hardest 5% of reasoning problems

**The plan:** Default local, escalate deliberately, cancel what you do not use. Test a 30-day local-first sprint. If you open Claude less than 3 times a week, you do not need Max.

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

## Review notes (Fable 5, 13 July 2026)

Corrections applied above: Fable is Anthropic's Claude Fable 5, not Cursor's
model; "Claude 4" references updated to the current family (Fable 5, Opus 4.8,
Sonnet 5); broken shell snippets fixed.

Strategic amendments to the original analysis:

1. **The cloud advantage is the harness, not just the model.** The doc frames
   cloud as "bigger context + better prose". The bigger gap in 2026 is agentic:
   Claude Code brings skills, subagents, hooks and long-horizon task execution.
   Local 30B models are strong single-shot editors but weak multi-step agents;
   they drift on anything needing 10+ tool calls. Route by horizon, not only by
   file count.
2. **Escalate calc/settlement work on task type, not after two failures.**
   EdgeDesk's calc engine is real money. Two failed local attempts at
   settlement maths can leave subtly wrong tests behind, which is worse than
   the bug. Rule: local models may draft `[local]`-tagged briefs, but anything
   changing calc output gets frontier review (`/code-review` or the
   calc-auditor subagent) before commit, regardless of size.
3. **Cheapest hybrid pattern: local drafts, cloud reviews.** Reviewing a diff
   costs a fraction of generating it. Inverting the doc's "escalate to
   generate" default keeps the 80/20 split while catching the quality gap.
4. **Equivalence anchors are two generations old.** "≈ Claude 3.5 Sonnet"
   means "good mid-2025 mid-tier". Fair for bounded edits; for agentic and
   architectural work the real gap to current frontier is wider than the
   tables imply.
5. **Orchestration today:** no tool auto-routes between the local backbone and
   cloud. The router is either you (this matrix) or Claude Code acting as
   foreman via the `/delegate-local` skill (`.claude/skills/delegate-local/`),
   which sends bounded prompts to the Ollama node and reviews the output
   before it lands.
6. **Subscription note:** the Claude Max row undervalues that Max includes
   Claude Code with Fable 5. Re-run the 30-day test with Claude Code as the
   orchestrator (planning, review, delegation) rather than treating Claude as
   a chat window you "open".
