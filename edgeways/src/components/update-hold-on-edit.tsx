"use client";

import { useState, type ReactNode, type SyntheticEvent } from "react";
import { PAGE_HOLD_VALUE } from "@/lib/app-update/desk-busy";

const CONTROL_SELECTOR = [
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "[contenteditable]",
  '[role="option"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="slider"]',
  '[role="combobox"]',
].join(", ");

const NAVIGATION_KEYS = new Set(["Tab", "Escape", "Shift", "Control", "Alt", "Meta"]);

/**
 * Holds quiet update reloads (`data-update-hold="page"`) once the user has
 * worked in this area, until it unmounts. For tools whose work lives only in
 * React state, such as calculator selections, where no field stays dirty to
 * guard. React capture handlers also see portaled content (select menus).
 */
export function UpdateHoldOnEdit({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState(false);

  function onPointerDown(event: SyntheticEvent) {
    const el = event.target;
    if (el instanceof Element && el.closest(CONTROL_SELECTOR)) setHeld(true);
  }

  function onKeyDown(event: SyntheticEvent<Element, KeyboardEvent>) {
    if (!NAVIGATION_KEYS.has(event.nativeEvent.key)) setHeld(true);
  }

  return (
    <div
      className="contents"
      data-update-hold={held ? PAGE_HOLD_VALUE : undefined}
      onPointerDownCapture={held ? undefined : onPointerDown}
      onKeyDownCapture={held ? undefined : onKeyDown}
      onInputCapture={held ? undefined : () => setHeld(true)}
    >
      {children}
    </div>
  );
}
