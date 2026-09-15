@AGENTS.md

## Browser (Claude Code)

Localhost and desk UI: **Orca's embedded browser only**. New tab via
`orca tab create --url …`. Do not open Playwright, Chrome DevTools,
system Chrome, or Computer Use for that work. Those tools burn a session
on extra windows.

If Orca cannot host the page after one retry, or Sam names Aside, use
Aside in a **new** window (`.cursor/rules/aside-new-window.mdc`). Never
attach to Sam's existing Aside session.
