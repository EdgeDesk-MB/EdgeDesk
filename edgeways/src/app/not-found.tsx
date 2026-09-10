import Link from "next/link";
import {
  MarketingDocPage,
  marketingDocPrimaryActionClass,
  marketingDocSecondaryActionClass,
} from "@/components/marketing/marketing-doc-page";

export default function NotFound() {
  return (
    <MarketingDocPage
      title="Page not found"
      lede="That page does not exist. The link may be wrong, or the page has moved."
      actions={
        <>
          <Link href="/" className={marketingDocPrimaryActionClass}>
            Back to Edgeways
          </Link>
          <Link href="/contact" className={marketingDocSecondaryActionClass}>
            Contact us
          </Link>
        </>
      }
    />
  );
}
