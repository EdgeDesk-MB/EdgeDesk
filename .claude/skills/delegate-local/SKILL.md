---
name: delegate-local
description: Delegate a bounded, self-contained task to the local Ollama backbone (Mac Studio node) instead of doing it in-session. Use for mechanical code transforms, boilerplate, bulk drafts, or [local]-sized briefs where a 30B model suffices and the output will be reviewed here before it lands.
---

# Delegate to the local backbone

Claude acts as foreman: writes a self-contained prompt, ships it to the local
node, reviews the result like a PR from a junior.

## Endpoints
- Ollama API: `http://192.168.50.54:11434`
- OpenAI-compatible Linx bridge: `http://192.168.50.54:8080/v1`

## Model routing
| Task | Model |
| --- | --- |
| Code transforms, boilerplate, tests from a spec | `qwen3-coder-ctx` |
| Structured reasoning drafts, decompositions | `qwen3:30b-thinking` |
| Logic-heavy or maths-heavy analysis | `bb-deepseek-70b` |

## Procedure
1. Build a fully self-contained prompt. The local model has NO repo access:
   inline every file excerpt, data shape and acceptance criterion it needs.
   Keep the prompt under roughly 20K tokens; practical local context is 32-64K.
2. Write the prompt to a temp file and send it:

   ```bash
   jq -n --rawfile p /tmp/delegate-prompt.txt \
     '{model:"qwen3-coder-ctx", stream:false, messages:[{role:"user", content:$p}]}' \
     | curl -s --max-time 540 http://192.168.50.54:11434/api/chat \
     | jq -r '.message.content'
   ```

   Use a generous Bash timeout (300000ms or more); the 70B model is slow.
3. Review before applying anything: run `npx vitest run` from `edgedesk/`, and
   never apply calc or settlement changes without the /calc-change workflow.
4. Two bad results on the same task means stop delegating, do it in-session,
   and tell Sam which task type failed so the routing matrix can be updated.
5. If the node is unreachable (connection refused, timeout), say so plainly and
   continue in-session. Do not retry more than once.
