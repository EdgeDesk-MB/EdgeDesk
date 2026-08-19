import { describe, expect, it } from "vitest";
import { deskLegAutoResultNote } from "./leg-auto-result-copy";

const pending = {
  linked: true,
  result: "pending" as const,
  moot: false,
  actionDone: false,
  isCurrent: false,
  sport: "horse_racing",
};

describe("deskLegAutoResultNote", () => {
  it("is silent when the leg is not linked", () => {
    expect(deskLegAutoResultNote({ ...pending, linked: false })).toBeNull();
  });

  it("is silent once the leg has a result", () => {
    expect(deskLegAutoResultNote({ ...pending, result: "won" })).toBeNull();
    expect(deskLegAutoResultNote({ ...pending, result: "lost", actionDone: true, isCurrent: true })).toBeNull();
  });

  it("is silent on a sequential-dead pending leg", () => {
    expect(
      deskLegAutoResultNote({ ...pending, moot: true, actionDone: true, isCurrent: true })
    ).toBeNull();
  });

  it("arms later linked legs that are not yet the current wait", () => {
    expect(deskLegAutoResultNote(pending)).toEqual({
      tone: "armed",
      title: "Will auto-result",
      detail: "Settles from the race result.",
    });
  });

  it("uses football copy for a match-odds leg", () => {
    expect(deskLegAutoResultNote({ ...pending, sport: "football" })?.detail).toBe(
      "Settles from the football score."
    );
  });

  it("falls back to tracked-event copy when the sport is unknown", () => {
    expect(deskLegAutoResultNote({ ...pending, sport: null })?.detail).toBe(
      "Settles from the tracked event."
    );
  });

  it("tells the user we are awaiting the current laid leg", () => {
    expect(
      deskLegAutoResultNote({
        ...pending,
        actionDone: true,
        isCurrent: true,
        eventStatus: "upcoming",
      })
    ).toEqual({
      tone: "waiting",
      title: "Awaiting result",
      detail: "Settles from the race result.",
    });
  });

  it("marks a live football leg as in play", () => {
    expect(
      deskLegAutoResultNote({
        ...pending,
        actionDone: true,
        isCurrent: true,
        eventStatus: "live",
        sport: "football",
      })
    ).toEqual({
      tone: "live",
      title: "In play",
      detail: "Awaiting the football score.",
    });
  });

  it("marks a live racing leg as off", () => {
    expect(
      deskLegAutoResultNote({
        ...pending,
        actionDone: true,
        isCurrent: true,
        eventStatus: "live",
      })
    ).toEqual({
      tone: "live",
      title: "Off",
      detail: "Awaiting the race result.",
    });
  });

  it("marks a finished but unsettle current leg as result due", () => {
    expect(
      deskLegAutoResultNote({
        ...pending,
        actionDone: true,
        isCurrent: true,
        eventStatus: "finished",
      })
    ).toEqual({
      tone: "due",
      title: "Result due",
      detail: "The desk will settle this shortly.",
    });
  });

  it("stays armed when the current leg is live but not yet laid", () => {
    expect(
      deskLegAutoResultNote({
        ...pending,
        isCurrent: true,
        eventStatus: "live",
      })
    ).toEqual({
      tone: "armed",
      title: "Will auto-result",
      detail: "Settles from the race result.",
    });
  });
});
