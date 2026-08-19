/**
 * Shared feedback inbox. Neon when DATABASE_URL is set (local + Vercel).
 * Never writes to a signed-in user's desk SQLite file.
 *
 * Vitest: EDGEWAYS_DB_PATH temp SQLite (same file as other tests).
 * Local without Neon: data/feedback-inbox.db.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { desc, eq, isNull } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  db as testSqliteDb,
  feedbackReports as sqliteFeedback,
} from "@/lib/db";
import { getNeonDb, getNeonSql } from "@/lib/db/neon";
import { feedbackReports as pgFeedback } from "@/lib/db/schema.pg";
import * as sqliteSchema from "@/lib/db/schema";
import {
  isFeedbackKind,
  toFeedbackListItem,
  type CreateFeedbackInput,
  type FeedbackListItem,
} from "@/lib/feedback/types";

export function usesHostedFeedbackInbox(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const INBOX_DDL = `CREATE TABLE IF NOT EXISTS feedback_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  reply_email TEXT,
  diagnostics_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  linear_issue_id TEXT
)`;

type SqliteInbox = BetterSQLite3Database<typeof sqliteSchema>;
let fileInbox: SqliteInbox | null = null;

function getFileInboxDb(): SqliteInbox {
  if (fileInbox) return fileInbox;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, "feedback-inbox.db"));
  sqlite.exec(INBOX_DDL);
  fileInbox = drizzle(sqlite, { schema: sqliteSchema });
  return fileInbox;
}

function getSqliteInbox(): SqliteInbox {
  if (process.env.EDGEWAYS_DB_PATH?.trim()) {
    return testSqliteDb as SqliteInbox;
  }
  return getFileInboxDb();
}

let neonTableReady = false;

async function ensureNeonFeedbackTable(): Promise<void> {
  if (neonTableReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS feedback_reports (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT NOT NULL,
      reply_email TEXT,
      diagnostics_json TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      linear_issue_id TEXT
    )
  `;
  await sql`ALTER TABLE feedback_reports ALTER COLUMN created_at TYPE bigint`;
  neonTableReady = true;
}

function validateInput(input: CreateFeedbackInput): {
  kind: CreateFeedbackInput["kind"];
  summary: string;
  details: string;
  reply: string | null;
} {
  if (!isFeedbackKind(input.kind)) throw new Error("Invalid feedback kind");
  const summary = input.summary.trim();
  const details = input.details.trim();
  if (!summary) throw new Error("Summary is required");
  if (!details) throw new Error("Details are required");
  return {
    kind: input.kind,
    summary,
    details,
    reply: input.replyEmail?.trim() || null,
  };
}

export async function createFeedbackReport(
  input: CreateFeedbackInput,
  now = Date.now()
): Promise<FeedbackListItem> {
  const { kind, summary, details, reply } = validateInput(input);
  const diagnosticsJson = JSON.stringify(input.diagnostics);

  if (usesHostedFeedbackInbox()) {
    await ensureNeonFeedbackTable();
    const rows = await getNeonDb()
      .insert(pgFeedback)
      .values({
        kind,
        summary,
        details,
        replyEmail: reply,
        diagnosticsJson,
        createdAt: now,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Feedback insert returned no row");
    return toFeedbackListItem(row);
  }

  const row = getSqliteInbox()
    .insert(sqliteFeedback)
    .values({
      kind,
      summary,
      details,
      replyEmail: reply,
      diagnosticsJson,
      createdAt: now,
    })
    .returning()
    .get();
  return toFeedbackListItem(row);
}

export async function listFeedbackReports(limit = 20): Promise<FeedbackListItem[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100);

  if (usesHostedFeedbackInbox()) {
    await ensureNeonFeedbackTable();
    const rows = await getNeonDb()
      .select()
      .from(pgFeedback)
      .orderBy(desc(pgFeedback.createdAt))
      .limit(capped);
    return rows.map(toFeedbackListItem);
  }

  const rows = getSqliteInbox()
    .select()
    .from(sqliteFeedback)
    .orderBy(desc(sqliteFeedback.createdAt))
    .limit(capped)
    .all();
  return rows.map(toFeedbackListItem);
}

export async function listUntriagedFeedbackReports(): Promise<FeedbackListItem[]> {
  if (usesHostedFeedbackInbox()) {
    await ensureNeonFeedbackTable();
    const rows = await getNeonDb()
      .select()
      .from(pgFeedback)
      .where(isNull(pgFeedback.linearIssueId))
      .orderBy(pgFeedback.createdAt);
    return rows.map(toFeedbackListItem);
  }

  const rows = getSqliteInbox()
    .select()
    .from(sqliteFeedback)
    .where(isNull(sqliteFeedback.linearIssueId))
    .orderBy(sqliteFeedback.createdAt)
    .all();
  return rows.map(toFeedbackListItem);
}

export async function markFeedbackReportFiled(
  id: number,
  linearIssueId: string
): Promise<void> {
  const issue = linearIssueId.trim();
  if (!issue) throw new Error("Linear issue id is required");

  if (usesHostedFeedbackInbox()) {
    await ensureNeonFeedbackTable();
    await getNeonDb()
      .update(pgFeedback)
      .set({ linearIssueId: issue })
      .where(eq(pgFeedback.id, id));
    return;
  }

  getSqliteInbox()
    .update(sqliteFeedback)
    .set({ linearIssueId: issue })
    .where(eq(sqliteFeedback.id, id))
    .run();
}
