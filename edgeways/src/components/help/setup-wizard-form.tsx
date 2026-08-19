"use client";

/**
 * Shared first-run form.
 * Hosted `/setup` (page): profile questions, then bank → bookies → defaults → alerts.
 * Dialog (Help / demo): operational steps only.
 */

import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import {
  Banknote,
  Bell,
  BellOff,
  Check,
  Compass,
  ListChecks,
  Loader2,
  Megaphone,
  Monitor,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Star,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookieNamePicker, ExchangeNamePicker } from "@/components/bookie-name-picker";
import { HeardPlatformIcon } from "@/components/help/heard-platform-icon";
import { ThemeSelect } from "@/components/theme-select";
import { useTheme } from "next-themes";
import { SportLabel } from "@/components/sport-icon";
import {
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  clearPublicDemoCookie,
  hasPublicDemoCookieInDocument,
} from "@/lib/demo/public-demo";
import { formatEvGbp, formatMoneyAmount } from "@/lib/format-money";
import { SPORTS } from "@/lib/sports";
import { normalizeDefaultSport } from "@/lib/services/settings-shared";
import { markOnboardingComplete } from "@/lib/onboarding";
import { planCheckoutHref, PUBLIC_PLANS } from "@/lib/billing/public-offer";
import type { SubscriptionAccount } from "@/lib/billing/subscription-view";
import type { PlanId } from "@/lib/entitlements/plans";
import {
  MONTHLY_TARGET_MAX,
  MONTHLY_TARGET_STEP,
  ONBOARDING_EXPERIENCE,
  ONBOARDING_HEARD,
  ONBOARDING_WHY,
  featurePlan,
  monthlyTargetPace,
  planTierLabel,
  upgradeNudgeBody,
  upgradeNudgeTitle,
  upgradePlanForFeatures,
  upgradeSuccessBody,
  upgradeSuccessTitle,
  type OnboardingExperienceId,
  type OnboardingHeardId,
  type OnboardingWhyId,
} from "@/lib/onboarding-profile";
import {
  SETUP_UPGRADE_CONFIRMED_KEY,
  clearSetupUpgradeSignals,
  readSetupUpgradeSignals,
  resolveSetupDisplayPlan,
  setupUpgradeSuccessPlan,
  writeSetupPlanBaselineIfEmpty,
  writeSetupUpgradeIntent,
} from "@/lib/onboarding-setup-upgrade";
import {
  dialogTitleIcon,
  dialogTitle,
  edgePanel,
  listRowSelected,
  panelSurface,
  quietPanel,
  successNotice,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

type SetupStepId =
  | "experience"
  | "why"
  | "heard"
  | "target"
  | "bank"
  | "bookies"
  | "defaults"
  | "alerts";

type SetupStep = {
  id: SetupStepId;
  icon: LucideIcon;
  title: string;
  body: string;
  help?: string;
};

const PROFILE_STEPS: readonly SetupStep[] = [
  {
    id: "experience",
    icon: Compass,
    title: "What's your experience of matched betting?",
    body: "So we know how to talk to you.",
    help: "Edgeways does not send bookie offers.",
  },
  {
    id: "why",
    icon: ListChecks,
    title: "What brought you to Edgeways app?",
    body: "Which features interest you most?",
    help: "Some sit on Core or Edge. We will say if an upgrade would unlock them.",
  },
  {
    id: "heard",
    icon: Megaphone,
    title: "How did you hear about Edgeways app?",
    body: "Optional. Skip if you would rather not say.",
    help: "Not used for ads.",
  },
  {
    id: "target",
    icon: Target,
    title: "What's your monthly profit target?",
    body: "Optional. Home uses this as a daily pace line.",
  },
];

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    id: "bank",
    icon: Banknote,
    title: "What's your matched betting bankroll?",
    body: "The account you fund bookies from.",
  },
  {
    id: "bookies",
    icon: Wallet,
    title: "What are your bookie balances?",
    body: "Add each bookie and what is in the wallet.",
  },
  {
    id: "defaults",
    icon: SlidersHorizontal,
    title: "Set your preferences",
    body: "These apply across the desk. Change them any time in Settings.",
  },
  {
    id: "alerts",
    icon: Bell,
    title: "When something needs you",
    body: "We'll nudge you when an offer is about to expire or a back sits unhedged.",
  },
];

const setupField = "h-9 min-h-9 max-h-9 py-0 text-sm";
const setupFieldStack = "flex flex-col gap-3";

function moneyEntered(raw: string): boolean {
  const n = parseFloat(String(raw).replace(/,/g, ""));
  return String(raw).trim() !== "" && Number.isFinite(n) && n >= 0;
}

function SetupMoneyInput({
  className,
  value,
  onChange,
  onBlur,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const parsed = parseFloat(String(value).replace(/,/g, ""));
  const display =
    focused || String(value).trim() === "" || !Number.isFinite(parsed)
      ? value
      : formatMoneyAmount(Math.max(0, parsed));

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
      >
        £
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (String(value).trim() !== "" && Number.isFinite(parsed)) {
            onChange(formatMoneyAmount(Math.max(0, parsed)));
          }
          onBlur?.(e);
        }}
        onChange={(e) => onChange(e.target.value)}
        className={cn(setupField, "pl-7 tabular-nums", className)}
      />
    </div>
  );
}

type BookieDraft = { name: string; balance: string };

function SkillMark({
  level,
  selected,
}: {
  level: 1 | 2 | 3 | 4;
  selected: boolean;
}) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const pct = level / 4;
  return (
    <span
      className="relative inline-flex size-8 shrink-0 items-center justify-center"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-8 -rotate-90">
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          className="stroke-border"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          className="stroke-brand"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <Star
        className={cn(
          "size-3.5 text-brand",
          selected ? "fill-brand" : "fill-brand/80"
        )}
      />
    </span>
  );
}

function ChoiceButton({
  selected,
  tabStop,
  title,
  body,
  onClick,
  role,
  leading,
  trailing,
  compact,
}: {
  selected: boolean;
  tabStop: boolean;
  title: string;
  body?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  role: "radio" | "checkbox";
  leading?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      tabIndex={tabStop ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (role !== "radio") return;
        if (
          event.key !== "ArrowDown" &&
          event.key !== "ArrowUp" &&
          event.key !== "ArrowRight" &&
          event.key !== "ArrowLeft"
        ) {
          return;
        }
        event.preventDefault();
        const root = event.currentTarget.closest("[role='radiogroup']");
        if (!root) return;
        const radios = [
          ...root.querySelectorAll<HTMLButtonElement>("[role='radio']"),
        ];
        const i = radios.indexOf(event.currentTarget);
        if (i < 0) return;
        const delta =
          event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const next = radios[(i + delta + radios.length) % radios.length];
        next?.click();
        requestAnimationFrame(() => next?.focus());
      }}
      className={cn(
        listRowSelected(selected),
        "flex w-full min-w-0 touch-manipulation items-start text-left",
        compact ? "min-h-11 gap-2.5 px-3 py-2.5" : "gap-3 px-3 py-3 sm:px-4 sm:py-3.5",
        "outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "active:bg-selection-subtle",
        !selected && "border-border/80"
      )}
    >
      {leading ? (
        <span
          className={cn(
            "flex shrink-0 items-center",
            compact ? "h-5 mt-px" : "mt-0.5"
          )}
        >
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-sm font-medium text-pretty break-words",
              compact && "leading-5"
            )}
          >
            {title}
          </span>
          {trailing}
        </span>
        {body ? (
          <span
            className={cn(
              "block text-xs leading-snug text-muted-foreground text-pretty break-words",
              compact ? "mt-0" : "mt-1"
            )}
          >
            {body}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function upgradeCheckoutHref(plan: PlanId): string | null {
  if (plan === "free") return null;
  const row = PUBLIC_PLANS.find((item) => item.id === plan);
  return row ? planCheckoutHref(row, "month", "setup") : null;
}

function selectedTickTone(
  required: PlanId,
  current: PlanId | null
): "included" | "core" | "edge" {
  const have = current ?? "free";
  if (required === "free" || have === "edge") return "included";
  if (required === "core") return have === "core" ? "included" : "core";
  return "edge";
}

function CheckMark({
  selected,
  tone = "core",
}: {
  selected: boolean;
  tone?: "included" | "core" | "edge";
}) {
  return (
    <span
      className={cn(
        "flex size-3 shrink-0 items-center justify-center rounded-sm ring-1",
        selected
          ? tone === "included"
            ? "bg-success text-white ring-success"
            : tone === "edge"
              ? "bg-edge text-edge-foreground ring-edge"
              : "bg-brand text-brand-foreground ring-brand"
          : "bg-card ring-border"
      )}
      aria-hidden
    >
      {selected ? <Check className="size-3" /> : null}
    </span>
  );
}

function captureOnboardingAnalytics(payload: {
  experience: OnboardingExperienceId;
  whyHere: OnboardingWhyId[];
  attribution: OnboardingHeardId | "skipped";
}) {
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.capture("onboarding_profile", {
        experience: payload.experience,
        why_here: payload.whyHere.join(","),
        attribution: payload.attribution,
      });
    })
    .catch(() => {
      /* analytics optional */
    });
}

export function SetupWizardForm({
  variant,
  onDismiss,
}: {
  variant: "dialog" | "page";
  onDismiss?: () => void;
}) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const isPage = variant === "page";
  const steps = useMemo(
    () => (isPage ? [...PROFILE_STEPS, ...SETUP_STEPS] : [...SETUP_STEPS]),
    [isPage]
  );
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankBalance, setBankBalance] = useState("");
  const [bookies, setBookies] = useState<BookieDraft[]>([{ name: "", balance: "" }]);
  const [stake, setStake] = useState("10");
  const [defaultBookie, setDefaultBookie] = useState("");
  const [defaultExchangeName, setDefaultExchangeName] = useState("");
  const [defaultSport, setDefaultSport] = useState(normalizeDefaultSport("football"));
  const [appearance, setAppearance] = useState<"light" | "dark" | null>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { exchanges, defaultExchange } = useExchanges();
  const appearanceChoice: "light" | "dark" =
    appearance ??
    (theme === "light" || theme === "dark"
      ? theme
      : resolvedTheme === "light"
        ? "light"
        : "dark");
  const [notifState, setNotifState] = useState<string>("default");
  const [experience, setExperience] = useState<OnboardingExperienceId | null>(null);
  const [whyHere, setWhyHere] = useState<OnboardingWhyId[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null);
  const [planBaseline, setPlanBaseline] = useState<PlanId | null>(null);
  const [upgradeIntent, setUpgradeIntent] = useState<PlanId | null>(null);
  const [upgradeConfirmed, setUpgradeConfirmed] = useState<PlanId | null>(null);
  const [attribution, setAttribution] = useState<OnboardingHeardId | "skipped" | null>(
    null
  );
  const [attributionOther, setAttributionOther] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [showStepErrors, setShowStepErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = steps[step]!;
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;
  const pace = monthlyTargetPace(monthlyTarget);
  const displayPlan = resolveSetupDisplayPlan(currentPlan, upgradeConfirmed);
  const upgradePlan =
    displayPlan != null ? upgradePlanForFeatures(whyHere, displayPlan) : null;
  const upgradeHref = upgradePlan ? upgradeCheckoutHref(upgradePlan) : null;
  const successPlan = setupUpgradeSuccessPlan({
    currentPlan: displayPlan,
    baseline: planBaseline,
    confirmed: upgradeConfirmed,
    intent: upgradeIntent,
  });

  useEffect(() => {
    if (!isPage) return;
    function syncSignals() {
      const next = readSetupUpgradeSignals(userId);
      setPlanBaseline((current) => current ?? next.baseline);
      setUpgradeIntent((current) => current ?? next.intent);
      setUpgradeConfirmed((current) => current ?? next.confirmed);
    }
    syncSignals();
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === SETUP_UPGRADE_CONFIRMED_KEY) {
        syncSignals();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isPage, userId]);

  useEffect(() => {
    if (!isPage) return;
    let cancelled = false;
    async function loadPlan() {
      try {
        const account = await api<SubscriptionAccount>("/api/billing/account");
        if (cancelled) return;
        setCurrentPlan(account.plan);
        setPlanBaseline((current) => current ?? writeSetupPlanBaselineIfEmpty(account.plan));
      } catch {
        if (cancelled) return;
        setCurrentPlan("free");
        setPlanBaseline((current) => current ?? writeSetupPlanBaselineIfEmpty("free"));
      }
    }
    void loadPlan();
    function onVisible() {
      if (document.visibilityState === "visible") {
        const next = readSetupUpgradeSignals(userId);
        setUpgradeIntent((current) => current ?? next.intent);
        setUpgradeConfirmed((current) => current ?? next.confirmed);
        void loadPlan();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [isPage, userId]);

  useEffect(() => {
    if (!isPage || !upgradePlan) return;
    const poll = window.setInterval(async () => {
      try {
        const account = await api<SubscriptionAccount>("/api/billing/account");
        setCurrentPlan(account.plan);
      } catch {
        /* keep last known plan */
      }
    }, 2000);
    const stop = window.setTimeout(() => window.clearInterval(poll), 90_000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, [isPage, upgradePlan]);

  useEffect(() => {
    if (!defaultExchange) return;
    setDefaultExchangeName((current) => current || defaultExchange.name);
  }, [defaultExchange]);

  useEffect(() => {
    function readPermission() {
      if (typeof Notification === "undefined") return "unsupported";
      return Notification.permission;
    }
    function sync() {
      setNotifState(readPermission());
    }
    sync();
    function onVisible() {
      if (document.visibilityState === "visible") sync();
    }
    document.addEventListener("visibilitychange", onVisible);
    let status: PermissionStatus | undefined;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "notifications" })
        .then((next) => {
          status = next;
          next.onchange = sync;
          sync();
        })
        .catch(() => {
          /* Permissions API optional */
        });
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (status) status.onchange = null;
    };
  }, []);

  function setBookie(index: number, patch: Partial<BookieDraft>) {
    setBookies((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function toggleWhy(id: OnboardingWhyId) {
    setWhyHere((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((row) => row !== id)
        : [...currentIds, id]
    );
  }

  async function requestNotifications() {
    try {
      const result = await Notification.requestPermission();
      setNotifState(result);
    } catch {
      setNotifState("unsupported");
    }
  }

  function enterDesk() {
    markOnboardingComplete(user?.id);
    clearPublicDemoCookie();
    window.location.assign("/desk");
  }

  function bankValid(): boolean {
    return bankName.trim() !== "" && moneyEntered(bankBalance);
  }

  function bookiesValid(): boolean {
    const filled = bookies.filter((row) => row.name.trim() || row.balance.trim());
    if (filled.length === 0) return false;
    return filled.every((row) => row.name.trim() !== "" && moneyEntered(row.balance));
  }

  function defaultsValid(): boolean {
    return moneyEntered(stake) && defaultBookie.trim() !== "";
  }

  function canAdvance(): boolean {
    if (current.id === "experience") return experience != null;
    if (current.id === "why") return whyHere.length > 0;
    if (current.id === "bank") return bankValid();
    if (current.id === "bookies") return bookiesValid();
    if (current.id === "defaults") return defaultsValid();
    return true;
  }

  function goNext() {
    if (!canAdvance()) {
      setShowStepErrors(true);
      return;
    }
    if (current.id === "heard" && attribution == null) {
      setAttribution("skipped");
    }
    if (current.id === "bookies" && !defaultBookie.trim()) {
      const first = bookies.find((row) => row.name.trim());
      if (first) setDefaultBookie(first.name.trim());
    }
    setShowStepErrors(false);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function skipStep() {
    if (current.id === "heard") setAttribution("skipped");
    setShowStepErrors(false);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function finish() {
    if (!bankValid() || !bookiesValid() || !defaultsValid()) {
      setShowStepErrors(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const startedAt = Date.now();
    const problems: string[] = [];
    let leaving = false;
    try {
      if (isPage && experience && whyHere.length > 0) {
        const profile = {
          experience,
          whyHere,
          whyHereOther: null,
          attribution: attribution ?? "skipped",
          attributionOther:
            attribution === "other" ? attributionOther.trim() || null : null,
        };
        await api("/api/account/onboarding", {
          method: "POST",
          json: profile,
        }).catch((e) => problems.push(`Profile: ${String(e)}`));
        captureOnboardingAnalytics({
          experience,
          whyHere,
          attribution: profile.attribution,
        });
      }

      let bankId: number | null = null;
      const bankAmount = parseFloat(bankBalance) || 0;
      const resolvedBankName = bankName.trim();
      try {
        const res = await api<{ account: { id: number } }>("/api/accounts", {
          method: "POST",
          json: {
            name: resolvedBankName,
            type: "bank",
            openingBalance: bankAmount,
          },
        });
        bankId = res.account.id;
      } catch (e) {
        problems.push(`Bank: ${String(e)}`);
      }

      let created = 0;
      for (const row of bookies) {
        const name = row.name.trim();
        if (!name) continue;
        try {
          await api("/api/accounts", {
            method: "POST",
            json: {
              name,
              type: "bookie",
              openingBalance: parseFloat(row.balance) || 0,
              fundedByAccountId: bankId,
            },
          });
          created++;
        } catch (e) {
          problems.push(`${name}: ${String(e)}`);
        }
      }

      const stakeValue = parseFloat(stake);
      const selectedExchange = exchanges.find(
        (row) => row.name.toLowerCase() === defaultExchangeName.trim().toLowerCase()
      );
      await api("/api/settings", {
        method: "PATCH",
        json: {
          ...(Number.isFinite(stakeValue) && stakeValue > 0
            ? { defaultBackStake: stakeValue }
            : {}),
          ...(defaultBookie.trim() ? { defaultBookmaker: defaultBookie.trim() } : {}),
          defaultSport,
          ...(isPage
            ? {
                monthlyProfitTarget: monthlyTarget > 0 ? monthlyTarget : null,
                ageConfirmedAt: Date.now(),
              }
            : {}),
        },
      }).catch((e) => problems.push(`Defaults: ${String(e)}`));
      if (selectedExchange && !selectedExchange.isDefault) {
        await api(`/api/exchanges/${selectedExchange.id}`, {
          method: "PATCH",
          json: { isDefault: true },
        }).catch((e) => problems.push(`Exchange: ${String(e)}`));
      }
      setTheme(appearanceChoice);

      if (problems.length > 0 || bankId == null || created === 0) {
        setSaveError(problems[0] ?? "Could not save your bank and bookies. Try again.");
        return;
      }

      markOnboardingComplete(user?.id);
      clearSetupUpgradeSignals();
      if (isPage || hasPublicDemoCookieInDocument()) {
        const remaining = 4000 - (Date.now() - startedAt);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        leaving = true;
        enterDesk();
        return;
      }
      onDismiss?.();
    } finally {
      if (!leaving) setSaving(false);
    }
  }

  if (saving && isPage) {
    return (
      <div
        className={cn(
          panelSurface,
          "flex h-full w-full flex-col items-center justify-center gap-3 p-7 sm:p-8"
        )}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-base font-semibold">Getting your dashboard ready</p>
        <p className="text-sm text-muted-foreground">
          Saving your preferences.
        </p>
      </div>
    );
  }

  const stepMeta = (
    <p className="text-xs text-muted-foreground">
      Set up your desk · Step {step + 1} of {steps.length}
    </p>
  );

  const fields = (
    <div className="flex flex-col">
        {current.id === "experience" ? (
          <div
            role="radiogroup"
            aria-label={current.title}
            className="flex flex-col gap-2 sm:gap-3"
          >
            {ONBOARDING_EXPERIENCE.map((option) => (
              <ChoiceButton
                key={option.id}
                role="radio"
                selected={experience === option.id}
                tabStop={
                  experience === option.id ||
                  (experience == null && option.id === ONBOARDING_EXPERIENCE[0]?.id)
                }
                title={option.label}
                body={option.comment}
                onClick={(event) => {
                  setExperience(option.id);
                  if (!isPage) return;
                  // Arrow keys call click() to move the radio. Stay on this step.
                  if (event.detail === 0) return;
                  setShowStepErrors(false);
                  setStep((s) => Math.min(s + 1, steps.length - 1));
                }}
                leading={
                  <SkillMark
                    level={option.skill}
                    selected={experience === option.id}
                  />
                }
              />
            ))}
          </div>
        ) : null}

        {current.id === "why" ? (
          <div className="flex flex-col gap-3">
            <div
              role="group"
              aria-label={current.title}
              className="flex flex-col gap-2 sm:gap-3"
            >
              {ONBOARDING_WHY.map((option) => {
                const selected = whyHere.includes(option.id);
                return (
                  <ChoiceButton
                    key={option.id}
                    role="checkbox"
                    selected={selected}
                    tabStop
                    compact
                    title={option.label}
                    body={option.description}
                    onClick={() => toggleWhy(option.id)}
                    leading={
                      <CheckMark
                        selected={selected}
                        tone={selectedTickTone(
                          featurePlan(option.id),
                          displayPlan
                        )}
                      />
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {current.id === "heard" ? (
          <div className="flex flex-col gap-3">
            <div
              role="radiogroup"
              aria-label={current.title}
              className="flex flex-col gap-3"
            >
              {ONBOARDING_HEARD.map((option) => (
                <ChoiceButton
                  key={option.id}
                  role="radio"
                  selected={attribution === option.id}
                  tabStop={
                    attribution === option.id ||
                    ((attribution == null || attribution === "skipped") &&
                      option.id === ONBOARDING_HEARD[0]?.id)
                  }
                  title={option.label}
                  onClick={() => setAttribution(option.id)}
                  leading={
                    <HeardPlatformIcon id={option.id} className="mt-0.5" />
                  }
                />
              ))}
            </div>
            {attribution === "other" ? (
              <Input
                aria-label="Where you heard about us"
                placeholder="Optional note"
                value={attributionOther}
                onChange={(e) => setAttributionOther(e.target.value)}
                maxLength={200}
                className={setupField}
              />
            ) : null}
          </div>
        ) : null}

        {current.id === "target" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium" aria-live="polite">
              {monthlyTarget >= MONTHLY_TARGET_MAX
                ? `${formatEvGbp(MONTHLY_TARGET_MAX)}+ a month`
                : monthlyTarget === 0
                  ? "No monthly target"
                  : `${formatEvGbp(monthlyTarget)} a month`}
            </p>
            <input
              id="setup-monthly-target"
              type="range"
              min={0}
              max={MONTHLY_TARGET_MAX}
              step={MONTHLY_TARGET_STEP}
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(Number(e.target.value))}
              aria-label="Monthly profit target"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-brand"
            />
            <p className="text-sm text-muted-foreground">
              {monthlyTarget === 0
                ? "Home will not show a pace line until you set one in Settings."
                : `About ${formatEvGbp(pace.daily)} a day · ${formatEvGbp(pace.yearly)} a year`}
            </p>
          </div>
        ) : null}

        {current.id === "bank" ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className={setupFieldStack}>
              <Label htmlFor="setup-bank-name">Bank name</Label>
              <Input
                id="setup-bank-name"
                placeholder="e.g. Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                aria-invalid={showStepErrors && !bankName.trim()}
                className={setupField}
              />
              {showStepErrors && !bankName.trim() ? (
                <p className="text-xs text-destructive">Enter a bank name.</p>
              ) : null}
            </div>
            <div className={setupFieldStack}>
              <Label htmlFor="setup-bank-balance">Bankroll</Label>
              <SetupMoneyInput
                id="setup-bank-balance"
                value={bankBalance}
                onChange={setBankBalance}
                aria-invalid={showStepErrors && !moneyEntered(bankBalance)}
              />
              {showStepErrors && !moneyEntered(bankBalance) ? (
                <p className="text-xs text-destructive">Enter the bankroll.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {current.id === "bookies" ? (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground text-pretty">
              If a bookie is not listed, type the name to add it.
            </p>
            {bookies.map((row, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] gap-2">
                  <BookieNamePicker
                    label=""
                    ariaLabel={`Bookie ${i + 1}`}
                    value={row.name}
                    onChange={(v) => setBookie(i, { name: v })}
                    persistCustom={false}
                  />
                  <SetupMoneyInput
                    aria-label={`Balance for bookie ${i + 1}`}
                    value={row.balance}
                    onChange={(balance) => setBookie(i, { balance })}
                    aria-invalid={
                      showStepErrors &&
                      (!row.name.trim() || !moneyEntered(row.balance))
                    }
                  />
                </div>
                {showStepErrors && (!row.name.trim() || !moneyEntered(row.balance)) ? (
                  <p className="text-xs text-destructive">
                    {!row.name.trim()
                      ? "Select a bookie."
                      : "Enter the balance."}
                  </p>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setBookies((rows) => [...rows, { name: "", balance: "" }])}
            >
              <Plus className="size-4" />
              Add another bookie
            </Button>
          </div>
        ) : null}

        {current.id === "defaults" ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className={setupFieldStack}>
                <Label htmlFor="setup-stake">Default back stake</Label>
                <SetupMoneyInput
                  id="setup-stake"
                  value={stake}
                  onChange={setStake}
                />
              </div>
              <div className={setupFieldStack}>
                <Label htmlFor="setup-default-bookie">Default bookie</Label>
                <BookieNamePicker
                  id="setup-default-bookie"
                  label=""
                  ariaLabel="Default bookie"
                  value={defaultBookie}
                  onChange={setDefaultBookie}
                  persistCustom={false}
                />
                {showStepErrors && !defaultBookie.trim() ? (
                  <p className="text-xs text-destructive">Select a default bookie.</p>
                ) : null}
              </div>
              <div className={setupFieldStack}>
                <Label htmlFor="setup-default-sport">Default sport</Label>
                <Select
                  value={defaultSport}
                  onValueChange={(value) => setDefaultSport(normalizeDefaultSport(value))}
                >
                  <SelectTrigger
                    id="setup-default-sport"
                    className={cn(setupField, "w-full data-[size=default]:h-9")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS.map((sport) => (
                      <SelectItem key={sport.value} value={sport.value}>
                        <SportLabel sport={sport.value} size={14} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={setupFieldStack}>
                <Label>Default exchange</Label>
                <ExchangeNamePicker
                  label=""
                  allowCustom={false}
                  value={defaultExchangeName}
                  onChange={setDefaultExchangeName}
                />
              </div>
            </div>
            <div className={setupFieldStack}>
              <Label>Appearance</Label>
              <ThemeSelect
                className="h-9 min-h-9 max-h-9"
                value={appearanceChoice}
                onValueChange={setAppearance}
              />
              <p className="text-xs text-muted-foreground">
                Applies when you open the desk.
              </p>
            </div>
          </div>
        ) : null}

        {current.id === "alerts" ? (
          <div className="flex flex-col gap-6">
            <div className={cn(quietPanel, "px-3 py-3")}>
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Monitor className="size-3.5 shrink-0" aria-hidden />
                This computer
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                Alerts show in Edgeways while you work. Allow notifications if
                you also want them on this computer when you are in another
                window.
              </p>
              <div className="mt-3">
                {notifState === "granted" ? (
                  <p className="flex items-center gap-2 text-sm text-pretty text-success">
                    <Check className="size-4 shrink-0" aria-hidden />
                    Notifications allowed in this browser.
                  </p>
                ) : notifState === "denied" ? (
                  <p
                    className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/20 px-3 py-2.5 text-sm text-destructive"
                  >
                    <BellOff className="size-4 shrink-0" aria-hidden />
                    Notifications are blocked in this browser. You will still
                    see alerts inside Edgeways.
                  </p>
                ) : notifState === "unsupported" ? (
                  <p className="text-sm text-muted-foreground text-pretty">
                    This browser cannot send notifications. You will still see
                    alerts inside Edgeways.
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void requestNotifications()}
                  >
                    Allow notifications
                  </Button>
                )}
              </div>
            </div>
            <div className={cn(quietPanel, "px-3 py-3")}>
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Smartphone className="size-3.5 shrink-0" aria-hidden />
                On your phone
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                Edgeways is a web app you can install. Open this site on your
                phone, add it to your Home Screen, then go to Settings → Alerts
                and turn on Push to this device.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
              You can import spreadsheet history later from Settings → Data
              &amp; backup, including an Oddsmonkey profits CSV.
            </p>
          </div>
        ) : null}
    </div>
  );

  const stepDots = (
    <div className="flex justify-center gap-1.5" aria-hidden>
      {steps.map((s, i) => (
        <span
          key={s.id}
          className={`size-1.5 rounded-full transition-colors ${
            i === step ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );

  const primaryProps = isPage ? pagePrimaryButtonProps : { size: "sm" as const };
  const secondaryProps = isPage ? pageSecondaryButtonProps : { size: "sm" as const };

  const ghostProps = isPage ? { size: "default" as const } : { size: "sm" as const };

  const leftNav = !isPage ? (
    <Button variant="ghost" {...ghostProps} onClick={() => onDismiss?.()}>
      Skip
    </Button>
  ) : isFirst ? (
    <Button
      variant="ghost"
      {...ghostProps}
      onClick={() => {
        window.location.assign("/demo");
      }}
    >
      Try the desk
    </Button>
  ) : current.id === "heard" ? (
    <Button variant="ghost" {...ghostProps} onClick={skipStep}>
      Skip
    </Button>
  ) : null;

  const nav = (
    <div className="flex w-full min-w-0 items-center gap-2">
      {leftNav}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {step > 0 && (
          <Button
            variant="outline"
            {...secondaryProps}
            onClick={() => {
              setShowStepErrors(false);
              setStep((s) => s - 1);
            }}
          >
            Back
          </Button>
        )}
        {isLast ? (
          <Button {...primaryProps} disabled={saving} onClick={() => void finish()}>
            {saving ? "Setting up…" : "Finish set-up"}
          </Button>
        ) : (
          <Button {...primaryProps} disabled={saving} onClick={goNext}>
            Next
          </Button>
        )}
      </div>
    </div>
  );

  const stepHelp = (
    <p className="min-w-0 text-sm text-muted-foreground text-pretty break-words">
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
    </p>
  );

  if (isPage) {
    return (
      <div
        className={cn(
          panelSurface,
          "relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden p-5 sm:p-8",
          "[&>*]:relative [&>*]:z-[2]"
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <Icon className={cn(dialogTitleIcon, "shrink-0 text-brand")} />
          <h1 className={cn(dialogTitle, "min-w-0")}>{current.title}</h1>
        </div>
        <div className="mt-2 shrink-0">{stepHelp}</div>
        <div className="mt-4 shrink-0 sm:mt-6">{stepMeta}</div>
        <ScrollFadeEdges
          className="mt-5 sm:mt-8"
          scrollClassName="app-scroll-nested px-2"
          fadeClassName="from-card"
          scrollStartKey={current.id}
        >
          {fields}
        </ScrollFadeEdges>
        <div className="mt-4 flex shrink-0 flex-col gap-4 sm:mt-6 sm:gap-6">
          {saveError ? (
            <p className="text-sm text-destructive text-pretty" role="alert">
              {saveError}
            </p>
          ) : null}
          {showStepErrors && !canAdvance() ? (
            <p className="text-sm text-destructive text-pretty" role="alert">
              {current.id === "experience"
                ? "Choose one to continue."
                : current.id === "why"
                  ? "Choose at least one to continue."
                  : current.id === "bank"
                    ? "Enter a bank name and bankroll."
                    : current.id === "bookies"
                      ? "Add at least one bookie and balance."
                      : current.id === "defaults"
                        ? "Set a default stake and bookie."
                        : "Finish this step to continue."}
            </p>
          ) : null}
          {stepDots}
          {current.id === "why" &&
          displayPlan == null &&
          whyHere.some((id) => featurePlan(id) !== "free") ? (
            <p className="text-xs text-muted-foreground" role="status">
              Checking your plan…
            </p>
          ) : null}
          {current.id === "why" && upgradePlan && upgradeHref ? (
            <div
              role="status"
              className={cn(
                upgradePlan === "edge" ? edgePanel : quietPanel,
                "px-3 py-2.5"
              )}
            >
              <p className="text-base font-semibold text-foreground">
                {upgradeNudgeTitle(upgradePlan)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-pretty break-words text-muted-foreground">
                You are on{" "}
                <strong className="font-semibold text-foreground">
                  {planTierLabel(displayPlan ?? "free")}
                </strong>
                . {upgradeNudgeBody()}
              </p>
              <Button
                asChild
                variant={upgradePlan === "edge" ? "edge" : "pagePrimary"}
                size="sm"
                className="mt-3 self-start"
              >
                <a
                  href={upgradeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Upgrade now (opens in a new tab)"
                  onClick={() => {
                    writeSetupUpgradeIntent(upgradePlan);
                    setUpgradeIntent(upgradePlan);
                  }}
                >
                  Upgrade now
                </a>
              </Button>
            </div>
          ) : current.id === "why" && successPlan ? (
            <div
              role="status"
              className={cn(successNotice, "flex items-start gap-2.5 px-3 py-2.5")}
            >
              <span
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm bg-success text-white"
                aria-hidden
              >
                <Check className="size-3" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">
                  {upgradeSuccessTitle(successPlan)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-pretty break-words text-muted-foreground">
                  {upgradeSuccessBody()}
                </p>
              </div>
            </div>
          ) : null}
          <div className="w-full min-w-0">{nav}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <Icon className={cn(dialogTitleIcon, "text-brand")} />
          {current.title}
        </DialogTitle>
        <DialogDescription
          explainer={
            current.help ? (
              <DialogExplainer label="More about this step">
                {current.help}
              </DialogExplainer>
            ) : undefined
          }
        >
          {current.body}
        </DialogDescription>
      </DialogHeader>
      {stepMeta}
      <div className="mt-8">{fields}</div>
      <div className="mt-8">{stepDots}</div>
      <DialogFooter className="sm:justify-between">
        {nav}
      </DialogFooter>
    </>
  );
}
