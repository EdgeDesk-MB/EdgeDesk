import { describe, expect, it } from "vitest";
import { parseEmlToOfferText } from "./parse-email";

const CRLF = "\r\n";

describe("parseEmlToOfferText", () => {
  it("plain text email: subject prepended, body preserved", () => {
    const eml = [
      "From: offers@skybet.com",
      "To: sam@example.com",
      "Subject: Bet 10 get 30 this weekend",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "Place a £10 bet on any football market",
      "and get £30 in free bets.",
    ].join(CRLF);
    const r = parseEmlToOfferText(eml);
    if (!r) throw new Error("expected parse");
    expect(r.subject).toBe("Bet 10 get 30 this weekend");
    expect(r.offerText).toContain("Bet 10 get 30 this weekend");
    expect(r.offerText).toContain("Place a £10 bet on any football market");
  });

  it("multipart/alternative prefers text/plain and decodes quoted-printable", () => {
    // £ in UTF-8 quoted-printable is =C2=A3; soft break =\r\n joins lines
    const eml = [
      "Subject: Weekend acca offer",
      'Content-Type: multipart/alternative; boundary="BOUND"',
      "",
      "--BOUND",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Bet =C2=A350 get =C2=A350 free bet if your acca los=",
      "es by one leg.",
      "--BOUND",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<p>HTML VERSION - MUST NOT WIN</p>",
      "--BOUND--",
    ].join(CRLF);
    const r = parseEmlToOfferText(eml);
    if (!r) throw new Error("expected parse");
    expect(r.offerText).toContain("Bet £50 get £50 free bet if your acca loses by one leg.");
    expect(r.offerText).not.toContain("MUST NOT WIN");
  });

  it("HTML-only base64 email: tags stripped, entities decoded, breaks kept", () => {
    const html =
      "<html><head><style>p{color:red}</style></head><body>" +
      "<h1>Cheltenham boost</h1><p>Bet &pound;25 get &pound;5 free<br>per day</p>" +
      '<a href="https://sky.bet/x">Claim now</a><script>evil()</script></body></html>';
    const b64 = Buffer.from(html, "utf-8").toString("base64");
    const eml = [
      "Subject: =?UTF-8?B?" + Buffer.from("Chelt boost 🎁", "utf-8").toString("base64") + "?=",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64,
    ].join(CRLF);
    const r = parseEmlToOfferText(eml);
    if (!r) throw new Error("expected parse");
    expect(r.subject).toBe("Chelt boost 🎁");
    expect(r.offerText).toContain("Bet £25 get £5 free");
    expect(r.offerText).toContain("Claim now");
    expect(r.offerText).not.toContain("<p>");
    expect(r.offerText).not.toContain("color:red");
    expect(r.offerText).not.toContain("evil()");
    // <br> became a line break between "free" and "per day"
    expect(r.offerText).toMatch(/free\s*\n\s*per day/);
  });

  it("RFC2047 Q-encoded subject: underscores become spaces", () => {
    const eml = [
      "Subject: =?UTF-8?Q?Bet_=C2=A310_Get_=C2=A330?=",
      "Content-Type: text/plain",
      "",
      "body",
    ].join(CRLF);
    const r = parseEmlToOfferText(eml);
    expect(r?.subject).toBe("Bet £10 Get £30");
  });

  it("folded headers unfold before parsing", () => {
    const eml = [
      "Subject: A very long promo",
      " continued on the next line",
      "Content-Type: text/plain",
      "",
      "body",
    ].join(CRLF);
    expect(parseEmlToOfferText(eml)?.subject).toBe("A very long promo continued on the next line");
  });

  it("nested multipart/related inside alternative still finds the plain part", () => {
    const eml = [
      'Content-Type: multipart/mixed; boundary="OUTER"',
      "",
      "--OUTER",
      'Content-Type: multipart/alternative; boundary="INNER"',
      "",
      "--INNER",
      "Content-Type: text/plain",
      "",
      "Inner plain wins",
      "--INNER",
      "Content-Type: text/html",
      "",
      "<p>html</p>",
      "--INNER--",
      "--OUTER--",
    ].join(CRLF);
    expect(parseEmlToOfferText(eml)?.offerText).toContain("Inner plain wins");
  });

  it("not an email → null", () => {
    expect(parseEmlToOfferText("just some random text with no headers")).toBeNull();
    expect(parseEmlToOfferText("")).toBeNull();
  });
});
