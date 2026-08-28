"use client";

import { useEffect, useState } from "react";
import { Compass, ListChecks, Megaphone } from "lucide-react";
import { HeardPlatformIcon } from "@/components/help/heard-platform-icon";
import {
  CheckMark,
  ChoiceButton,
  selectedTickTone,
  SkillMark,
} from "@/components/help/setup-choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OnboardingAnswerRow } from "@/lib/admin/funnel";
import { formatAdminDateTime } from "@/lib/admin/format";
import {
  featurePlan,
  ONBOARDING_EXPERIENCE,
  ONBOARDING_HEARD,
  ONBOARDING_HOSTED_STEPS,
  ONBOARDING_WHY,
} from "@/lib/onboarding-profile";
import {
  adminModeTag,
  dialogTitleIcon,
  tableBodyCell,
  tableHeaderCell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const STEP_ICONS = {
  experience: Compass,
  why: ListChecks,
  heard: Megaphone,
} as const;

export function OnboardingAnswersTable({
  rows,
}: {
  rows: OnboardingAnswerRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const open = rows.find((row) => row.clerkUserId === openId) ?? null;
  const current = ONBOARDING_HOSTED_STEPS[step] ?? ONBOARDING_HOSTED_STEPS[0]!;
  const Icon = STEP_ICONS[current.id];
  const last = step === ONBOARDING_HOSTED_STEPS.length - 1;

  useEffect(() => {
    setStep(0);
  }, [openId]);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={tableHeaderCell}>Email</TableHead>
            <TableHead className={tableHeaderCell}>Experience</TableHead>
            <TableHead className={tableHeaderCell}>Why they are here</TableHead>
            <TableHead className={tableHeaderCell}>How they heard</TableHead>
            <TableHead className={cn(tableHeaderCell, "text-right")}>
              Saved
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.clerkUserId}
              className="cursor-pointer"
              onClick={() => setOpenId(row.clerkUserId)}
            >
              <TableCell
                className={cn(tableBodyCell, "max-w-[16rem] min-w-0 align-top")}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenId(row.clerkUserId);
                    }}
                  >
                    {row.email ?? row.clerkUserId}
                  </button>
                  {row.admin ? (
                    <span className={cn(adminModeTag, "shrink-0")}>ADMIN</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell
                className={cn(tableBodyCell, "whitespace-nowrap align-top")}
              >
                {row.experienceLabel}
              </TableCell>
              <TableCell
                className={cn(
                  tableBodyCell,
                  "min-w-0 whitespace-normal align-top"
                )}
              >
                <ul className="flex min-w-0 flex-wrap gap-1">
                  {row.whyHereLabels.map((label, index) => (
                    <li key={`${label}-${index}`}>
                      <Badge variant="outline">{label}</Badge>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell
                className={cn(tableBodyCell, "whitespace-nowrap align-top")}
              >
                {row.attributionLabel}
              </TableCell>
              <TableCell
                className={cn(
                  tableBodyCell,
                  "whitespace-nowrap align-top text-right tabular-nums"
                )}
              >
                {formatAdminDateTime(row.savedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={open != null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      >
        {open ? (
          <DialogContent
            data-dialog-tone="page"
            className="flex max-h-[min(40rem,90dvh)] flex-col gap-0 overflow-hidden sm:max-w-xl dark:bg-page"
          >
            <DialogHeader>
              <DialogTitle className="flex min-w-0 items-center gap-2.5 pr-8">
                <Icon
                  className={cn(dialogTitleIcon, "shrink-0 text-primary-text")}
                />
                <span className="min-w-0 text-pretty">{current.title}</span>
              </DialogTitle>
              <DialogDescription className="text-pretty">
                {current.body}
                {current.help ? (
                  <>
                    {" "}
                    <DialogExplainer
                      label="More about this step"
                      className="align-middle"
                    >
                      {current.help}
                    </DialogExplainer>
                  </>
                ) : null}
              </DialogDescription>
              <p className="text-xs text-muted-foreground">
                {open.email ?? open.clerkUserId} · answered{" "}
                {formatAdminDateTime(open.savedAt)} · question {step + 1} of{" "}
                {ONBOARDING_HOSTED_STEPS.length}
              </p>
            </DialogHeader>

            <ScrollFadeEdges
              className="min-h-0 flex-1"
              scrollClassName="app-scroll-nested"
              fadeClassName="from-page"
              scrollStartKey={current.id}
            >
              {current.id === "experience" ? (
                <div
                  role="radiogroup"
                  aria-label={current.title}
                  className="flex flex-col gap-2 sm:gap-3"
                >
                  {ONBOARDING_EXPERIENCE.map((option) => (
                    <ChoiceButton
                      key={option.id}
                      readOnly
                      role="radio"
                      selected={open.profile.experience === option.id}
                      title={option.label}
                      body={option.comment}
                      leading={
                        <SkillMark
                          level={option.skill}
                          selected={open.profile.experience === option.id}
                        />
                      }
                    />
                  ))}
                </div>
              ) : null}

              {current.id === "why" ? (
                <div
                  role="group"
                  aria-label={current.title}
                  className="flex flex-col gap-2 sm:gap-3"
                >
                  {ONBOARDING_WHY.map((option) => {
                    const selected = open.profile.whyHere.includes(option.id);
                    return (
                      <ChoiceButton
                        key={option.id}
                        readOnly
                        role="checkbox"
                        selected={selected}
                        compact
                        title={option.label}
                        body={option.description}
                        trailing={
                          featurePlan(option.id) === "free" ? undefined : (
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {featurePlan(option.id) === "edge" ? "Edge" : "Core"}
                            </span>
                          )
                        }
                        leading={
                          <CheckMark
                            selected={selected}
                            tone={selectedTickTone(
                              featurePlan(option.id),
                              open.plan
                            )}
                          />
                        }
                      />
                    );
                  })}
                </div>
              ) : null}

              {current.id === "heard" ? (
                <div className="flex flex-col gap-3">
                  {open.profile.attribution === "skipped" ? (
                    <p className="text-sm text-muted-foreground">
                      They skipped this question.
                    </p>
                  ) : null}
                  <div
                    role="radiogroup"
                    aria-label={current.title}
                    className="flex flex-col gap-3"
                  >
                    {ONBOARDING_HEARD.map((option) => (
                      <ChoiceButton
                        key={option.id}
                        readOnly
                        role="radio"
                        selected={open.profile.attribution === option.id}
                        title={option.label}
                        leading={
                          <HeardPlatformIcon
                            id={option.id}
                            className="mt-0.5"
                          />
                        }
                      />
                    ))}
                  </div>
                  {open.profile.attribution === "other" ? (
                    <Input
                      readOnly
                      aria-label="Where they heard about us"
                      value={open.profile.attributionOther ?? ""}
                      placeholder="No note"
                    />
                  ) : null}
                </div>
              ) : null}
            </ScrollFadeEdges>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
              >
                Previous
              </Button>
              <div className="flex justify-center gap-1.5 self-center" aria-hidden>
                {ONBOARDING_HOSTED_STEPS.map((item, index) => (
                  <span
                    key={item.id}
                    className={cn(
                      "size-1.5 rounded-full",
                      index === step ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              {last ? (
                <Button type="button" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() =>
                    setStep((currentStep) =>
                      Math.min(ONBOARDING_HOSTED_STEPS.length - 1, currentStep + 1)
                    )
                  }
                >
                  Next
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
