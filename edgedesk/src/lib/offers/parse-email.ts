/**
 * MIME-lite .eml parser (J6 stage 1) - promo emails become offer text for
 * the existing parseOfferFromText pipeline. Deliberately small: headers,
 * multipart walking (text/plain preferred, text/html fallback),
 * quoted-printable and base64 decoding, RFC2047 subjects, HTML → text.
 * Everything parses locally; nothing leaves the machine. If real-world
 * emails outgrow this, flag `postal-mime` before adding it (AGENTS.md).
 */

export interface ParsedEmail {
  subject: string | null;
  /** Body as plain text (plain part preferred, else de-tagged HTML) */
  body: string;
  /** Subject + body, ready for parseOfferFromText */
  offerText: string;
}

function b64ToUtf8(s: string): string {
  const clean = s.replace(/\s+/g, "");
  const bin =
    typeof atob !== "undefined"
      ? atob(clean)
      : Buffer.from(clean, "base64").toString("binary");
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function qpToUtf8(s: string, underscoreIsSpace = false): string {
  // Soft line breaks join; =XX hex bytes decode as UTF-8
  const joined = s.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    const ch = joined[i];
    if (ch === "=" && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (ch === "_" && underscoreIsSpace) {
      bytes.push(0x20);
    } else {
      bytes.push(ch.charCodeAt(0));
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

/** Decode RFC2047 encoded-words: =?charset?B|Q?data?= (UTF-8/latin assumed). */
function decodeRfc2047(value: string): string {
  return value
    .replace(/=\?[^?]+\?([BbQq])\?([^?]*)\?=/g, (_m, enc: string, data: string) =>
      enc.toUpperCase() === "B" ? b64ToUtf8(data) : qpToUtf8(data, true)
    )
    .trim();
}

interface MimeHeaders {
  contentType: string;
  boundary: string | null;
  encoding: string;
  raw: Map<string, string>;
}

function parseHeaders(block: string): MimeHeaders {
  const raw = new Map<string, string>();
  // Unfold: continuation lines start with whitespace
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    raw.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
  }
  const ct = raw.get("content-type") ?? "text/plain";
  const boundaryMatch = ct.match(/boundary="?([^";]+)"?/i);
  return {
    contentType: ct.split(";")[0].trim().toLowerCase(),
    boundary: boundaryMatch ? boundaryMatch[1] : null,
    encoding: (raw.get("content-transfer-encoding") ?? "").trim().toLowerCase(),
    raw,
  };
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === "base64") return b64ToUtf8(body);
  if (encoding === "quoted-printable") return qpToUtf8(body);
  return body;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  pound: "£",
  euro: "€",
  copy: "©",
  ndash: "–",
  mdash: "—",
  rsquo: "'",
  lsquo: "'",
};

function htmlToText(html: string): string {
  let s = html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
  // Collapse whitespace but keep line structure
  return s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join("\n")
    .trim();
}

interface PartText {
  plain: string | null;
  html: string | null;
}

/** Walk a MIME entity (headers already split off) collecting the best text. */
function walkEntity(headers: MimeHeaders, body: string, depth = 0): PartText {
  if (depth > 6) return { plain: null, html: null };
  if (headers.contentType.startsWith("multipart/") && headers.boundary) {
    const found: PartText = { plain: null, html: null };
    const marker = `--${headers.boundary}`;
    for (const chunk of body.split(marker)) {
      const trimmed = chunk.replace(/^\r?\n/, "");
      if (!trimmed || trimmed.startsWith("--")) continue;
      const split = trimmed.search(/\r?\n\r?\n/);
      if (split < 0) continue;
      const childHeaders = parseHeaders(trimmed.slice(0, split));
      const childBody = trimmed.slice(split).replace(/^\r?\n\r?\n/, "");
      const child = walkEntity(childHeaders, childBody, depth + 1);
      found.plain = found.plain ?? child.plain;
      found.html = found.html ?? child.html;
      if (found.plain) break; // plain wins; stop early
    }
    return found;
  }
  const decoded = decodeBody(body, headers.encoding).trim();
  if (headers.contentType === "text/html") return { plain: null, html: decoded };
  if (headers.contentType.startsWith("text/")) return { plain: decoded, html: null };
  return { plain: null, html: null };
}

export function parseEmlToOfferText(raw: string): ParsedEmail | null {
  if (!raw || raw.length < 10) return null;
  const split = raw.search(/\r?\n\r?\n/);
  if (split < 0) return null;
  const headerBlock = raw.slice(0, split);
  // An email must actually look like one: at least one Header: value line
  if (!/^[A-Za-z-]+:\s?.+/m.test(headerBlock)) return null;
  const headers = parseHeaders(headerBlock);
  // Require an email-ish envelope, not just any colon-containing text
  if (!headers.raw.has("subject") && !headers.raw.has("from") && !headers.raw.has("content-type")) {
    return null;
  }
  const body = raw.slice(split).replace(/^\r?\n\r?\n/, "");

  const { plain, html } = walkEntity(headers, body);
  const text = plain ?? (html ? htmlToText(html) : "");
  if (!text.trim()) return null;

  const subjectRaw = headers.raw.get("subject");
  const subject = subjectRaw ? decodeRfc2047(subjectRaw) : null;
  const bodyText = plain ? plain.trim() : text;
  return {
    subject,
    body: bodyText,
    offerText: subject ? `${subject}\n\n${bodyText}` : bodyText,
  };
}
