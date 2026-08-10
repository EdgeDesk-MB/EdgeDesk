import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EdgeAlertToastTitle } from "./edge-alert-toast-title";

vi.mock("@/components/venue-badge", () => ({
  VenueBadge: ({ name, className }: { name: string; className?: string }) => (
    <span data-bookie={name} className={className}>
      {name}
    </span>
  ),
}));

describe("EdgeAlertToastTitle", () => {
  it("colours only the win amount green, not the lead copy", () => {
    const html = renderToStaticMarkup(
      <EdgeAlertToastTitle
        title="You just made £7.62 · Bet won"
        tone="positive"
      />
    );
    expect(html).toContain('class="edge-alert-toast-title-lead"');
    expect(html).toContain("You just made ");
    expect(html).toContain(" · Bet won");
    expect(html).toContain("edge-alert-toast-amount-positive");
    expect(html).toContain("£7.62");
    expect(html).not.toMatch(
      /edge-alert-toast-amount-positive[^>]*>You just made/
    );
    expect(html).not.toMatch(
      /edge-alert-toast-amount-positive[^>]*>[^<]*Bet won/
    );
  });

  it("colours only the loss amount red", () => {
    const html = renderToStaticMarkup(
      <EdgeAlertToastTitle
        title="-£1.51 settled · Bet lost"
        tone="negative"
      />
    );
    expect(html).toContain("edge-alert-toast-amount-negative");
    expect(html).toContain("-£1.51");
    expect(html).toContain('class="edge-alert-toast-title-lead"');
    expect(html).toContain("settled");
    expect(html).toContain(" · Bet lost");
    expect(html).not.toContain("🔴");
  });

  it("stacks the bookie pill above the title", () => {
    const html = renderToStaticMarkup(
      <EdgeAlertToastTitle
        title="-£0.69 settled · Bet lost"
        tone="negative"
        bookmaker="Betfair"
      />
    );
    expect(html).toContain("flex-col");
    expect(html).toContain('data-bookie="Betfair"');
    expect(html).toContain("-£0.69");
    expect(html.indexOf('data-bookie="Betfair"')).toBeLessThan(
      html.indexOf("-£0.69")
    );
  });

  it("omits the bookie pill when none is set", () => {
    const html = renderToStaticMarkup(
      <EdgeAlertToastTitle title="Void · stakes returned" tone={null} />
    );
    expect(html).not.toContain("data-bookie");
    expect(html).not.toContain("flex-col");
  });
});
