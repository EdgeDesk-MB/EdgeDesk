"use client";

import Link from "next/link";
import {
  MarketingDocPage,
  marketingDocPrimaryActionClass,
  marketingDocSecondaryActionClass,
} from "@/components/marketing/marketing-doc-page";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <MarketingDocPage
      title="Something went wrong"
      lede="Edgeways hit an unexpected error. Try again first. If it keeps happening, tell us and we will fix it."
      actions={
        <>
          <button
            type="button"
            onClick={reset}
            className={marketingDocPrimaryActionClass}
          >
            Try again
          </button>
          <Link href="/contact" className={marketingDocSecondaryActionClass}>
            Contact us
          </Link>
        </>
      }
    />
  );
}
