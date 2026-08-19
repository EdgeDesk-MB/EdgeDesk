/**
 * Feedback triage kernel (EDGE-43) — read-only.
 *
 * Lists hosted inbox rows not yet filed to Linear (linear_issue_id IS NULL)
 * and prints a drafted Linear issue per row. Filing stays deliberate.
 *
 * Reads Neon when DATABASE_URL is set. Otherwise SQLite:
 *   EDGEWAYS_DB_PATH, then data/feedback-inbox.db, then data/edgeways.db
 *
 * Run from edgeways/:
 *   npx tsx scripts/feedback-triage.ts           human-readable drafts
 *   npx tsx scripts/feedback-triage.ts --json    machine-readable for the agent
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

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
  signedInEmail?: string | null;
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
    `**Reported:** ${new Date(Number(row.created_at)).toISOString()}`,
    "",
    row.details,
    "",
    "---",
    `**App version:** ${diag.appVersion ?? "unknown"}`,
    `**Timezone:** ${diag.timezone ?? "unknown"}`,
    `**UA:** ${diag.userAgent ?? "unknown"}`,
    row.reply_email ? `**Reply to:** ${row.reply_email}` : null,
    diag.signedInEmail ? `**Signed in:** ${diag.signedInEmail}` : null,
    "",
    `Feedback row #${row.id} (write back with markFeedbackReportFiled once filed).`,
  ].filter((l): l is string => l != null);
  return { feedbackId: row.id, title, labels: ["Feedback", label], body: bodyLines.join("\n") };
}

function resolveSqlitePath(): string | null {
  const override = process.env.EDGEWAYS_DB_PATH?.trim();
  if (override) return path.resolve(override);
  const dataDir = path.join(process.cwd(), "data");
  const inbox = path.join(dataDir, "feedback-inbox.db");
  if (fs.existsSync(inbox)) return inbox;
  if (fs.existsSync(path.join(dataDir, "demo-mode"))) {
    return path.join(dataDir, "edgeways-demo.db");
  }
  const owner = path.join(dataDir, "edgeways.db");
  return fs.existsSync(owner) ? owner : null;
}

async function loadUntriaged(): Promise<FeedbackRow[]> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const sql = neon(url);
    const rows = await sql`
      SELECT id, kind, summary, details, reply_email, diagnostics_json, created_at
      FROM feedback_reports
      WHERE linear_issue_id IS NULL
      ORDER BY created_at
    `;
    return rows as FeedbackRow[];
  }

  const dbPath = resolveSqlitePath();
  if (!dbPath) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(
        "SELECT id, kind, summary, details, reply_email, diagnostics_json, created_at FROM feedback_reports WHERE linear_issue_id IS NULL ORDER BY created_at"
      )
      .all() as FeedbackRow[];
  } finally {
    db.close();
  }
}

async function main() {
  const rows = await loadUntriaged();
  const drafts = rows.map(draftIssue);

  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify({ untriaged: drafts.length, drafts }, null, 2));
    return;
  }

  if (drafts.length === 0) {
    console.log("No untriaged feedback — every row has a Linear issue id.");
    return;
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
