"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useShow, useDelete } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, Field, SectionTitle, TableSkeleton } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import type { AdminUserDetail, StaffRole } from "@/lib/refine/types";

async function userAction(id: string, body: object): Promise<{ tempPassword?: string; emailed?: boolean }> {
  const res = await fetch(`/api/v1/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Action failed.");
  return json.data;
}

export default function UserShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<AdminUserDetail>({ resource: "users", id });
  const { mutate: remove, mutation: deleting } = useDelete();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [staffRoleId, setStaffRoleId] = useState<string | null | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const u = query.data?.data;

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async (): Promise<StaffRole[]> => {
      const res = await fetch("/api/v1/admin/roles");
      if (!res.ok) return [];
      return (await res.json()).data as StaffRole[];
    },
    retry: false,
  });
  const staffRoles = rolesQuery.data ?? [];

  if (query.isLoading) return (<><BackLink href="/ys-admin/users" label="Users" /><Card className="p-0"><TableSkeleton rows={5} cols={2} /></Card></>);
  if (query.isError || !u) return (<><BackLink href="/ys-admin/users" label="Users" /><Card className="p-0"><ErrorState message="User not found." /></Card></>);

  const act = async (body: object, okMsg: string) => {
    setBusy(true);
    try {
      const r = await userAction(id, body);
      toast.success(okMsg);
      if (r.tempPassword) setTempPassword(r.tempPassword);
      setReason("");
      query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/users" label="Users" />
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h1 className="text-xl font-bold">{u.name ?? "Unnamed"}</h1>
            <p className="text-sm text-neutral-500">{u.email}</p>
          </div>
          <Badge variant="outline" className="font-mono text-[11px]">{u.role}</Badge>
          {u.staffRole ? (
            <Badge variant="outline" className="bg-sky-500/10 font-mono text-[11px] text-sky-700 dark:text-sky-400">
              {u.staffRole.name}
            </Badge>
          ) : null}
          {u.suspendedAt ? (
            <Badge variant="outline" className="bg-red-500/10 font-semibold text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400">
              SUSPENDED · {timeAgo(u.suspendedAt)}
            </Badge>
          ) : null}
          <span className="ml-auto text-xs text-neutral-400">joined {timeAgo(u.createdAt)}</span>
        </div>
        {u.suspendedAt && u.suspendReason ? (
          <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
            <span className="font-semibold">Suspension reason: </span>{u.suspendReason}
          </p>
        ) : null}

        <Separator />
        <dl className="grid gap-2 text-sm sm:grid-cols-4">
          <Field label="Orders">{u.orderCount} · {formatUSD(u.orderTotal)}</Field>
          <Field label="Stores">{u.stores.length}</Field>
          <Field label="Disputes">{u._count.disputes}</Field>
          <Field label="Coupons used">{u.redemptions}</Field>
        </dl>

        {u.stores.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {u.stores.map((s) => (
              <Link key={s.id} href={`/ys-admin/vendors/show/${s.id}`} className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900">
                {s.name} · {s.status}
              </Link>
            ))}
          </div>
        ) : null}

        <Separator />
        <SectionTitle>Role</SectionTitle>
        <div className="flex max-w-md gap-2">
          <Select value={role ?? u.role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["BUYER", "SELLER", "ADMIN"].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={busy || (role ?? u.role) === u.role} onClick={() => act({ action: "role", role: role ?? u.role }, `Role set to ${role ?? u.role}.`)}>
            Save role
          </Button>
        </div>

        <SectionTitle>Staff role</SectionTitle>
        <div className="flex max-w-md gap-2">
          <Select
            value={staffRoleId === undefined ? (u.staffRole?.id ?? "none") : (staffRoleId ?? "none")}
            onValueChange={(v) => setStaffRoleId(v === "none" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {staffRoles.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name} ({r.scopes.length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={busy || (staffRoleId === undefined || (staffRoleId ?? null) === (u.staffRole?.id ?? null))}
            onClick={() => act({ action: "staffRole", staffRoleId: staffRoleId ?? null }, "Staff role updated. Takes effect on next sign-in.")}
          >
            Save
          </Button>
        </div>
        {u.staffRole ? (
          <p className="flex flex-wrap gap-1">
            {u.staffRole.scopes.map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">{s}</Badge>
            ))}
          </p>
        ) : null}

        <SectionTitle>{u.suspendedAt ? "Reinstate" : "Suspend"}</SectionTitle>
        {u.suspendedAt ? (
          <Button variant="outline" disabled={busy} onClick={() => act({ action: "unsuspend" }, "Account reinstated.")} className="gap-1.5">
            <CheckCircle2 className="size-4" /> Unsuspend account
          </Button>
        ) : (
          <div className="grid max-w-xl gap-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Suspension reason (shown to the user)" rows={2} />
            <div>
              <Button variant="destructive" disabled={busy} onClick={() => act({ action: "suspend", ...(reason ? { reason } : {}) }, "Account suspended; stores frozen.")} className="gap-1.5">
                <Ban className="size-4" /> Suspend + freeze stores
              </Button>
            </div>
          </div>
        )}

        <SectionTitle>Password</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={busy}
            className="gap-1.5"
            onClick={() => {
              if (!window.confirm(`Reset ${u.email}'s password? A temporary one is issued.`)) return;
              act({ action: "resetPassword" }, "Password reset — share the temporary password once.");
            }}
          >
            <KeyRound className="size-4" /> Issue temporary password
          </Button>
          {tempPassword ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-1.5 font-mono text-sm font-bold">
              {tempPassword}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5"
                onClick={() => { void navigator.clipboard?.writeText(tempPassword); toast.success("Copied."); }}
              >
                <Copy className="size-3.5" />
              </Button>
            </span>
          ) : null}
        </div>

        <SectionTitle>Danger zone</SectionTitle>
        <Button
          size="sm"
          variant="destructive"
          disabled={deleting.isPending}
          onClick={() => {
            if (!window.confirm(`Delete ${u.email}? Only accounts with no history can be deleted.`)) return;
            remove(
              { resource: "users", id },
              {
                onSuccess: () => router.push("/ys-admin/users"),
                onError: (e) => toast.error((e as { message?: string })?.message ?? "Delete failed."),
              }
            );
          }}
          className="gap-1.5"
        >
          <Trash2 className="size-4" /> Delete account
        </Button>

        {u.auditRecent.length > 0 ? (
          <>
            <SectionTitle>Their recent activity</SectionTitle>
            <ul className="space-y-1 text-sm text-neutral-500">
              {u.auditRecent.map((a) => (
                <li key={a.id} className="font-mono text-xs">
                  {a.action} · {a.entity} {a.entityId.slice(0, 8)} · {timeAgo(a.createdAt)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
    </div>
  );
}
