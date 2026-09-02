import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LaunchHome } from "@/components/marketing/launch-home";
import { WaitlistHome } from "@/components/marketing/waitlist-home";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/marketing/marketing-glimpse-rail", () => ({
  MarketingGlimpseRail: () => <div data-glimpses="" />,
}));

vi.mock("@/components/marketing/marketing-pricing", () => ({
  MarketingPricing: () => <section id="pricing" />,
}));

describe("launch homepage", () => {
  it("does not ask visitors to join a waitlist", () => {
    const html = renderToStaticMarkup(<LaunchHome />);
    expect(html).not.toContain("Join the waitlist");
    expect(html).not.toContain("waitlist-footer");
    expect(html).not.toContain("Get early beta access");
    expect(html).not.toContain("We keep your email for the waitlist");
    expect(html).toContain("Start free trial");
  });

  it("keeps the waitlist closer on the waitlist variant", () => {
    const html = renderToStaticMarkup(<WaitlistHome />);
    expect(html).toContain("Join the waitlist");
    expect(html).toContain("waitlist-footer");
  });
});
