import { afterEach, describe, expect, it } from "vitest";
import { formatAdminDate, formatAdminDateTime } from "./format";

const ORIGINAL_TZ = process.env.TZ;

function inProcessTimeZone<T>(timeZone: string, run: () => T): T {
  process.env.TZ = timeZone;
  return run();
}

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe("admin date formatting", () => {
  // 15 Sep 2026 14:35 UTC is 15:35 in London (BST).
  const BST_AFTERNOON = Date.UTC(2026, 8, 15, 14, 35);
  // 28 Aug 2026 23:30 UTC is already 29 Aug in London.
  const BST_PAST_MIDNIGHT = Date.UTC(2026, 7, 28, 23, 30);

  it("renders UK time whatever the server timezone", () => {
    const vercel = inProcessTimeZone("UTC", () => formatAdminDateTime(BST_AFTERNOON));
    const browser = inProcessTimeZone("Europe/London", () =>
      formatAdminDateTime(BST_AFTERNOON)
    );
    expect(vercel).toBe("15 Sept 2026, 15:35");
    expect(browser).toBe(vercel);
  });

  it("keeps the UK calendar day across UTC midnight", () => {
    const vercel = inProcessTimeZone("UTC", () => formatAdminDate(BST_PAST_MIDNIGHT));
    expect(vercel).toBe("29 Aug 2026");
    expect(inProcessTimeZone("Europe/London", () => formatAdminDate(BST_PAST_MIDNIGHT))).toBe(
      vercel
    );
  });

  it("shows a dash for missing values", () => {
    expect(formatAdminDateTime(null)).toBe("—");
    expect(formatAdminDate(0)).toBe("—");
  });
});
