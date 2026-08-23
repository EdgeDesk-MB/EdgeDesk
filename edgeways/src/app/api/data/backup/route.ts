import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db, backupDatabaseTo } from "@/lib/db";
import { APP_VERSION } from "@/lib/app-version";
import { sql } from "drizzle-orm";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  HOSTED_BACKUP_TABLES,
  neonDeskBackupBundle,
} from "@/lib/db/neon-desk-backup";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export const GET = withDeskScope(async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "sqlite";

  if (isNeonDesk()) {
    // Hosted desk: there is no .db file to copy - the JSON bundle is the backup.
    if (format !== "json") {
      return NextResponse.json(
        { error: "On the hosted desk, use the JSON backup." },
        { status: 400 }
      );
    }
    try {
      const bundle = await neonDeskBackupBundle();
      return new NextResponse(JSON.stringify(bundle), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="edgeways-backup-${stamp()}.json"`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not build the backup.";
      const status = message.startsWith("Sign in") ? 401 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (format === "json") {
    // Desk-portable bundle: only the tables the hosted restore accepts
    // (HOSTED_BACKUP_TABLES). A full sqlite_master dump used to include feed
    // caches like racing_odds_snapshots - 150MB+ of re-derivable rows that
    // blow past Vercel's request body limit when posted to a hosted restore.
    // Local disaster recovery uses the .db snapshot, so nothing is lost.
    const dump: Record<string, unknown[]> = {};
    for (const name of HOSTED_BACKUP_TABLES) {
      dump[name] = db.all(sql.raw(`SELECT * FROM "${name.replace(/"/g, '""')}"`));
    }
    const bundle = { app: APP_VERSION, exportedAt: new Date().toISOString(), tables: dump };
    return new NextResponse(JSON.stringify(bundle), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="edgeways-backup-${stamp()}.json"`,
      },
    });
  }

  // WAL-safe online snapshot via better-sqlite3's backup API.
  const tmp = path.join(os.tmpdir(), `edgeways-backup-${Date.now()}.db`);
  try {
    await backupDatabaseTo(tmp);
    const bytes = fs.readFileSync(tmp);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="edgeways-backup-${stamp()}.db"`,
      },
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});
