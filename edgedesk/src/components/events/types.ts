export interface Fixture {
  externalId: string;
  sport: "football";
  competition: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  status: "upcoming" | "live" | "finished";
  homeScore: number;
  awayScore: number;
  minute: number;
}

export interface RacingFixture {
  externalId: string;
  sport: "horse_racing";
  competition: string;
  raceName: string;
  course: string;
  startTime: number;
  status: "upcoming" | "live" | "finished";
  fieldSize: number;
  offTime: string;
  runners: string[];
  winner?: string;
}

export const FIXTURE_SPORTS = [
  { id: "football" as const, label: "Football" },
  { id: "horse_racing" as const, label: "Horse racing" },
];

export const simPresets = [
  { value: "two_up_drama", label: "2UP drama (2-0 → 2-2)" },
  { value: "btts_thriller", label: "BTTS thriller (3-2)" },
  { value: "bore_draw", label: "Bore draw (0-0)" },
  { value: "random", label: "Random match" },
];
