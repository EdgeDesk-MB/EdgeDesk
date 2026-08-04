import { eq } from "drizzle-orm";
import { buildTriggerBundle, serializeTriggerBundle } from "@/lib/calc/ai-triggers";
import { db, events } from "@/lib/db";

export function resolveTriggerFields(opts: {
  label: string;
  triggerText?: string | null;
  eventId?: number | null;
  homeTeam?: string;
  awayTeam?: string;
}): { triggerText: string | null; triggerRule: string | null } {
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
