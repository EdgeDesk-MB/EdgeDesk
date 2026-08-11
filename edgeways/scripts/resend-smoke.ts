/**
 * Resend domain/API smoke (EDGE-26 env check).
 * Usage: npm run db:resend-smoke  — verifies API key can list domains.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("RESEND_API_KEY missing in .env.local");
    process.exit(1);
  }

  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend API error:", res.status, body);
    process.exit(1);
  }

  const names = (body.data ?? []).map((d: { name?: string; status?: string }) =>
    `${d.name} (${d.status})`,
  );
  console.log("Resend smoke OK:", {
    from: process.env.RESEND_FROM ?? "(unset)",
    domains: names,
  });
}

main().catch((err) => {
  console.error("Resend smoke failed:", err);
  process.exit(1);
});
