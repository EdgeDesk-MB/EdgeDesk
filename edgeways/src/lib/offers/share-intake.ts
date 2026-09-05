/**
 * PWA Share Target intake. The OS share sheet lands on /share with title,
 * text and url query params (manifest.ts). Browsers disagree on where the
 * link goes - Chrome puts it in text AND url, Safari only in url - so the
 * fields are combined and the duplicate link dropped before parsing.
 */

export interface ShareParams {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

export function combineShareParams(params: ShareParams): string {
  const title = params.title?.trim() ?? "";
  const text = params.text?.trim() ?? "";
  const url = params.url?.trim() ?? "";
  const parts: string[] = [];
  if (title && title !== text) parts.push(title);
  if (text) parts.push(text);
  if (url && !text.includes(url)) parts.push(url);
  return parts.join("\n\n");
}
