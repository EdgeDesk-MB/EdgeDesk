import { BOLT_PATH } from "@/lib/brand/bolt-mark";

/**
 * Referral interrupt art: a betting slip stamped with the Edgeways bolt.
 * Header is `--edge`. Slip uses currentColor (`--edge-foreground`);
 * £10 and bolt use `--edge` so they read on that slip.
 */
export function ReferAFriendArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 112"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M22 30c14-16 32-18 46-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M208 78c14 10 18 24 10 34"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />

      <g transform="translate(24 24) rotate(-6 96 32)">
        <rect width="192" height="64" rx="16" fill="currentColor" />
        <path
          d="M132 14v36"
          stroke="var(--edge)"
          strokeWidth="2.5"
          strokeDasharray="3 6"
          strokeLinecap="round"
          opacity="0.55"
        />
        <text
          x="68"
          y="44"
          textAnchor="middle"
          fill="var(--edge)"
          fontSize="32"
          fontWeight="800"
          fontFamily="var(--font-heading), ui-sans-serif, system-ui, sans-serif"
        >
          £10
        </text>
        <g transform="translate(144 12) scale(1.67)">
          <path d={BOLT_PATH} fill="var(--edge)" />
        </g>
      </g>
    </svg>
  );
}
