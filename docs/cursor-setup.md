# Cursor setup checklist (EdgeDesk)

One-off in-app configuration so Cursor picks up the repo rules and the local
model backbone. Repo-side files are already in place: `AGENTS.md` (root and
`edgedesk/`), `edgedesk/.cursor/rules/*.mdc`, `.cursorignore`.

## 1. Workspace
Open `MB app build/` (the git root) as the workspace, not `edgedesk/`.
The root `AGENTS.md`, `edgedesk/AGENTS.md` and the nested
`edgedesk/.cursor/rules/` are all discovered from there.

## 2. Rules
Cursor Settings, Rules. Confirm:
- Project rules `calc-guardrails` and `design-system` are listed.
- AGENTS.md / instruction-file support is enabled (on by default in recent
  versions).

## 3. Models
- Enable the cloud models from `docs/Local-vs-Cloud-Model-Strategy.md`
  (Sonnet 5, Fable tier). Check exact names in the picker.
- Add the local models as custom models under the OpenAI API key override:
  - Base URL: `http://192.168.50.54:8080/v1` (Linx bridge)
  - Key: `linx` (same dummy key Zed uses)
  - Model names: `qwen3-coder-ctx`, `qwen3:30b-thinking`, `bb-deepseek-70b`
- Known constraints:
  - Cursor Tab autocomplete cannot use custom models; `bb-qwen-14b` ghost text
    stays a Zed-only feature.
  - Custom-endpoint requests may route via Cursor's backend. If the key/URL
    verification fails on the LAN address, point it at the tunnel instead.

## 4. Privacy
Settings, General: enable Privacy Mode (code never used for training).

## 5. Indexing
Settings, Indexing: confirm the codebase index completed after
`.cursorignore` was added; resync if `eng.traineddata` was indexed earlier.

## Verification
1. Open `edgedesk/src/lib/calc/matched.ts`, ask chat a question about it, and
   confirm the `calc-guardrails` rule shows in the context pills.
2. Repeat with a file under `edgedesk/src/components/` for `design-system`.
3. Switch the model picker to `qwen3-coder-ctx` and send one prompt; a reply
   proves the bridge path works from Cursor, not just Zed.
4. Type `@eng.traineddata` in chat; it should no longer be suggested.
