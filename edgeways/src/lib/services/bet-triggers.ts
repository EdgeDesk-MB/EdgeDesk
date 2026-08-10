import { eq } from "drizzle-orm";
import { buildTriggerBundle, serializeTriggerBundle } from "@/lib/calc/ai-triggers";
import { db, events } from "@/lib/db";

export function isFreeBetUsageBetType(betType: string | null | undefined): boolean {
  return betType === "free_snr" || betType === "free_sr";
}

export function resolveTriggerFields(opts: {
  betType?: string | null;
  label: string;
  triggerText?: string | null;
  eventId?: number | null;
  homeTeam?: string;
  awayTeam?: string;
}): { triggerText: string | null; triggerRule: string | null } {
  if (isFreeBetUsageBetType(opts.betType)) {
    return { triggerText: null, triggerRule: null };
  }

  const event = opts.eventId
    ? db.select().from(events).where(eq(events.id, opts.eventId)).get()
    : undefined;

  const built = buildTriggerBundle({
    label: opts.label,
    triggerText: opts.triggerText,
    homeTeam: event?.homeTeam ?? opts.homeTeam ?? "",
    awayTeam: event?.awayTeam ?? opts.awayTeam ?? "",
  });

  return {
    triggerText: built.triggerText,
    triggerRule: serializeTriggerBundle(built.bundle),
  };
}
