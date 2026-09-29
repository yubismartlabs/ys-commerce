"use client";

import { useState } from "react";
import Image from "next/image";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function LogoRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-32 items-center justify-center overflow-hidden rounded-lg border bg-white text-xs text-neutral-400">
                {field.value ? (
                  <Image src={field.value} alt="Logo preview" width={128} height={48} className="h-full w-full object-contain" />
                ) : (
                  "No logo"
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => document.getElementById("logo-upload")?.click()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Upload image
              </Button>
            </div>
            <input
              id="logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  const res = await fetch("/api/v1/admin/uploads", { method: "POST", body: form });
                  const json = await res.json().catch(() => null);
                  if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed.");
                  field.onChange(json.data.url);
                  toast.success("Logo uploaded.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Upload failed.");
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
            <Input
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder="…or paste an image URL"
              className="max-w-md font-mono text-xs"
            />
          </div>
        )}
      />
    </div>
  );
}
