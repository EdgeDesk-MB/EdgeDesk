import { BOLT_PATH } from "@/lib/brand/bolt-mark";

/**
 * Referral interrupt art. Ticket, gift and bolt sit on the topbar plate
 * (`currentColor` = `--topbar-foreground`, ribbon/stamp = `--brand`).
 */
export function ReferAFriendArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 148"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M38 40c10-12 22-16 34-12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M226 32c10 8 16 20 14 32"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M48 120c-10 6-22 6-32-2"
        stroke="var(--brand)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M232 112c10 8 12 20 4 28"
        stroke="var(--brand)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="46" cy="58" r="3.5" fill="var(--brand)" />
      <circle cx="246" cy="50" r="2.5" fill="currentColor" opacity="0.7" />
      <circle cx="62" cy="26" r="2" fill="currentColor" opacity="0.5" />

      <g transform="translate(18 48) rotate(-12 54 32)">
        <rect width="108" height="64" rx="12" fill="currentColor" />
        <path
          d="M80 12v40"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeDasharray="3 6"
          strokeLinecap="round"
        />
        <text
          x="42"
          y="42"
          textAnchor="middle"
          fill="var(--brand)"
          fontSize="22"
          fontWeight="800"
          fontFamily="var(--font-heading), ui-sans-serif, system-ui, sans-serif"
        >
          50%
        </text>
      </g>

      <g transform="translate(106 54)">
        <rect x="6" y="30" width="68" height="46" rx="8" fill="currentColor" />
        <rect x="0" y="18" width="80" height="18" rx="7" fill="currentColor" />
        <rect x="35" y="18" width="10" height="58" fill="var(--brand)" />
        <path
          d="M40 20c-14-16-26 4-16 12 6 1 12-2 16-8 4 6 10 9 16 8 10-8-2-28-16-12z"
          fill="var(--brand)"
        />
      </g>

      <g transform="translate(194 38)">
        <rect
          width="58"
          height="58"
          rx="14"
          fill="var(--topbar-accent)"
        />
        <g transform="translate(9 9) scale(1.67)">
          <path d={BOLT_PATH} fill="var(--topbar-accent-foreground)" />
        </g>
      </g>
    </svg>
  );
}
