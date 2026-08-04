/**
 * Built-in live match simulator.
 * A sim event carries a pre-generated goal script; reading state "ticks" the match
 * forward based on wall-clock time. 1 match minute = SIM_SECONDS_PER_MINUTE real seconds.
 */

export const SIM_SECONDS_PER_MINUTE = 2; // full match plays out in 3 minutes

export interface SimGoal {
  minute: number;
  side: "home" | "away";
  /** Scorer name - lets "The bet wins IF" player triggers settle in simulations */
  player?: string;
}

export type SimPreset = "two_up_drama" | "random" | "btts_thriller" | "bore_draw";

export interface SimStars {
  /** Named striker who scores their side's first goal (e.g. "Harry Kane") */
  homeStar?: string;
  awayStar?: string;
}

const SQUAD = ["Nine", "Ten", "Seven", "Eleven", "Eight"];

/** Give every goal a scorer: the side's star takes their first goal, squad players the rest. */
function nameScorers(goals: SimGoal[], stars: SimStars = {}): SimGoal[] {
  const count = { home: 0, away: 0 };
  return goals.map((g) => {
    const nth = count[g.side]++;
    const star = g.side === "home" ? stars.homeStar : stars.awayStar;
    const player =
      nth === 0 && star?.trim() ? star.trim() : `${g.side === "home" ? "H." : "A."} ${SQUAD[nth % SQUAD.length]}`;
    return { ...g, player };
  });
}

export function generateScript(preset: SimPreset, stars: SimStars = {}): SimGoal[] {
  switch (preset) {
    case "two_up_drama":
      // The user's exact scenario: 2-0 up, pegged back to 2-2
      return nameScorers(
        [
          { minute: 18, side: "home" },
          { minute: 34, side: "home" },
          { minute: 61, side: "away" },
          { minute: 83, side: "away" },
        ],
        stars
      );
    case "btts_thriller":
      return nameScorers(
        [
          { minute: 12, side: "home" },
          { minute: 27, side: "away" },
          { minute: 55, side: "home" },
          { minute: 78, side: "away" },
          { minute: 88, side: "home" },
        ],
        stars
      );
    case "bore_draw":
      return [];
    case "random": {
      const goals: SimGoal[] = [];
      const n = Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        goals.push({
          minute: 5 + Math.floor(Math.random() * 85),
          side: Math.random() < 0.55 ? "home" : "away",
        });
      }
      return nameScorers(goals.sort((a, b) => a.minute - b.minute), stars);
    }
  }
}

export interface SimState {
  minute: number;
  homeScore: number;
  awayScore: number;
  homeLed2: boolean;
  awayLed2: boolean;
  finished: boolean;
  /** Goals scored so far, in order - the trigger engine's timeline */
  goals: SimGoal[];
}

/** Replay the script up to the current wall-clock position. */
export function simStateAt(script: SimGoal[], simStartedAt: number, now = Date.now()): SimState {
  const elapsedMinutes = Math.floor((now - simStartedAt) / 1000 / SIM_SECONDS_PER_MINUTE);
  const minute = Math.min(90, Math.max(0, elapsedMinutes));
  let home = 0;
  let away = 0;
  let homeLed2 = false;
  let awayLed2 = false;
  const goals: SimGoal[] = [];
  for (const goal of script) {
    if (goal.minute > minute) break;
    goals.push(goal);
    if (goal.side === "home") home++;
    else away++;
    if (home - away >= 2) homeLed2 = true;
    if (away - home >= 2) awayLed2 = true;
  }
  return { minute, homeScore: home, awayScore: away, homeLed2, awayLed2, finished: minute >= 90, goals };
}
