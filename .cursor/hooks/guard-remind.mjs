#!/usr/bin/env node
/**
 * Guard reminders after file edits (EDGE-40).
 * Money-maths paths -> calc-auditor reminder. UI paths -> design-system reminder.
 * Always fails open: a reminder hook must never block work.
 */
let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let file = "";
try {
  const input = JSON.parse(raw);
  file = input.file_path ?? input.filePath ?? input.path ?? "";
} catch {
  process.exit(0);
}

const remind = (additionalContext) => {
  process.stdout.write(JSON.stringify({ additional_context: additionalContext }));
};

if (/edgeways\/src\/lib\/(calc|offers)\//.test(file)) {
  remind(
    `Money-maths path edited (${file}). Before finishing: run the relevant vitest files, and delegate a calc-auditor review (.cursor/agents/calc-auditor.md). Never weaken or delete a passing calc test.`
  );
} else if (/edgeways\/src\/(app|components)\//.test(file)) {
  remind(
    `UI path edited (${file}). Check docs/design-system.md conformance: colour tokens only, no UI copy below 11px, shared surface styles. For non-trivial UI diffs, delegate the consistency-checker subagent.`
  );
}

process.exit(0);
