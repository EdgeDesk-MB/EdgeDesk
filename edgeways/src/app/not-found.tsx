import Link from "next/link";
import { MarketingDocPage } from "@/components/marketing/marketing-doc-page";

export default function NotFound() {
  return (
    <MarketingDocPage
      title="Page not found"
      lede="That page does not exist - the link may be wrong, or the page has moved."
    >
      <p>
        <Link href="/">Back to Edgeways</Link>
        {" · "}
        <Link href="/contact">Contact us</Link>
      </p>
    </MarketingDocPage>
  );
}
