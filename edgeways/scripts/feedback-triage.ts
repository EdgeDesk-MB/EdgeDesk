/**
 * Feedback triage kernel (EDGE-43) — read-only.
 *
 * Lists feedback_reports rows not yet filed to Linear (linear_issue_id IS
 * NULL) and prints a drafted Linear issue per row, so a triage run is one
 * command. Filing stays deliberate: the agent creates the issue via the
 * Linear MCP on approval, then writes back through markFeedbackReportFiled
 * (src/lib/services/feedback.ts) — this script never writes to the DB.
 *
 * Run from edgeways/:
 *   npx tsx scripts/feedback-triage.ts           human-readable drafts
 *   npx tsx scripts/feedback-triage.ts --json    machine-readable for the agent
 *
 * Optional:
 *   EDGEWAYS_DB_PATH=/path/to/edgeways.db npx tsx scripts/feedback-triage.ts
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

function resolveDbPath(): string {
  const override = process.env.EDGEWAYS_DB_PATH?.trim();
  if (override) return path.resolve(override);
  const dataDir = path.join(process.cwd(), "data");
  if (fs.existsSync(path.join(dataDir, "demo-mode"))) {
    return path.join(dataDir, "edgeways-demo.db");
  }
  return path.join(dataDir, "edgeways.db");
}

type FeedbackRow = {
  id: number;
  kind: string;
  summary: string;
  details: string;
  reply_email: string | null;
  diagnostics_json: string;
  created_at: number;
};

type Diagnostics = {
  appVersion?: string;
  href?: string;
  userAgent?: string;
  timezone?: string;
};

const KIND_LABEL: Record<string, string> = {
  bug: "Bug",
  idea: "Idea",
  other: "Other",
};

function parseDiagnostics(raw: string): Diagnostics {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Diagnostics) : {};
  } catch {
    return {};
  }
}

function draftIssue(row: FeedbackRow) {
  const diag = parseDiagnostics(row.diagnostics_json);
  const label = KIND_LABEL[row.kind] ?? "Other";
  const title = `[Feedback] ${row.summary}`;
  const bodyLines = [
    `**Kind:** ${row.kind}`,
    `**Reported:** ${new Date(row.created_at).toISOString()}`,
    "",
    row.details,
    "",
    "---",
    `**App version:** ${diag.appVersion ?? "unknown"}`,
    `**Page:** ${diag.href ?? "unknown"}`,
    `**Timezone:** ${diag.timezone ?? "unknown"}`,
    `**UA:** ${diag.userAgent ?? "unknown"}`,
    row.reply_email ? `**Reply to:** ${row.reply_email}` : null,
    "",
    `Feedback row #${row.id} (write back with markFeedbackReportFiled once filed).`,
  ].filter((l): l is string => l != null);
  return { feedbackId: row.id, title, labels: ["Feedback", label], body: bodyLines.join("\n") };
}

const db = new Database(resolveDbPath(), { readonly: true });
const rows = db
  .prepare(
    "SELECT * FROM feedback_reports WHERE linear_issue_id IS NULL ORDER BY created_at"
  )
  .all() as FeedbackRow[];

const drafts = rows.map(draftIssue);

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({ untriaged: drafts.length, drafts }, null, 2));
  process.exit(0);
}

if (drafts.length === 0) {
  console.log("No untriaged feedback — every row has a Linear issue id.");
  process.exit(0);
}

console.log(`${drafts.length} untriaged feedback report${drafts.length === 1 ? "" : "s"}:\n`);
for (const d of drafts) {
  console.log(`#${d.feedbackId} → ${d.title}`);
  console.log(`  labels: ${d.labels.join(", ")}`);
  console.log(
    `  ${d.body.split("\n").slice(0, 5).join("\n  ")}${d.body.split("\n").length > 5 ? "\n  …" : ""}`
  );
  console.log("");
}
console.log("File via Linear MCP on approval, then markFeedbackReportFiled(id, issue).");
