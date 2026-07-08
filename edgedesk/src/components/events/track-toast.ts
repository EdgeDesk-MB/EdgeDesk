import { toast } from "sonner";

export function toastAddedToTrackedEvents(label: string, onView: () => void) {
  toast.success("Added to Tracked Events", {
    description: label,
    action: { label: "View", onClick: onView },
  });
}

export function toastAlreadyTracked(onView: () => void) {
  toast.info("Already in Tracked Events", {
    action: { label: "View", onClick: onView },
  });
}
