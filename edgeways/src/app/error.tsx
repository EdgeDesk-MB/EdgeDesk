"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  MarketingDocPage,
  marketingDocPrimaryActionClass,
  marketingDocSecondaryActionClass,
} from "@/components/marketing/marketing-doc-page";
import { recoverFromChunkLoadError } from "@/lib/app-update/quiet-reload";

export default function RootError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    recoverFromChunkLoadError(error);
  }, [error]);

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
