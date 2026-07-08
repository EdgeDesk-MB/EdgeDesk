import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, events } from "@/lib/db";
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
  /** Record a goal with optional scorer — increments the score and the goal timeline */
  addGoal: z
    .object({
      side: z.enum(["home", "away"]),
      player: z.string().optional(),
      og: z.boolean().optional(),
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
