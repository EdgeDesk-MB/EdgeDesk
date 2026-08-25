import { LaunchHome } from "@/components/marketing/launch-home";
import { WaitlistHome } from "@/components/marketing/waitlist-home";
import { marketingJsonLdScript } from "@/lib/marketing/structured-data";
import { getLandingVariant } from "@/lib/site-surface";

export default function MarketingHomePage() {
  const variant = getLandingVariant();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: marketingJsonLdScript(variant) }}
      />
      {variant === "launch" ? <LaunchHome /> : <WaitlistHome />}
    </>
  );
}
