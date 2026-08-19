/** Customer-facing legal surface (EDGE-61). Keep hrefs identical everywhere. */

export const LEGAL_PATHS = {
  terms: "/terms",
  privacy: "/privacy",
  contact: "/contact",
  refund: "/refund",
} as const;

export const LEGAL_NAV = [
  { href: LEGAL_PATHS.terms, label: "Terms" },
  { href: LEGAL_PATHS.privacy, label: "Privacy" },
  { href: LEGAL_PATHS.contact, label: "Contact" },
  { href: LEGAL_PATHS.refund, label: "Refunds" },
] as const;

export const LEGAL_EFFECTIVE_DATE = "17 August 2026";
export const LEGAL_OPERATOR = "Sam Hayter trading as Edgeways";

/** ICO fee self-assessment 17 Aug 2026: not due until trading starts. */
export const ICO_REGISTRATION_NOTE =
  "Not yet required. We will register when we start trading and add the number here.";
