import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NATIVE_PICKER_QUERY } from "@/hooks/use-prefers-native-picker";

const SRC = join(process.cwd(), "src");
const ALLOWED_NATIVE_TYPE_FILES = new Set([
  "components/native-temporal-field.tsx",
  "components/date-picker.tsx",
  "components/time-picker.tsx",
  "components/date-time-picker.tsx",
]);

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsx(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("native picker gate", () => {
  it("covers coarse pointer, no hover, and tablet width", () => {
    expect(NATIVE_PICKER_QUERY).toBe(
      "(any-pointer: coarse), (hover: none), (max-width: 767px)"
    );
  });

  it("stays in step with the hydration CSS split", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain(`@media ${NATIVE_PICKER_QUERY}`);
  });

  it("does not let screens add raw date/time inputs", () => {
    const banned = /type=["'](date|time|datetime-local)["']/;
    const offenders: string[] = [];
    for (const file of walkTsx(SRC)) {
      const rel = file.slice(SRC.length + 1).replaceAll("\\", "/");
      if (ALLOWED_NATIVE_TYPE_FILES.has(rel)) continue;
      if (banned.test(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
