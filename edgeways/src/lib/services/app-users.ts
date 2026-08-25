/**
 * Hosted account row keyed by Clerk user id (EDGE-20 / EDGE-47).
 * Neon when DATABASE_URL is set; SQLite otherwise (local Mac + Vitest).
 * Billing columns: EDGE-5. Desk locks stay EDGE-22.
 */
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db as sqliteDb,
  appUsers as sqliteUsers,
  type AppUserRow as SqliteAppUserRow,
} from "@/lib/db";
import { getNeonDb, getNeonSql } from "@/lib/db/neon";
import { appUsers as pgUsers } from "@/lib/db/schema.pg";
import {
  bootstrapAdminEmails,
  isBootstrapAdminEmail,
  isOperatorAdmin,
  parseAppUserRole,
  type AppUserRole,
} from "@/lib/admin/emails";
import { adminRoleChangeBlock } from "@/lib/admin/roles";
import type { PlanId } from "@/lib/entitlements/plans";
import type {
  AppUserEntitlement,
  BillingStatus,
} from "@/lib/billing/entitlement-from-stripe";
import {
  parseOnboardingProfile,
  serializeOnboardingProfile,
  type OnboardingProfile,
} from "@/lib/onboarding-profile";

export type AppUser = {
  clerkUserId: string;
  email: string | null;
  createdAt: number;
  updatedAt: number;
  plan: PlanId;
  billingStatus: BillingStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: number | null;
  /** Scheduled cancellation (epoch ms) while access continues. */
  cancelAt: number | null;
  founding: boolean;
  onboardingProfile: OnboardingProfile | null;
  role: AppUserRole;
};

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let neonOnboardingColumnReady = false;
let neonDeskSettingsColumnReady = false;
let neonRoleColumnReady = false;
let neonCancelAtColumnReady = false;
let neonOperatorSettingsReady = false;

async function ensureNeonOnboardingColumn(): Promise<void> {
  if (neonOnboardingColumnReady) return;
  const sql = getNeonSql();
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS onboarding_profile text`;
  neonOnboardingColumnReady = true;
}

export async function ensureNeonDeskSettingsColumn(): Promise<void> {
  if (neonDeskSettingsColumnReady) return;
  const sql = getNeonSql();
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS desk_settings text`;
  neonDeskSettingsColumnReady = true;
}

export async function ensureNeonRoleColumn(): Promise<void> {
  if (neonRoleColumnReady) return;
  const sql = getNeonSql();
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'`;
  neonRoleColumnReady = true;
}

export async function ensureNeonCancelAtColumn(): Promise<void> {
  if (neonCancelAtColumnReady) return;
  const sql = getNeonSql();
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS cancel_at bigint`;
  neonCancelAtColumnReady = true;
}

export async function ensureNeonOperatorSettingsTable(): Promise<void> {
  if (neonOperatorSettingsReady) return;
  const sql = getNeonSql();
  await sql`
    CREATE TABLE IF NOT EXISTS operator_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at bigint NOT NULL
    )
  `;
  neonOperatorSettingsReady = true;
}

function asPlan(value: string | null | undefined): PlanId {
  if (value === "core" || value === "edge" || value === "free") return value;
  return "free";
}

function asStatus(value: string | null | undefined): BillingStatus {
  if (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

function fromRow(row: {
  clerkUserId: string;
  email: string | null;
  createdAt: number;
  updatedAt: number;
  plan?: string | null;
  billingStatus?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndsAt?: number | null;
  cancelAt?: number | null;
  founding?: number | null;
  onboardingProfile?: string | null;
  role?: string | null;
}): AppUser {
  return {
    clerkUserId: row.clerkUserId,
    email: row.email ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    plan: asPlan(row.plan),
    billingStatus: asStatus(row.billingStatus),
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? null,
    trialEndsAt: row.trialEndsAt ?? null,
    cancelAt: row.cancelAt ?? null,
    founding: row.founding === 1,
    onboardingProfile: parseOnboardingProfile(row.onboardingProfile),
    role: parseAppUserRole(row.role),
  };
}

export function normaliseAppUserEmail(
  email: string | null | undefined
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function findAppUserByClerkId(
  clerkUserId: string
): Promise<AppUser | undefined> {
  if (usesHostedPostgres()) {
    await ensureNeonOnboardingColumn();
    await ensureNeonRoleColumn();
    await ensureNeonCancelAtColumn();
    const rows = await getNeonDb()
      .select()
      .from(pgUsers)
      .where(eq(pgUsers.clerkUserId, clerkUserId))
      .limit(1);
    const row = rows[0];
    return row ? fromRow(row) : undefined;
  }

  const row = sqliteDb
    .select()
    .from(sqliteUsers)
    .where(eq(sqliteUsers.clerkUserId, clerkUserId))
    .get() as SqliteAppUserRow | undefined;
  return row ? fromRow(row) : undefined;
}

export async function findAppUserByStripeCustomerId(
  customerId: string
): Promise<AppUser | undefined> {
  const id = customerId.trim();
  if (!id) return undefined;
  if (usesHostedPostgres()) {
    await ensureNeonOnboardingColumn();
    await ensureNeonCancelAtColumn();
    const rows = await getNeonDb()
      .select()
      .from(pgUsers)
      .where(eq(pgUsers.stripeCustomerId, id))
      .limit(1);
    const row = rows[0];
    return row ? fromRow(row) : undefined;
  }
  const row = sqliteDb
    .select()
    .from(sqliteUsers)
    .where(eq(sqliteUsers.stripeCustomerId, id))
    .get() as SqliteAppUserRow | undefined;
  return row ? fromRow(row) : undefined;
}

/** Insert or refresh email on an existing Clerk-keyed row. */
export async function ensureAppUser(input: {
  clerkUserId: string;
  email?: string | null;
}): Promise<AppUser> {
  const clerkUserId = input.clerkUserId.trim();
  if (!clerkUserId) {
    throw new Error("clerkUserId is required.");
  }
  const email = normaliseAppUserEmail(input.email);
  const now = Date.now();
  const existing = await findAppUserByClerkId(clerkUserId);
  const createdAt = existing?.createdAt ?? now;
  const nextEmail = email ?? existing?.email ?? null;

  if (usesHostedPostgres()) {
    await getNeonDb()
      .insert(pgUsers)
      .values({
        clerkUserId,
        email: nextEmail,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pgUsers.clerkUserId,
        set: { email: nextEmail, updatedAt: now },
      });
  } else {
    sqliteDb
      .insert(sqliteUsers)
      .values({
        clerkUserId,
        email: nextEmail,
        createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: sqliteUsers.clerkUserId,
        set: { email: nextEmail, updatedAt: now },
      })
      .run();
  }

  return (await findAppUserByClerkId(clerkUserId)) ?? {
    clerkUserId,
    email: nextEmail,
    createdAt,
    updatedAt: now,
    plan: "free",
    billingStatus: "none",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEndsAt: null,
    cancelAt: null,
    founding: false,
    onboardingProfile: null,
    role: "user",
  };
}

export async function applyAppUserEntitlement(input: {
  clerkUserId: string;
  email?: string | null;
  entitlement: AppUserEntitlement;
}): Promise<AppUser> {
  await ensureAppUser({
    clerkUserId: input.clerkUserId,
    email: input.email,
  });
  const now = Date.now();
  const { entitlement } = input;
  const founding = entitlement.founding ? 1 : 0;
  const set = {
    plan: entitlement.plan,
    billingStatus: entitlement.billingStatus,
    stripeCustomerId: entitlement.stripeCustomerId,
    stripeSubscriptionId: entitlement.stripeSubscriptionId,
    trialEndsAt: entitlement.trialEndsAt,
    cancelAt: entitlement.cancelAt,
    founding,
    updatedAt: now,
  };

  if (usesHostedPostgres()) {
    await ensureNeonCancelAtColumn();
    await getNeonDb()
      .update(pgUsers)
      .set(set)
      .where(eq(pgUsers.clerkUserId, input.clerkUserId.trim()));
  } else {
    sqliteDb
      .update(sqliteUsers)
      .set(set)
      .where(eq(sqliteUsers.clerkUserId, input.clerkUserId.trim()))
      .run();
  }

  const row = await findAppUserByClerkId(input.clerkUserId);
  if (!row) throw new Error("app_users row missing after entitlement write.");
  return row;
}

export async function saveAppUserOnboardingProfile(input: {
  clerkUserId: string;
  profile: OnboardingProfile;
}): Promise<AppUser> {
  await ensureAppUser({ clerkUserId: input.clerkUserId });
  if (usesHostedPostgres()) await ensureNeonOnboardingColumn();
  const now = Date.now();
  const json = serializeOnboardingProfile({
    ...input.profile,
    savedAt: input.profile.savedAt || now,
  });
  const set = { onboardingProfile: json, updatedAt: now };
  if (usesHostedPostgres()) {
    await getNeonDb()
      .update(pgUsers)
      .set(set)
      .where(eq(pgUsers.clerkUserId, input.clerkUserId.trim()));
  } else {
    sqliteDb
      .update(sqliteUsers)
      .set(set)
      .where(eq(sqliteUsers.clerkUserId, input.clerkUserId.trim()))
      .run();
  }
  const row = await findAppUserByClerkId(input.clerkUserId);
  if (!row) throw new Error("app_users row missing after onboarding write.");
  return row;
}

export type AdminUserRow = AppUser & {
  admin: boolean;
  bootstrap: boolean;
};

export async function listAppUsers(): Promise<AdminUserRow[]> {
  if (usesHostedPostgres()) {
    await ensureNeonOnboardingColumn();
    await ensureNeonRoleColumn();
    await ensureNeonCancelAtColumn();
    const rows = await getNeonDb()
      .select()
      .from(pgUsers)
      .orderBy(desc(pgUsers.createdAt));
    return rows.map((row) => toAdminUserRow(fromRow(row)));
  }
  const rows = sqliteDb
    .select()
    .from(sqliteUsers)
    .orderBy(desc(sqliteUsers.createdAt))
    .all() as SqliteAppUserRow[];
  return rows.map((row) => toAdminUserRow(fromRow(row)));
}

function toAdminUserRow(user: AppUser): AdminUserRow {
  return {
    ...user,
    admin: isOperatorAdmin({ email: user.email, role: user.role }),
    bootstrap: isBootstrapAdminEmail(user.email),
  };
}

export async function countOperatorAdmins(): Promise<number> {
  const users = await listAppUsers();
  return users.filter((user) => user.admin).length;
}

export async function setAppUserRole(input: {
  clerkUserId: string;
  role: AppUserRole;
}): Promise<AdminUserRow> {
  const clerkUserId = input.clerkUserId.trim();
  const current = await findAppUserByClerkId(clerkUserId);
  if (!current) {
    throw new Error("not-found");
  }
  const block = adminRoleChangeBlock({
    email: current.email,
    currentRole: current.role,
    nextRole: input.role,
    adminCount: await countOperatorAdmins(),
  });
  if (block === "bootstrap") throw new Error("bootstrap");
  if (block === "last-admin") throw new Error("last-admin");

  const now = Date.now();
  if (usesHostedPostgres()) {
    await ensureNeonRoleColumn();
    if (input.role === "user") {
      // Atomic last-admin guard: the count is re-checked inside the UPDATE so
      // two concurrent demotions cannot both pass the read-then-write check.
      const bootstrap = bootstrapAdminEmails();
      const updated = await getNeonDb()
        .update(pgUsers)
        .set({ role: "user", updatedAt: now })
        .where(
          and(
            eq(pgUsers.clerkUserId, clerkUserId),
            sql`(
              SELECT COUNT(*) FROM app_users
              WHERE role = 'admin' OR lower(email) = ANY(${bootstrap})
            ) > 1`
          )
        )
        .returning({ clerkUserId: pgUsers.clerkUserId });
      if (updated.length === 0) throw new Error("last-admin");
    } else {
      await getNeonDb()
        .update(pgUsers)
        .set({ role: input.role, updatedAt: now })
        .where(eq(pgUsers.clerkUserId, clerkUserId));
    }
  } else {
    sqliteDb
      .update(sqliteUsers)
      .set({ role: input.role, updatedAt: now })
      .where(eq(sqliteUsers.clerkUserId, clerkUserId))
      .run();
  }

  const row = await findAppUserByClerkId(clerkUserId);
  if (!row) throw new Error("app_users row missing after role write.");
  return toAdminUserRow(row);
}
