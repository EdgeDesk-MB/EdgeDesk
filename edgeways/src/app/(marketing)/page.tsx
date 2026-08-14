import { LaunchHome } from "@/components/marketing/launch-home";
import { WaitlistHome } from "@/components/marketing/waitlist-home";
import { getLandingVariant } from "@/lib/site-surface";

export default function MarketingHomePage() {
  if (getLandingVariant() === "launch") {
    return <LaunchHome />;
  }
  return <WaitlistHome />;
}
