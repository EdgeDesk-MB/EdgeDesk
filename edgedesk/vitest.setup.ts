import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Point every `@/lib/db` import at an isolated temp SQLite file for this vitest
 * process. Must run before any test module loads the DB singleton.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "edgedesk-vitest-"));
process.env.EDGEDESK_DB_PATH = path.join(dir, "edgedesk-test.db");
