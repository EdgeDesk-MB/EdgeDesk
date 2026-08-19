import type { Metadata } from "next";
import { MarketingDocPage } from "@/components/marketing/marketing-doc-page";
import {
  HELLO_EMAIL,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/lib/marketing/site-contacts";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Say hello. A person at Edgeways will write back within two working days.",
};

export default function ContactPage() {
  return (
    <MarketingDocPage title="Say hello">
      <p>
        Questions, a billing niggle, or just a hello. Write to us and a person
        will write back, usually within two working days.
      </p>
      <h2>A question or a hello</h2>
      <p>
        <a href={mailtoHref(HELLO_EMAIL)}>{HELLO_EMAIL}</a>
      </p>
      <h2>Help with your desk or a payment</h2>
      <p>
        <a href={mailtoHref(SUPPORT_EMAIL)}>{SUPPORT_EMAIL}</a>
      </p>
    </MarketingDocPage>
  );
}
