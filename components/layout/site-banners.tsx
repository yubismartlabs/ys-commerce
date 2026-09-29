"use client";

import { useState } from "react";
import { Megaphone, Wrench, X } from "lucide-react";

export function SiteBanners({
  maintenance,
  announcement,
}: {
  maintenance: { enabled: boolean; message: string };
  announcement: string;
}) {
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("ys-announcement-dismissed");
    } catch {
      return null;
    }
  });

  const showAnnouncement = announcement.trim().length > 0 && dismissed !== announcement;

  if (!maintenance.enabled && !showAnnouncement) return null;

  return (
    <div>
      {maintenance.enabled ? (
        <p className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-[13px] font-medium text-amber-950">
          <Wrench className="size-3.5 shrink-0" />
          <span className="line-clamp-2">{maintenance.message}</span>
        </p>
      ) : null}
      {showAnnouncement ? (
        <p className="flex items-center justify-center gap-2 bg-neutral-900 px-4 py-1.5 text-center text-[13px] text-white">
          <Megaphone className="size-3.5 shrink-0 text-ali-orange" />
          <span className="line-clamp-2 flex-1">{announcement}</span>
          <button
            aria-label="Dismiss announcement"
            className="shrink-0 rounded p-0.5 hover:bg-white/10"
            onClick={() => {
              try {
                sessionStorage.setItem("ys-announcement-dismissed", announcement);
              } catch {
                /* private mode */
              }
              setDismissed(announcement);
            }}
          >
            <X className="size-3.5" />
          </button>
        </p>
      ) : null}
    </div>
  );
}
