"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ADMIN_LIVE_SOUND_CHANGE_EVENT,
  playAdminLiveSound,
  readAdminLiveSoundEnabled,
  unlockAdminLiveSound,
  writeAdminLiveSoundEnabled,
} from "@/lib/admin/live-toast-sound";
import { cn } from "@/lib/utils";

export function AdminLiveSoundToggle({
  id = "live-toast-sound",
  className,
}: {
  id?: string;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readAdminLiveSoundEnabled());
    function onChange(event: Event) {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === "boolean") setEnabled(detail);
    }
    window.addEventListener(ADMIN_LIVE_SOUND_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(ADMIN_LIVE_SOUND_CHANGE_EVENT, onChange);
  }, []);

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Label htmlFor={id}>Toast sound</Label>
      <Switch
        id={id}
        checked={enabled}
        onCheckedChange={(next) => {
          unlockAdminLiveSound();
          writeAdminLiveSoundEnabled(next);
          setEnabled(next);
          if (next) playAdminLiveSound("desk");
        }}
      />
    </div>
  );
}
