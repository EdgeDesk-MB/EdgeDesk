/**
 * Mark local install folders so iCloud Documents does not evict them.
 * Do not symlink node_modules: Turbopack then bundles better-sqlite3 and
 * the native binding resolves under .next.
 */
import { existsSync, lstatSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function ignoreIcloud(dir) {
  if (!existsSync(dir)) return;
  try {
    if (lstatSync(dir).isSymbolicLink()) return;
  } catch {
    return;
  }
  try {
    execFileSync("xattr", ["-w", "com.apple.fileprovider.ignore#S", "1", dir], {
      stdio: "ignore",
    });
  } catch {
    // Non-macOS or xattr missing; leave the folder as-is.
  }
}

ignoreIcloud(path.join(root, "node_modules"));
ignoreIcloud(path.join(root, ".next"));
