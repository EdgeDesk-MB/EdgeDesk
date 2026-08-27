/**
 * One-shot: upsert every app_users email into Resend Audience segments.
 * Usage: npm run resend:audience-sync
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { listAppUsers } from "@/lib/services/app-users";
import { syncAppUserToResendAudience } from "@/lib/admin/resend-audience-sync";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const users = await listAppUsers();
  let synced = 0;
  let skipped = 0;
  for (const user of users) {
    const result = await syncAppUserToResendAudience(user);
    if (result.synced) synced += 1;
    else skipped += 1;
  }
  console.log(`Resend audience backfill: ${synced} synced, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error("Resend audience backfill failed:", err);
  process.exit(1);
});
