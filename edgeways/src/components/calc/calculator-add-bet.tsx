"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddBetDialog, type AddBetPrefill } from "@/components/add-bet-dialog";

/** Opens Add bet with calculator prefill + View bet toast (matched calculator pattern). */
export function CalculatorAddBetButton({
  prefill,
  disabled,
  className,
  children = "Add to profit tracker",
  onSaved,
}: {
  prefill: AddBetPrefill;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onSaved?: (betId: number) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
      >
        {children}
      </Button>
      {open ? (
        <AddBetDialog
          open={open}
          onOpenChange={setOpen}
          highlightEmpty
          toastOnSave={false}
          onSaved={(betId) => {
            toast.success("Bet added", {
              description: "It's in the Profit Tracker.",
              action: {
                label: "View bet",
                onClick: () => router.push(`/tracker?highlight=${betId}`),
              },
            });
            onSaved?.(betId);
          }}
          prefill={prefill}
        />
      ) : null}
    </>
  );
}
