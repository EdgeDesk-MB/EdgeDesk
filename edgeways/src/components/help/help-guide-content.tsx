import type { HelpGuide } from "@/content/help/guides";

export function HelpGuideContent({ guide }: { guide: HelpGuide }) {
  return (
    <article className="prose-sm max-w-none space-y-6">
      {guide.sections.map((section, i) => (
        <section key={i} className="space-y-2">
          {section.heading && (
            <h2 className="text-base font-semibold tracking-tight">{section.heading}</h2>
          )}
          {section.paragraphs?.map((p) => (
            <p key={p} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
