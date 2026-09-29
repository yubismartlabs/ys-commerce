"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const GREEN = new Set(["APPROVED", "ACTIVE", "PAID", "DELIVERED", "RESOLVED_BUYER", "RESOLVED_SELLER"]);
const AMBER = new Set(["PENDING", "OPEN", "UNDER_REVIEW", "SHIPPED"]);
const RED = new Set(["SUSPENDED", "REJECTED", "TAKEDOWN", "CANCELLED", "REFUNDED"]);
const BLUE = new Set(["DRAFT"]);

function tone(value: string): string {
  if (GREEN.has(value)) return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400";
  if (AMBER.has(value)) return "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400";
  if (RED.has(value)) return "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-400";
  if (BLUE.has(value)) return "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-400";
  return "bg-neutral-500/10 text-neutral-600 ring-neutral-500/20 dark:text-neutral-400";
}

function dot(value: string): string {
  if (GREEN.has(value)) return "bg-emerald-500";
  if (AMBER.has(value)) return "bg-amber-500";
  if (RED.has(value)) return "bg-red-500";
  if (BLUE.has(value)) return "bg-sky-500";
  return "bg-neutral-400";
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full font-semibold ring-1 ring-inset", tone(value))}>
      <span className={cn("size-1.5 rounded-full", dot(value))} />
      {value.replace(/_/g, " ")}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusFilter({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant={value === undefined ? "default" : "outline"}
        className="rounded-full"
        onClick={() => onChange(undefined)}
      >
        ALL
      </Button>
      {options.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={value === s ? "default" : "outline"}
          className="rounded-full"
          onClick={() => onChange(s)}
        >
          {s.replace(/_/g, " ")}
        </Button>
      ))}
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total?: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <span className="tabular-nums">Page {page} of {Math.max(pageCount, 1)}</span>
        <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
      {total !== undefined ? <span className="tabular-nums">{total} records</span> : null}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8 flex-1" style={{ animationDelay: `${(r * cols + c) * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="rounded-full bg-neutral-100 p-3 dark:bg-neutral-800">
        <Icon className="size-6 text-neutral-400" />
      </span>
      <p className="font-semibold">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ message = "Failed to load." }: { message?: string }) {
  return <p className="p-6 text-sm text-red-600">{message}</p>;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button size="sm" variant="ghost" asChild className="-ml-2 gap-1 text-neutral-500">
      <Link href={href}>← {label}</Link>
    </Button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-[13px] font-medium text-neutral-500">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">{children}</p>;
}
