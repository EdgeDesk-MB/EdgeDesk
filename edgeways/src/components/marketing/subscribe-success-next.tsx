"use client";

import { useState } from "react";
import {
  postSubscribeNextHref,
  postSubscribeNextLabel,
} from "@/lib/site-surface";

const nextClassName =
  "rounded-[var(--radius-button)] bg-[var(--marketing-brand)] px-5 py-3 text-sm font-semibold text-[var(--marketing-ink)] transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]";

export function SubscribeSuccessNext({
  from,
  setupDone = false,
}: {
  from: "setup" | null;
  setupDone?: boolean;
}) {
  const [stuck, setStuck] = useState(false);
  const label = postSubscribeNextLabel({ from, setupDone });
  const href = postSubscribeNextHref({ from, setupDone });

  if (from === "setup") {
    return (
      <div className="mt-14 flex flex-col items-center">
        <button
          type="button"
          className={nextClassName}
          onClick={() => {
            window.close();
            window.setTimeout(() => setStuck(true), 200);
          }}
        >
          {label}
        </button>
        <a
          href="/setup"
          className="mt-3 text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline"
        >
          Continue set-up
        </a>
        {stuck ? (
          <p className="mt-3 max-w-sm text-center text-sm text-white/55">
            This window can be closed. Set-up is in the other tab.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <a href={href ?? "/setup"} className={`mt-14 ${nextClassName}`}>
      {label}
    </a>
  );
}
