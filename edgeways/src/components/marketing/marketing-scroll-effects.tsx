"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const REVEAL_SELECTOR = "[data-reveal], [data-reveal-stagger]";

function revealNodes(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
}

function markStatic(node: HTMLElement) {
  node.classList.add("is-in", "is-in-static");
}

function markHashTarget(root: Element) {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target || !root.contains(target)) return;
  if (target.matches(REVEAL_SELECTOR)) markStatic(target);
  for (const node of revealNodes(target)) markStatic(node);
}

function markOnScreen(root: Element) {
  const viewport = window.innerHeight;
  for (const node of revealNodes(root)) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < viewport) markStatic(node);
  }
}

function bindReveals(root: Element | null): IntersectionObserver | null {
  const html = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nodes = root ? revealNodes(root) : [];

  if (reduce) {
    for (const node of nodes) node.classList.add("is-in");
    html.classList.add("marketing-reveal-armed");
    return null;
  }

  if (root) {
    markHashTarget(root);
    markOnScreen(root);
  }

  html.classList.add("marketing-reveal-armed");

  const pending = nodes.filter((node) => !node.classList.contains("is-in"));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0, rootMargin: "0px 0px -12% 0px" }
  );

  for (const node of pending) observer.observe(node);
  return observer;
}

/**
 * Marketing-only motion: mark in-view blocks once, and turn on smooth
 * hash scrolling after the first paint so a `#section` landing still jumps.
 *
 * Lives on the marketing layout, so it must re-bind when the pathname
 * changes. Otherwise a client nav (Refunds logo → home) leaves new
 * `[data-reveal]` nodes hidden under `html.marketing-reveal-armed`.
 */
export function MarketingScrollEffects() {
  const pathname = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("marketing-surface");
    return () => {
      html.classList.remove(
        "marketing-surface",
        "marketing-reveal-armed",
        "marketing-smooth-scroll"
      );
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.querySelector(".marketing-root");
    const observer = bindReveals(root);
    return () => {
      observer?.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("marketing-smooth-scroll");
    let smoothFrame2 = 0;
    const smoothFrame1 = window.requestAnimationFrame(() => {
      smoothFrame2 = window.requestAnimationFrame(() => {
        html.classList.add("marketing-smooth-scroll");
      });
    });
    return () => {
      window.cancelAnimationFrame(smoothFrame1);
      window.cancelAnimationFrame(smoothFrame2);
    };
  }, [pathname]);

  return null;
}
