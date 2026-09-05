"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { PageLoading } from "@/components/page-loading";
import { EmptyState } from "@/components/help/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { api } from "@/hooks/use-app-state";
import { formatApiError } from "@/lib/api-errors";
import { parseOfferFromText } from "@/lib/offers/parse-offer-text";
import { rulesJsonFromParsedDraft } from "@/lib/offers/offer-rules-payload";
import { offerCategoryById } from "@/lib/offers/offer-categories";
import { combineShareParams } from "@/lib/offers/share-intake";
import { formatGbp } from "@/lib/format-money";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default function SharePage() {
  return (
    <Suspense fallback={<PageLoading label="Reading shared offer" />}>
      <ShareContent />
    </Suspense>
  );
}

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shared = combineShareParams({
    title: searchParams.get("title"),
    text: searchParams.get("text"),
    url: searchParams.get("url"),
  });
  const [text, setText] = useState(shared);
  const [saving, setSaving] = useState(false);

  const draft = useMemo(
    () => (text.trim() ? parseOfferFromText(text) : null),
    [text]
  );
  const rules = useMemo(
    () => (draft ? rulesJsonFromParsedDraft(draft) : null),
    [draft]
  );
  const title =
    draft?.title ||
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean)
      ?.slice(0, 80) ||
    "";

  async function handleAdd() {
    if (!title || saving) return;
    setSaving(true);
    try {
      await api("/api/offers", {
        method: "POST",
        json: {
          bookmaker: draft?.bookmaker ?? undefined,
          title,
          description: draft?.description ?? undefined,
          expectedProfit: draft?.expectedProfit ?? undefined,
          status: "planned",
          expiresAt: draft?.expiresAt ?? null,
          startsOn: draft?.startsOn ?? null,
          sport: draft ? offerCategoryById(draft.category).sport : null,
          offerType: rules?.includes("bet_get_free_place")
            ? "bet_get_free_place"
            : rules
              ? "promo_terms"
              : null,
          eventDate: draft?.eventDate ?? null,
          rules,
          source: "share",
        },
      });
      toast.success("Offer added", {
        description: "Waiting as Planned on Offers",
      });
      router.push("/offers");
    } catch (err) {
      toast.error("Could not add the offer", {
        description: formatApiError(err),
      });
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Shared offer"
        description="Turn a shared email or page into a desk offer."
        icon={Share2}
      />

      {!shared ? (
        <EmptyState
          icon={Share2}
          title="Nothing arrived with this share"
          description="Install Edgeways on your phone, then use Share in your email app or browser and pick Edgeways — the offer text lands here, parsed and ready to save."
          action={{ label: "Go to offers", href: "/offers" }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Review before saving</CardTitle>
            <CardDescription>
              Trim anything private from the text — only the parsed offer is
              kept. Saved as Planned on Offers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <textarea
              aria-label="Shared offer text"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={cn(
                fieldControl,
                "min-h-40 w-full resize-y px-2.5 py-2 text-sm leading-relaxed outline-none"
              )}
            />

            {draft && (draft.bookmaker || draft.expiresAt || draft.expectedProfit != null) && (
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {draft.bookmaker && (
                  <div className="flex gap-1.5">
                    <dt>Bookmaker</dt>
                    <dd className="font-medium text-foreground">
                      {draft.bookmaker}
                    </dd>
                  </div>
                )}
                {draft.expiresAt && (
                  <div className="flex gap-1.5">
                    <dt>Expires</dt>
                    <dd className="font-medium text-foreground">
                      {new Date(draft.expiresAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </dd>
                  </div>
                )}
                {draft.expectedProfit != null && (
                  <div className="flex gap-1.5">
                    <dt>Expected profit</dt>
                    <dd className="font-medium text-foreground">
                      {formatGbp(draft.expectedProfit)}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                {...pagePrimaryButtonProps}
                onClick={handleAdd}
                disabled={saving || !title}
              >
                {saving ? "Adding…" : "Add to offers"}
              </Button>
              <Button
                variant="outline"
                {...pageSecondaryButtonProps}
                onClick={() => router.push("/offers")}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
