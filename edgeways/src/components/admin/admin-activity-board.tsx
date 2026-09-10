"use client";

import { cloneElement, isValidElement, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import {
  ACTIVITY_WIDGET_LABEL,
  ACTIVITY_WIDGET_SPAN,
  activityBoardFromPreset,
  moveActivityWidget,
  writeActivityBoardCookie,
  type ActivityBoardFocus,
  type ActivityBoardLayout,
  type ActivityWidgetId,
} from "@/lib/admin/activity-board";
import { filterPillGroup, sectionStack } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const FOCUS_PILLS: Array<{ key: ActivityBoardFocus; label: string }> = [
  { key: "pins", label: "Pins" },
  { key: "volume", label: "Volume" },
  { key: "mix", label: "Mix" },
];

export function AdminActivityBoard({
  layout,
  pins,
  timeline,
  volume,
  categories,
  desks,
}: {
  layout: ActivityBoardLayout;
  pins?: React.ReactNode;
  timeline?: React.ReactNode;
  volume?: React.ReactNode;
  categories?: React.ReactNode;
  desks?: React.ReactNode;
}) {
  const widgets: Partial<Record<ActivityWidgetId, React.ReactNode>> = {
    pins,
    timeline,
    volume,
    categories,
    desks,
  };
  const router = useRouter();
  const [arranging, setArranging] = useState(false);
  const [current, setCurrent] = useState(layout);

  useEffect(() => {
    setCurrent(layout);
  }, [layout]);

  function commit(next: ActivityBoardLayout) {
    setCurrent(next);
    writeActivityBoardCookie(next);
    router.refresh();
  }

  const visible = current.order.filter((id) => widgets[id] != null);

  return (
    <div className={sectionStack}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div
          className={cn(filterPillGroup, "min-w-0")}
          role="group"
          aria-label="Activity focus"
        >
          {FOCUS_PILLS.map((pill) => (
            <FilterPill
              key={pill.key}
              active={current.preset === pill.key}
              title={`Focus ${pill.label.toLowerCase()}`}
              aria-label={`Focus ${pill.label.toLowerCase()}`}
              onClick={() => commit(activityBoardFromPreset(pill.key))}
            >
              {pill.label}
            </FilterPill>
          ))}
          {current.preset === "custom" ? (
            <FilterPill active title="Custom order" aria-label="Custom order">
              Custom
            </FilterPill>
          ) : null}
        </div>
        <FilterPill
          active={arranging}
          aria-label={arranging ? "Done arranging widgets" : "Arrange widgets"}
          onClick={() => setArranging((on) => !on)}
        >
          {arranging ? "Done" : "Arrange"}
        </FilterPill>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-[var(--layout-stack-gap)]">
        {visible.map((id) => {
          const span = ACTIVITY_WIDGET_SPAN[id];
          const index = visible.indexOf(id);
          return (
            <div
              key={id}
              className={cn(
                "min-w-0",
                span === "full" && "lg:col-span-2"
              )}
            >
              {arranging ? (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {ACTIVITY_WIDGET_LABEL[id]}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Move ${ACTIVITY_WIDGET_LABEL[id]} up`}
                      disabled={index === 0}
                      onClick={() =>
                        commit(moveActivityWidget(current.order, id, -1))
                      }
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Move ${ACTIVITY_WIDGET_LABEL[id]} down`}
                      disabled={index === visible.length - 1}
                      onClick={() =>
                        commit(moveActivityWidget(current.order, id, 1))
                      }
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
              {isValidElement(widgets[id])
                ? cloneElement(widgets[id], { key: id })
                : widgets[id]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
