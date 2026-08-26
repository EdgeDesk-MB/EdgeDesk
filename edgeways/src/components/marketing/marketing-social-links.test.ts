import { describe, expect, it } from "vitest";
import { MARKETING_SOCIAL_LINKS } from "@/components/marketing/marketing-social-links";

describe("marketing social links", () => {
  it("wires claimed X, Instagram, Facebook, TikTok, YouTube, LinkedIn, and Slack", () => {
    expect(MARKETING_SOCIAL_LINKS).toEqual([
      { label: "X", href: "https://x.com/edgewaysapp" },
      { label: "Instagram", href: "https://www.instagram.com/edgeways_app/" },
      { label: "Facebook", href: "https://www.facebook.com/edgewaysapp" },
      { label: "TikTok", href: "https://www.tiktok.com/@edgewaysapp" },
      { label: "YouTube", href: "https://www.youtube.com/@edgewaysapp" },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/edgewaysapp" },
      { label: "Slack", href: "https://edgeways.slack.com" },
    ]);
  });
});
