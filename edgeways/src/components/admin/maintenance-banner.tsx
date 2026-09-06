"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bannerLinkText,
  isExternalBannerHref,
  siteBannerPlateClass,
  type SiteBannerKind,
} from "@/lib/admin/maintenance-banner-shared";

const bannerActionClass =
  "inline-flex items-baseline gap-1 whitespace-nowrap rounded-sm font-semibold underline underline-offset-2 outline-none hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

export function MaintenanceBannerView({
  message,
  kind = "maintenance",
  href = null,
  linkLabel = null,
  action = null,
  announce = true,
}: {
  message: string;
  kind?: SiteBannerKind;
  href?: string | null;
  linkLabel?: string | null;
  action?: { label: string; onClick: () => void } | null;
  /** Live chrome announces via a separate polite region so appear is heard. */
  announce?: boolean;
}) {
  const external = href ? isExternalBannerHref(href) : false;
  const label = bannerLinkText(linkLabel);

  return (
    <div
      role={announce ? "status" : undefined}
      className={cn(
        "min-w-0 shrink-0 px-4 py-2 text-center text-sm font-medium",
        siteBannerPlateClass(kind)
      )}
    >
      <p className="min-w-0 text-pretty break-words line-clamp-2">
        <span title={message}>{message}</span>
        {href ? (
          <>
            {"\u00a0 "}
            <a
              href={href}
              className={bannerActionClass}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {label}
              {external ? (
                <ExternalLink className="size-3.5 shrink-0 self-center" aria-hidden />
              ) : null}
            </a>
          </>
        ) : null}
        {action ? (
          <>
            {"\u00a0 "}
            <button type="button" className={bannerActionClass} onClick={action.onClick}>
              {action.label}
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
