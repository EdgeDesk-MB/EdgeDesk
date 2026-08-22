/**
 * Hosted account row keyed by Clerk user id (EDGE-20 / EDGE-47).
 * Neon when DATABASE_URL is set; SQLite otherwise (local Mac + Vitest).
 * Billing columns: EDGE-5. Desk locks stay EDGE-22.
 */
import "server-only";
import { eq } from "drizzle-orm";
import {
  db as sqliteDb,
  appUsers as sqliteUsers,
  type AppUserRow as SqliteAppUserRow,
} from "@/lib/db";
import { getNeonDb, getNeonSql } from "@/lib/db/neon";
import { appUsers as pgUsers } from "@/lib/db/schema.pg";
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
  founding: boolean;
  onboardingProfile: OnboardingProfile | null;
};

function usesHostedPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let neonOnboardingColumnReady = false;
let neonDeskSettingsColumnReady = false;

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
  founding?: number | null;
  onboardingProfile?: string | null;
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
    founding: row.founding === 1,
    onboardingProfile: parseOnboardingProfile(row.onboardingProfile),
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
    founding: false,
    onboardingProfile: null,
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
    founding,
    updatedAt: now,
  };

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
