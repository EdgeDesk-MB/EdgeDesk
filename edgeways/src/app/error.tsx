"use client";

import Link from "next/link";
import { MarketingDocPage } from "@/components/marketing/marketing-doc-page";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <MarketingDocPage
      title="Something went wrong"
      lede="Edgeways hit an unexpected error. Trying again usually clears it - if it keeps happening, tell us and we will fix it."
    >
      <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-[var(--marketing-brand)] px-3 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
        >
          Try again
        </button>
        <Link href="/">Back to Edgeways</Link>
        <Link href="/contact">Contact us</Link>
      </p>
    </MarketingDocPage>
  );
}
