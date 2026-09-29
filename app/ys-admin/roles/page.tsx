"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BackLink, EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import type { StaffRole } from "@/lib/refine/types";

// Assignable console areas ("admin" stays exclusive to the ADMIN role).
const ASSIGNABLE = [
  "vendors",
  "products",
  "orders",
  "disputes",
  "coupons",
  "deals",
  "payouts",
  "emails",
  "settings",
  "users",
  "ops",
  "chat",
] as const;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed.");
  return json.data;
}

function RoleDialog({
  role,
  onDone,
}: {
  role?: StaffRole;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [scopes, setScopes] = useState<string[]>(role?.scopes ?? []);
  const [saving, setSaving] = useState(false);

  const toggle = (s: string) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error("Name needs 2+ characters.");
      return;
    }
    setSaving(true);
    try {
      if (role) {
        await api(`/api/v1/admin/roles/${role.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), scopes }) });
        toast.success("Role updated. Members pick it up on next sign-in.");
      } else {
        await api("/api/v1/admin/roles", { method: "POST", body: JSON.stringify({ name: name.trim(), scopes }) });
        toast.success("Role created.");
      }
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {role ? (
          <Button size="sm" variant="outline" className="gap-1"><Pencil className="size-3.5" /> Edit</Button>
        ) : (
          <Button className="bg-ali-red text-white hover:bg-ali-red-dark"><Plus className="size-4" /> New role</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : "New staff role"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name, e.g. Support" maxLength={40} />
          <div className="grid grid-cols-2 gap-2">
            {ASSIGNABLE.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Checkbox checked={scopes.includes(s)} onCheckedChange={() => toggle(s)} />
                <span className="font-mono text-xs">{s}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            Members see only the areas checked. Full access stays exclusive to the ADMIN role.
            {role && role._count && role._count.users > 0 ? ` ${role._count.users} user(s) hold this role.` : ""}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} {role ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api("/api/v1/admin/roles") as Promise<StaffRole[]>,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
  const rows = query.data ?? [];

  const remove = async (r: StaffRole) => {
    if (!window.confirm(`Delete role ${r.name}? Members must be unassigned first.`)) return;
    try {
      await api(`/api/v1/admin/roles/${r.id}`, { method: "DELETE" });
      toast.success("Role deleted.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/users" label="Users" />
      <PageHeader
        title="Staff roles"
        description="Named scope bundles for support, finance and ops — enforced on every route."
        actions={<RoleDialog onDone={refresh} />}
      />
      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : query.isError ? (
          <ErrorState message="Failed to load roles." />
        ) : rows.length === 0 ? (
          <EmptyState title="No staff roles" hint="Create one — e.g. Support with orders + disputes." />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{r.name}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {r.scopes.length === 0 ? (
                      <span className="text-xs text-neutral-400">no scopes</span>
                    ) : (
                      r.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="font-mono text-[10px]">{s}</Badge>
                      ))
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {r._count?.users ?? 0} user(s) · updated {timeAgo(r.createdAt)}
                  </p>
                </div>
                <RoleDialog role={r} onDone={refresh} />
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
