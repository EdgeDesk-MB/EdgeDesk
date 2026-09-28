# Agent model routing (Cyrus / ticket executor)

This table is the **default routing** for which cloud model should run a Linear ticket when Cyrus (or another automated executor) picks the model. It complements the human-facing lanes in `docs/Local-vs-Cloud-Model-Strategy.md` and the always-on Cursor rule in `.cursor/rules/model-routing.mdc`.

Routing test: [EDGE-222](https://linear.app/samhayter/issue/EDGE-222/routing-test-document-the-model-routing-table-runs-on-composer-25) (parent: [EDGE-185](https://linear.app/samhayter/issue/EDGE-185/model-routing-right-cursor-model-for-each-ticket)).

**EDGE-222 note:** The first Composer 2.5 run wrote this doc but did not commit, push, or open a PR per the agent protocol; Sam asked Cyrus to finish that on follow-up.

## Routing table

| Ticket (from the gate's Size / Type / notes) | Model | Why |
| -- | -- | -- |
| Docs, copy, config, AGENTS.md (any size) | `claude-sonnet-5-medium` | Capable and cheap; docs-only work does not need Composer |
| Size S bug or chore | `claude-sonnet-5-medium` | Capable, cheaper than Opus |
| Size M feature or bug | `claude-sonnet-5-high` |  |
| Investigative or cross-cutting work, or Size L | `claude-opus-5-5-high` | Needs deeper reasoning |
| **Money, calc or settlement code** (gate note: RT1 / "needs a frontier model"), auth, security | `claude-opus-5-5-high` | Correctness first |

## Rules

- A `[model=…]` tag on the ticket description's first line overrides everything (manual choice wins)
- **Never** use models marked **NO ZDR** (no zero data retention: currently the Fable family) for this repo
- Avoid `-fast` variants unless speed is explicitly needed (they typically cost more)
- The default when unsure is `claude-sonnet-5-high`
