"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function TextRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
  type,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Row label={label} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input {...field} type={type ?? "text"} value={field.value ?? ""} placeholder={placeholder} className="max-w-md" />
        )}
      />
    </Row>
  );
}

export function NumberRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  step,
  min,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  step?: string;
  min?: number;
}) {
  return (
    <Row label={label} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            type="number"
            step={step ?? "any"}
            min={min}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            className="max-w-40"
          />
        )}
      />
    </Row>
  );
}

export function TextareaRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  placeholder,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Row label={label} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Textarea {...field} value={field.value ?? ""} placeholder={placeholder} rows={3} className="max-w-xl" />
        )}
      />
    </Row>
  );
}

export function SwitchRow<T extends FieldValues>({
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
  return (
    <Row label={label} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
        )}
      />
    </Row>
  );
}

export function SelectRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  options,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  options: readonly string[];
}) {
  return (
    <Row label={label} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={String(field.value ?? "")} onValueChange={field.onChange}>
            <SelectTrigger className="max-w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Row>
  );
}
