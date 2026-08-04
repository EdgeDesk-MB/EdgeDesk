#!/usr/bin/env node
/**
 * Supervised `next dev` for Edgeways.
 *
 * Why this exists:
 * - Next.js 16 exits the worker with code 77 when heap usage crosses ~80% of
 *   the V8 heap limit ("Server is approaching the used memory threshold…").
 *   The parent usually respawns, but agent shells, pkill, and Cursor terminal
 *   cleanup often tear the whole tree down, leaving ERR_CONNECTION_REFUSED.
 * - This supervisor lives above `next` and brings it back until you Ctrl+C.
 *
 * Prefer running this in a Terminal / Cursor tab YOU own (not an agent shell):
 *   cd edgeways && npm run dev
 *
 * Or detached from any IDE session:
 *   npm run dev:detached
 */

import { spawn } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const pidPath = path.join(dataDir, "dev-keep.pid");
const port = process.env.PORT || "3000";
const restartDelayMs = Number(process.env.EDGEWAYS_DEV_RESTART_MS || 1000);

let child = null;
let stopping = false;
let generation = 0;
let restarts = 0;

function log(msg) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[dev-keep ${stamp}] ${msg}`);
}

function writePid() {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    pidPath,
    JSON.stringify(
      {
        keepPid: process.pid,
        childPid: child?.pid ?? null,
        port: Number(port),
        startedAt: new Date().toISOString(),
        restarts,
      },
      null,
      2
    ) + "\n"
  );
}

function clearPid() {
  try {
    if (existsSync(pidPath)) {
      const raw = readFileSync(pidPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.keepPid === process.pid) unlinkSync(pidPath);
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`stopping (${signal})`);
  if (child && !child.killed) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  clearPid();
  // Give next a moment, then force-exit the supervisor.
  setTimeout(() => process.exit(0), 500).unref();
}

function start() {
  if (stopping) return;
  generation += 1;
  const gen = generation;

  const nodeOptions = [
    process.env.NODE_OPTIONS,
    // Raise the V8 heap so the 80% auto-restart threshold is farther out.
    // Next.js respects an existing max-old-space-size and will not override it.
    "--max-old-space-size=8192",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const args = ["next", "dev", "--port", String(port)];
  log(
    restarts === 0
      ? `starting next on :${port}`
      : `restart #${restarts} → next on :${port}`
  );

  child = spawn("npx", args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      // Marker for agents: do not pkill this tree unless the user asked.
      EDGEWAYS_DEV_KEEP: "1",
    },
  });

  writePid();

  child.on("exit", (code, signal) => {
    if (stopping || gen !== generation) return;
    restarts += 1;
    child = null;
    writePid();
    log(
      `next exited (code=${code ?? "null"} signal=${signal ?? "null"}); ` +
        `restarting in ${restartDelayMs}ms`
    );
    setTimeout(start, restartDelayMs);
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGHUP", () => {
  // Ignore hangup so a detached/nohup session survives the launching shell.
  log("SIGHUP ignored (supervisor stays up)");
});

start();
