"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PAGE_HELP, type PageHelpId } from "@/content/help/page-help";

export function PageHelp({ pageId }: { pageId: PageHelpId }) {
  const help = PAGE_HELP[pageId];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Help: ${help.title}`}
        >
          <HelpCircle className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{help.title}</DialogTitle>
          <DialogDescription>{help.summary}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
          {help.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        {help.guideSlug && (
          <Button variant="outline" size="sm" className="self-start" asChild>
            <Link href={`/help?guide=${help.guideSlug}`}>Read full guide →</Link>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
