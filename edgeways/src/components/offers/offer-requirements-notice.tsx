import { WarningNotice } from "@/components/ui/warning-notice";
import {
  formatPlacementRequirementParts,
  hasPlacementBreach,
  hasPlacementRequirements,
  requirementPartBreached,
  type PlacementBreaches,
  type PlacementRequirements,
} from "@/lib/offers/offer-placement-requirements";

export function OfferRequirementsNotice({
  requirements,
  breaches,
  className,
}: {
  requirements: PlacementRequirements | null | undefined;
  breaches?: PlacementBreaches;
  className?: string;
}) {
  if (!hasPlacementRequirements(requirements)) return null;
  const parts = formatPlacementRequirementParts(requirements);
  if (parts.length === 0) return null;
  const off = breaches != null && hasPlacementBreach(breaches);
  const titleBase =
    requirements.purpose === "convert" ? "Reward requirements" : "Offer requirements";
  return (
    <WarningNotice
      className={className}
      title={off ? `${titleBase} not met` : titleBase}
    >
      <p>
        {parts.map((part, i) => {
          const warn = breaches != null && requirementPartBreached(part.key, breaches);
          return (
            <span key={part.key}>
              {i > 0 ? " · " : null}
              {warn ? (
                <strong className="font-semibold text-foreground">{part.text}</strong>
              ) : (
                part.text
              )}
            </span>
          );
        })}
      </p>
    </WarningNotice>
  );
}

export function OfferRequirementHint({
  id,
  messages,
}: {
  id?: string;
  messages: string[];
}) {
  if (messages.length === 0) return null;
  return (
    <p id={id} className="text-xs font-medium text-warning">
      {messages.join(". ")}.
    </p>
  );
}
