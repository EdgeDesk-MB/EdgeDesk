"use client";

import { useLayoutEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bannerLinkText,
  isExternalBannerHref,
  siteBannerPlateClass,
  type SiteBannerKind,
} from "@/lib/admin/maintenance-banner-shared";

const LAYOUT_TOKEN = "--layout-site-banner-h";

function setSiteBannerHeight(px: number) {
  document.documentElement.style.setProperty(LAYOUT_TOKEN, `${px}px`);
}

export function MaintenanceBannerView({
  message,
  kind = "maintenance",
  href = null,
  linkLabel = null,
  layoutOffset = false,
}: {
  message: string;
  kind?: SiteBannerKind;
  href?: string | null;
  linkLabel?: string | null;
  /** Measure height into the toast / page offset token. Live chrome only. */
  layoutOffset?: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const external = href ? isExternalBannerHref(href) : false;
  const label = bannerLinkText(linkLabel);

  useLayoutEffect(() => {
    if (!layoutOffset) return;
    const el = barRef.current;
    if (!el) return;
    const apply = () => setSiteBannerHeight(el.getBoundingClientRect().height);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setSiteBannerHeight(0);
    };
  }, [layoutOffset]);

  return (
    <div
      ref={barRef}
      role="status"
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
              className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-sm font-semibold underline underline-offset-2 outline-none hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
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
      </p>
    </div>
  );
}
