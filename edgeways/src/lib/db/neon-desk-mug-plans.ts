/**
 * Hosted mug-bet cadence plans. One plan per bookie account, per Clerk user.
 */
import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { listNeonDeskAccounts } from "@/lib/db/neon-desk-accounts";
import { mugPlans as pgMugPlans, type MugPlanRow as PgMugPlanRow } from "@/lib/db/schema.pg";
import type { MugPlanRow } from "@/lib/db/schema";
import type { AppState } from "@/lib/services/state.types";

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toSqliteMugPlan(row: PgMugPlanRow): MugPlanRow {
  return {
    id: row.id,
    accountId: row.accountId,
    cadenceDays: row.cadenceDays,
    monthlyBudget: row.monthlyBudget,
    lastMugAt: row.lastMugAt,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export async function listNeonMugPlans(): Promise<MugPlanRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgMugPlans)
    .where(eq(pgMugPlans.clerkUserId, clerkUserId));
  return rows.map(toSqliteMugPlan);
}

export async function listNeonMugPlansForState(): Promise<AppState["mugPlans"]> {
  const [plans, accounts] = await Promise.all([
    listNeonMugPlans(),
    listNeonDeskAccounts(),
  ]);
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  return plans.flatMap((p) => {
    const accountName = nameById.get(p.accountId);
    return accountName
      ? [
          {
            id: p.id,
            accountId: p.accountId,
            accountName,
            cadenceDays: p.cadenceDays,
            monthlyBudget: p.monthlyBudget,
            lastMugAt: p.lastMugAt,
          },
        ]
      : [];
  });
}

export async function upsertNeonMugPlan(input: {
  accountId: number;
  cadenceDays: number;
  monthlyBudget?: number | null;
  notes?: string | null;
}): Promise<MugPlanRow> {
  const clerkUserId = requireClerk("save a mug plan");
  const accounts = await listNeonDeskAccounts(clerkUserId);
  if (!accounts.some((a) => a.id === input.accountId)) {
    throw new Error("Account not found");
  }
  const existing = await getNeonDb()
    .select()
    .from(pgMugPlans)
    .where(
      and(
        eq(pgMugPlans.accountId, input.accountId),
        eq(pgMugPlans.clerkUserId, clerkUserId)
      )
    )
    .limit(1);
  if (existing[0]) {
    const rows = await getNeonDb()
      .update(pgMugPlans)
      .set({
        cadenceDays: input.cadenceDays,
        monthlyBudget: input.monthlyBudget ?? null,
        notes: input.notes ?? null,
      })
      .where(and(eq(pgMugPlans.id, existing[0].id), eq(pgMugPlans.clerkUserId, clerkUserId)))
      .returning();
    if (!rows[0]) throw new Error("Mug plan not found");
    return toSqliteMugPlan(rows[0]);
  }
  const rows = await getNeonDb()
    .insert(pgMugPlans)
    .values({
      accountId: input.accountId,
      cadenceDays: input.cadenceDays,
      monthlyBudget: input.monthlyBudget ?? null,
      notes: input.notes ?? null,
      createdAt: Date.now(),
      clerkUserId,
    })
    .returning();
  if (!rows[0]) throw new Error("Neon did not return the mug plan.");
  return toSqliteMugPlan(rows[0]);
}

export async function deleteNeonMugPlan(id: number): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const existing = await getNeonDb()
    .select()
    .from(pgMugPlans)
    .where(and(eq(pgMugPlans.id, id), eq(pgMugPlans.clerkUserId, clerkUserId)))
    .limit(1);
  if (!existing[0]) return false;
  await getNeonDb()
    .delete(pgMugPlans)
    .where(and(eq(pgMugPlans.id, id), eq(pgMugPlans.clerkUserId, clerkUserId)));
  return true;
}

/** Stamp cadence plans for matching bookie wallets. Only moves lastMugAt forward. */
export async function stampNeonMugPlansForBookmaker(
  bookmaker: string,
  placedAt: number
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const target = bookmaker.trim().toLowerCase();
  if (!target) return;
  const accounts = await listNeonDeskAccounts(clerkUserId);
  const matchingIds = accounts
    .filter((a) => a.name.trim().toLowerCase() === target)
    .map((a) => a.id);
  if (matchingIds.length === 0) return;
  const plans = await getNeonDb()
    .select()
    .from(pgMugPlans)
    .where(
      and(
        eq(pgMugPlans.clerkUserId, clerkUserId),
        inArray(pgMugPlans.accountId, matchingIds)
      )
    );
  for (const plan of plans) {
    if ((plan.lastMugAt ?? 0) >= placedAt) continue;
    await getNeonDb()
      .update(pgMugPlans)
      .set({ lastMugAt: placedAt })
      .where(and(eq(pgMugPlans.id, plan.id), eq(pgMugPlans.clerkUserId, clerkUserId)));
  }
}
