/** Turn API / Zod / network failures into short user-facing copy. */

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  bookmaker: "Bookie",
  expectedProfit: "Expected profit",
  expiresAt: "Expiry",
  status: "Status",
  sport: "Category",
  offerType: "Offer type",
  scopeCourse: "Course",
  eventDate: "Racing day",
  scopeRaceId: "Race",
  scopeRaceLabel: "Race",
  rules: "Offer rules",
  description: "Description",
};

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function messageForField(field: string, messages: string[]): string {
  const joined = messages.join(" ");
  if (/expected number, received null/i.test(joined)) {
    return `${labelFor(field)} is optional - leave it blank or pick a valid date.`;
  }
  if (/expected number/i.test(joined)) {
    return `${labelFor(field)} must be a number.`;
  }
  if (/expected string/i.test(joined) || /too small|min\(1\)/i.test(joined)) {
    return `${labelFor(field)} is required.`;
  }
  if (/invalid/i.test(joined)) {
    return `${labelFor(field)} looks invalid.`;
  }
  return `${labelFor(field)}: ${joined}`;
}

/**
 * Prefer a short human message. Handles Zod flatten JSON, plain Error text, and unknowns.
 */
export function formatApiError(err: unknown, fallback = "Something went wrong"): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (!raw.trim()) return fallback;

  // "400: {json}" from api() helper
  const jsonMatch = raw.match(/^\d{3}:\s*(\{[\s\S]*\})$/);
  const jsonText = jsonMatch?.[1] ?? (raw.trim().startsWith("{") ? raw.trim() : null);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as {
        error?:
          | string
          | {
              formErrors?: string[];
              fieldErrors?: Record<string, string[] | undefined>;
            };
        message?: string;
      };

      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message.trim();
      }

      const flat = parsed.error;
      if (flat && typeof flat === "object") {
        const fieldLines: string[] = [];
        for (const [field, msgs] of Object.entries(flat.fieldErrors ?? {})) {
          if (msgs?.length) fieldLines.push(messageForField(field, msgs));
        }
        if (fieldLines.length > 0) return fieldLines.join(" ");
        const form = (flat.formErrors ?? []).filter(Boolean);
        if (form.length > 0) return form.join(" ");
      }
    } catch {
      // fall through
    }
  }

  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Network error - check your connection and try again.";
  }
  if (/^5\d{2}:/.test(raw)) return "Server error - try again in a moment.";
  if (/^4\d{2}:/.test(raw)) return "Couldn’t save - check the form and try again.";

  // Strip leading status codes for cleaner toasts
  return raw.replace(/^\d{3}:\s*/, "").slice(0, 180) || fallback;
}
