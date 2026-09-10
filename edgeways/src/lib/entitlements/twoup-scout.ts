import { canDesk, type DeskGateSettings } from "./effective-plan";

export type TwoupScoutGateSettings = DeskGateSettings & {
  twoupScoutPreview?: boolean | null;
};

/** Edge plan plus the preview latch injected by settings / state. */
export function canUseTwoupScout(
  settings: TwoupScoutGateSettings | null | undefined
): boolean {
  if (settings?.twoupScoutPreview !== true) return false;
  return canDesk(settings, "twoup_scout");
}
