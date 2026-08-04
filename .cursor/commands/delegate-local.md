# Delegate to the local backbone

Use a frontier model in the picker for this command; the point is frontier
oversight of local output.

Read `.claude/skills/delegate-local/SKILL.md` and follow it: build a fully
self-contained prompt (the local model has no repo access), send it to the
Ollama node at `http://192.168.50.54:11434/api/chat`, review the result like
a junior's PR, and run `npx vitest run` from `edgeways/` before applying
anything. Calc or settlement output changes additionally require the
/calc-change workflow. Two bad results means stop delegating.
