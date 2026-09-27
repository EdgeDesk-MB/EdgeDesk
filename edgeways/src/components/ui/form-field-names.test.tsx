import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Input } from "./input";
import { Select, SelectTrigger, SelectValue } from "./select";
import { Switch } from "./switch";

/** Chrome flags any input, select or textarea with neither `id` nor `name`. */
function unnamedFields(html: string): string[] {
  const tags = html.match(/<(input|select|textarea)\b[^>]*>/g) ?? [];
  return tags.filter((tag) => !/\s(id|name)="[^"]+"/.test(tag));
}

describe("shared form controls always carry an id or name", () => {
  it("Input defaults an id and keeps an explicit one", () => {
    expect(unnamedFields(renderToStaticMarkup(<Input />))).toEqual([]);
    expect(renderToStaticMarkup(<Input id="poll" />)).toContain('id="poll"');
  });

  it("Switch names its server-rendered hidden checkbox", () => {
    const html = renderToStaticMarkup(<Switch id="live-toasts" />);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="live-toasts"');
    expect(unnamedFields(renderToStaticMarkup(<Switch />))).toEqual([]);
    expect(renderToStaticMarkup(<Switch name="push" />)).toContain('name="push"');
  });

  it("Select names its server-rendered hidden native select", () => {
    const html = renderToStaticMarkup(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
      </Select>
    );
    expect(html).toContain("<select");
    expect(unnamedFields(html)).toEqual([]);
  });
});

describe("raw form fields outside components/ui", () => {
  const srcRoot = path.resolve(__dirname, "../..");

  function tsxFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return tsxFiles(full);
      return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
    });
  }

  /** Returns the JSX opening tag starting at `start`, skipping `>` inside braces. */
  function openingTag(source: string, start: number): string {
    let depth = 0;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) return source.slice(start, i);
    }
    return source.slice(start);
  }

  it("each has an id, name or props spread", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(srcRoot)) {
      if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<(input|select|textarea)\b/g)) {
        const tag = openingTag(source, match.index);
        if (/\s(id|name)=/.test(tag) || tag.includes("{...")) continue;
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${path.relative(srcRoot, file)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
