/**
 * Anything open or mid-flight that a reload would throw away: dialogs,
 * sheets and popovers, pending saves (`aria-busy`), and explicit holds.
 */
export const DESK_HOLD_SELECTOR = [
  '[role="dialog"]:not([data-state="closed"]):not([hidden])',
  '[role="alertdialog"]:not([data-state="closed"]):not([hidden])',
  "dialog[open]",
  '[aria-busy="true"]',
  "[data-update-hold]",
].join(", ");

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const IGNORED_INPUT_TYPES = new Set(["button", "submit", "reset", "hidden", "image"]);

/** Baseline for a field typed into before we saw it focus. Never matches a real value. */
const UNKNOWN_BASELINE = "\u0000unknown";

function isField(el: EventTarget | null): el is Field {
  if (el instanceof HTMLInputElement) return !IGNORED_INPUT_TYPES.has(el.type);
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function fieldSnapshot(el: Field): string {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    return el.checked ? "on" : "off";
  }
  if (el instanceof HTMLSelectElement && el.multiple) {
    return Array.from(el.selectedOptions, (o) => o.value).join("\u0000");
  }
  return el.value;
}

export function deskHasOpenHold(doc: Document): boolean {
  return doc.querySelector(DESK_HOLD_SELECTOR) != null;
}

export type EditedFieldTracker = {
  hasUnsavedInput: () => boolean;
  dispose: () => void;
};

/**
 * Records each field's value when it is first focused. A field counts as
 * unsaved while it is still on the page and differs from that value.
 * Controlled inputs sync `defaultValue` on every render, so it cannot be
 * used as the baseline.
 */
export function trackEditedFields(doc: Document): EditedFieldTracker {
  const baseline = new Map<Field, string>();

  const remember = (el: EventTarget | null) => {
    if (isField(el) && !baseline.has(el)) baseline.set(el, fieldSnapshot(el));
  };
  const onFocusIn = (event: Event) => remember(event.target);
  const onInput = (event: Event) => {
    const el = event.target;
    if (isField(el) && !baseline.has(el)) baseline.set(el, UNKNOWN_BASELINE);
  };
  const onSubmit = (event: Event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    for (const el of baseline.keys()) {
      if (el.form === form) baseline.delete(el);
    }
  };

  remember(doc.activeElement);
  doc.addEventListener("focusin", onFocusIn, true);
  doc.addEventListener("input", onInput, true);
  doc.addEventListener("change", onInput, true);
  doc.addEventListener("submit", onSubmit, true);

  return {
    hasUnsavedInput() {
      let unsaved = false;
      for (const [el, before] of baseline) {
        if (!el.isConnected) {
          baseline.delete(el);
          continue;
        }
        if (fieldSnapshot(el) !== before) unsaved = true;
      }
      return unsaved;
    },
    dispose() {
      doc.removeEventListener("focusin", onFocusIn, true);
      doc.removeEventListener("input", onInput, true);
      doc.removeEventListener("change", onInput, true);
      doc.removeEventListener("submit", onSubmit, true);
    },
  };
}
