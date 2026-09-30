"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Label + hint + control in one row.
 *
 * The label was a `<p>`, so EVERY settings field in the console had no
 * accessible name. It is now a real `<label htmlFor>` wired to the control's
 * id, with the hint linked via aria-describedby.
 */
function Row({
  label,
  hint,
  id,
  children,
}: {
  label: string;
  hint?: string;
  id: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-xs text-neutral-500">
            {hint}
          </p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Shared aria wiring so every control announces its label and hint. */
function desc(id: string, hint?: string): string | undefined {
  return hint ? `${id}-hint` : undefined;
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
  const id = String(name);
  return (
    <Row label={label} hint={hint} id={id}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            {...field}
            id={id}
            type={type ?? "text"}
            value={field.value ?? ""}
            placeholder={placeholder}
            aria-describedby={desc(id, hint)}
            className="max-w-md"
          />
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
  const id = String(name);
  return (
    <Row label={label} hint={hint} id={id}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={id}
            type="number"
            step={step ?? "any"}
            min={min}
            value={field.value ?? ""}
            aria-describedby={desc(id, hint)}
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
  const id = String(name);
  return (
    <Row label={label} hint={hint} id={id}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Textarea
            {...field}
            id={id}
            value={field.value ?? ""}
            placeholder={placeholder}
            aria-describedby={desc(id, hint)}
            rows={3}
            className="max-w-xl"
          />
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
  const id = String(name);
  return (
    <Row label={label} hint={hint} id={id}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch id={id} checked={!!field.value} aria-describedby={desc(id, hint)} onCheckedChange={field.onChange} />
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
  const id = String(name);
  return (
    <Row label={label} hint={hint} id={id}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={String(field.value ?? "")} onValueChange={field.onChange}>
            <SelectTrigger id={id} aria-describedby={desc(id, hint)} className="max-w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Row>
  );
}
