import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, events, bets, balanceTransactions, history } from "@/lib/db";
import type { GoalEvent } from "@/lib/calc";
import { serializeRaceResults } from "@/lib/racing";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  minute: z.number().int().min(0).max(120).optional(),
  status: z.enum(["upcoming", "live", "finished"]).optional(),
  homeLed2: z.boolean().optional(),
  awayLed2: z.boolean().optional(),
  raceWinner: z.string().optional(),
  raceRunners: z
    .array(
      z.object({
        horse: z.string(),
        position: z.number().int().min(0),
      })
    )
    .optional(),
  /** Record a goal with optional scorer - increments the score and the goal timeline */
  addGoal: z
    .object({
      side: z.enum(["home", "away"]),
      player: z.string().optional(),
      og: z.boolean().optional(),
    })
    .optional(),
  /**
   * Retroactively correct a finished football match that went to AET or pens.
   * Sets the 90-minute score, re-opens settled bets, and reverses their ledger entries
   * so the next state poll can re-settle at the correct full-time result.
   */
  correctResult: z
    .object({
      ftHomeScore: z.number().int().min(0),
      ftAwayScore: z.number().int().min(0),
      matchEnding: z.enum(["ft", "aet", "pen"]),
      /** Final score incl. extra time - what the lists display. Defaults to the 90-min score. */
      finalHomeScore: z.number().int().min(0).optional(),
      finalAwayScore: z.number().int().min(0).optional(),
      homeLed2: z.boolean().optional(),
      awayLed2: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = db.select().from(events).where(eq(events.id, Number(id))).get();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const p = parsed.data;
  let goals: GoalEvent[] | string | null = existing.goals;

  if (p.correctResult) {
    const { ftHomeScore, ftAwayScore, matchEnding } = p.correctResult;
    const newHomeLed2 = p.correctResult.homeLed2;
    const newAwayLed2 = p.correctResult.awayLed2;
    // The headline score every list displays - a correction that only fixed
    // the settlement columns used to leave the visible score stale.
    const finalHome = p.correctResult.finalHomeScore ?? ftHomeScore;
    const finalAway = p.correctResult.finalAwayScore ?? ftAwayScore;

    // Keep the goal timeline consistent with the corrected final score so
    // 2UP/trigger evaluation and the history feed agree with it.
    let timeline: GoalEvent[] = existing.goals ? JSON.parse(existing.goals) : [];
    const syncCorrectedTimeline = (side: "home" | "away", target: number) => {
      while (timeline.filter((g) => g.side === side).length > target) {
        const idx = timeline.map((g) => g.side).lastIndexOf(side);
        timeline = timeline.filter((_, i) => i !== idx);
      }
      while (timeline.filter((g) => g.side === side).length < target) {
        timeline = [...timeline, { minute: matchEnding === "ft" ? 90 : 120, side }];
      }
    };
    syncCorrectedTimeline("home", finalHome);
    syncCorrectedTimeline("away", finalAway);

    const updated = db
      .update(events)
      .set({
        matchEnding,
        ftHomeScore,
        ftAwayScore,
        homeScore: finalHome,
        awayScore: finalAway,
        minute: matchEnding === "ft" ? 90 : 120,
        status: "finished",
        goals: JSON.stringify(timeline),
        ...(newHomeLed2 !== undefined ? { homeLed2: newHomeLed2 ? 1 : 0 } : {}),
        ...(newAwayLed2 !== undefined ? { awayLed2: newAwayLed2 ? 1 : 0 } : {}),
      })
      .where(eq(events.id, Number(id)))
      .returning()
      .get();

    // Re-open all settled bets for this event so they re-settle at the corrected 90-min score
    const settledBets = db
      .select()
      .from(bets)
      .where(eq(bets.eventId, Number(id)))
      .all()
      .filter((b) => b.status !== "open");

    for (const bet of settledBets) {
      if (bet.balanceSettled === 1) {
        db.delete(balanceTransactions)
          .where(
            and(
              eq(balanceTransactions.betId, bet.id),
              eq(balanceTransactions.category, "bet_settlement")
            )
          )
          .run();
      }
      db.delete(history)
        .where(and(eq(history.betId, bet.id), eq(history.kind, "settlement")))
        .run();
      db.update(bets)
        .set({ status: "open", settledAt: null, actualProfit: null, balanceSettled: 0 })
        .where(eq(bets.id, bet.id))
        .run();
    }

    return NextResponse.json({ event: updated, resetBets: settledBets.length });
  }

  if (existing.sport === "horse_racing" && p.raceWinner?.trim()) {
    const winner = p.raceWinner.trim();
    const runners =
      p.raceRunners?.length
        ? p.raceRunners
        : [{ horse: winner, position: 1 }];
    goals = serializeRaceResults({
      winner,
      runners,
      fieldSize: runners.length,
    });
    const updated = db
      .update(events)
      .set({
        status: p.status ?? "finished",
        goals,
        homeScore: 1,
        awayScore: 0,
      })
      .where(eq(events.id, Number(id)))
      .returning()
      .get();
    return NextResponse.json({ event: updated });
  }

  let goalEvents: GoalEvent[] = existing.goals ? JSON.parse(existing.goals) : [];

  let homeScore = p.homeScore ?? existing.homeScore;
  let awayScore = p.awayScore ?? existing.awayScore;
  let status = p.status ?? existing.status;

  if (p.addGoal) {
    goalEvents = [
      ...goalEvents,
      {
        minute: p.minute ?? existing.minute,
        side: p.addGoal.side,
        player: p.addGoal.player?.trim() || undefined,
        og: p.addGoal.og || undefined,
      },
    ];
    if (p.addGoal.side === "home") homeScore += 1;
    else awayScore += 1;
    if (status === "upcoming") status = "live";
  }

  // Keep the goal timeline consistent with manual score stepping: stepping down
  // drops that side's most recent goals; stepping up appends anonymous goals
  // (trigger bets then wait for a scorer instead of mis-settling).
  const syncTimeline = (side: "home" | "away", target: number) => {
    while (goalEvents.filter((g) => g.side === side).length > target) {
      const idx = goalEvents.map((g) => g.side).lastIndexOf(side);
      goalEvents = goalEvents.filter((_, i) => i !== idx);
    }
    while (goalEvents.filter((g) => g.side === side).length < target) {
      goalEvents = [...goalEvents, { minute: p.minute ?? existing.minute, side }];
    }
  };
  syncTimeline("home", homeScore);
  syncTimeline("away", awayScore);

  // Latch 2UP flags automatically from manual score entry too
  const homeLed2 = p.homeLed2 ?? (existing.homeLed2 === 1 || homeScore - awayScore >= 2);
  const awayLed2 = p.awayLed2 ?? (existing.awayLed2 === 1 || awayScore - homeScore >= 2);

  const updated = db
    .update(events)
    .set({
      homeScore,
      awayScore,
      minute: p.minute ?? existing.minute,
      status,
      homeLed2: homeLed2 ? 1 : 0,
      awayLed2: awayLed2 ? 1 : 0,
      goals: JSON.stringify(goalEvents),
    })
    .where(eq(events.id, Number(id)))
    .returning()
    .get();

  return NextResponse.json({ event: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db.delete(events).where(eq(events.id, Number(id))).run();
  return NextResponse.json({ ok: true });
}
