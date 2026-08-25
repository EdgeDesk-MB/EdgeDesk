import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { NextRequest, NextResponse } from "next/server";
import { backupDatabaseTo, restoreDatabaseFrom, resolveDbPath } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  hostedBackupCounts,
  isHostedBackupTables,
  restoreNeonDeskBackup,
} from "@/lib/db/neon-desk-backup";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** Tables a valid Edgeways backup must contain. */
const CORE_TABLES = ["bets", "accounts", "offers", "balance_transactions"];

function stagedPath(token: string): string {
  return path.join(path.dirname(resolveDbPath()), `restore-staged-${token}.db`);
}

interface ValidationResult {
  ok: boolean;
  reason?: string;
  counts?: Record<string, number>;
}

function validateBackupFile(filePath: string): ValidationResult {
  let candidate: Database.Database | null = null;
  try {
    candidate = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = candidate.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") return { ok: false, reason: `Integrity check failed: ${integrity}` };

    const tables = new Set(
      (
        candidate
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as Array<{ name: string }>
      ).map((t) => t.name)
    );
    const missing = CORE_TABLES.filter((t) => !tables.has(t));
    if (missing.length > 0) {
      return { ok: false, reason: `Not an Edgeways backup - missing tables: ${missing.join(", ")}` };
    }

    const counts: Record<string, number> = {};
    for (const t of CORE_TABLES) {
      counts[t] = (candidate.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n: number }).n;
    }
    return { ok: true, counts };
  } catch (e) {
    return { ok: false, reason: `Not a readable SQLite file (${String(e)})` };
  } finally {
    candidate?.close();
  }
}

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") ?? "preview";

  if (isNeonDesk()) {
    // Hosted desk: no filesystem staging on Vercel, so the client posts the
    // JSON bundle again for apply (no token).
    const body = (await req.json().catch(() => null)) as {
      tables?: unknown;
    } | null;
    if (!body) {
      // Unparseable body on Vercel almost always means the upload exceeded
      // the platform request-size limit (full SQLite JSON dumps include feed
      // caches and are far too big - the desk JSON is the portable one).
      return NextResponse.json(
        {
          error:
            "That file could not be read - use the JSON backup from Settings → Data & backup (desk data only, not the .db file).",
        },
        { status: 400 }
      );
    }
    if (!isHostedBackupTables(body.tables)) {
      return NextResponse.json(
        { error: "Not an Edgeways JSON backup - expected a tables object." },
        { status: 400 }
      );
    }
    if (mode === "preview") {
      return NextResponse.json({
        hosted: true,
        counts: hostedBackupCounts(body.tables),
      });
    }
    if (mode === "apply") {
      try {
        const counts = await restoreNeonDeskBackup(body.tables);
        return NextResponse.json({ ok: true, hosted: true, counts });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Restore failed.";
        const status = message.startsWith("Sign in") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
      }
    }
    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  }

  if (mode === "preview") {
    const body = Buffer.from(await req.arrayBuffer());
    if (body.length === 0) {
      return NextResponse.json({ error: "Empty upload" }, { status: 400 });
    }
    // Abandoned previews leave full DB copies next to the live DB - sweep
    // staged files older than an hour.
    const dataDir = path.dirname(resolveDbPath());
    if (fs.existsSync(dataDir)) {
      for (const f of fs.readdirSync(dataDir)) {
        const m = /^restore-staged-(\d+)\.db$/.exec(f);
        if (m && Date.now() - Number(m[1]) > 60 * 60_000) {
          fs.rmSync(path.join(dataDir, f), { force: true });
        }
      }
    }
    const token = String(Date.now());
    const staged = stagedPath(token);
    fs.mkdirSync(path.dirname(staged), { recursive: true });
    fs.writeFileSync(staged, body);

    const result = validateBackupFile(staged);
    if (!result.ok) {
      fs.rmSync(staged, { force: true });
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ token, counts: result.counts });
  }

  if (mode === "apply") {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    if (!/^\d+$/.test(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const staged = stagedPath(token);
    if (!fs.existsSync(staged)) {
      return NextResponse.json({ error: "Staged file expired - upload again" }, { status: 410 });
    }
    // Re-validate: never apply a file that stopped being sound.
    const result = validateBackupFile(staged);
    if (!result.ok) {
      fs.rmSync(staged, { force: true });
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    const dbPath = resolveDbPath();
    const backupsDir = path.join(path.dirname(dbPath), "backups");
    fs.mkdirSync(backupsDir, { recursive: true });
    const safetyCopy = path.join(backupsDir, `pre-restore-${token}.db`);

    // Safety copy FIRST (WAL-safe), then a transactional ATTACH-copy into
    // the live connection - the DB file is never swapped on disk.
    await backupDatabaseTo(safetyCopy);
    try {
      const { tablesRestored } = restoreDatabaseFrom(staged);
      return NextResponse.json({ ok: true, counts: result.counts, tablesRestored, safetyCopy });
    } finally {
      fs.rmSync(staged, { force: true });
    }
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
});
