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
}: {
  from: "setup" | null;
}) {
  const [stuck, setStuck] = useState(false);
  const label = postSubscribeNextLabel(from);
  const href = postSubscribeNextHref(from);

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
        {stuck ? (
          <p className="mt-3 max-w-sm text-center text-sm text-white/55">
            This window can be closed. Setup is in the other tab.
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
