import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Point every `@/lib/db` import at an isolated temp SQLite file for this vitest
 * process. Must run before any test module loads the DB singleton.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edgeways-vitest-"));
process.env.EDGEWAYS_DB_PATH = path.join(dir, "edgeways-test.db");
// Waitlist tests use SQLite; don't hit Neon even if .env.local has DATABASE_URL.
delete process.env.DATABASE_URL;
