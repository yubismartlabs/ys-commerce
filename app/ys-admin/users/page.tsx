"use client";

import Link from "next/link";
import { useState } from "react";
import { useTable } from "@refinedev/core";
import { ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader, Pager, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/lib/refine/types";

const roles = ["BUYER", "ADMIN"] as const;

function roleClass(r: string): string {
  if (r === "ADMIN") return "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-400";
  return "bg-neutral-500/10 text-neutral-600 ring-neutral-500/20 dark:text-neutral-400";
}

export default function UsersPage() {
  const [role, setRole] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const { tableQuery, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<AdminUser>({
      resource: "users",
      pagination: { pageSize: 20, mode: "server" },
      syncWithLocation: true,
    });

  const rows = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total;
  const loadError =
    tableQuery.error instanceof Error
      ? tableQuery.error.message
      : (tableQuery.error as { message?: unknown } | null | undefined)?.message;

  const apply = (r = role, s = status, query = q) => {
    const next: Array<{ field: string; operator: "eq"; value: string }> = [];
    if (r !== undefined) next.push({ field: "role", operator: "eq", value: r });
    if (s !== undefined) next.push({ field: "status", operator: "eq", value: s });
    if (query.trim()) next.push({ field: "q", operator: "eq", value: query.trim() });
    setFilters(next);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Every account — roles, suspension, orders and stores at a glance."
        actions={
          <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/ys-admin/users/create"><Plus className="size-4" /> New user</Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {roles.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={role === r ? "default" : "outline"}
            className="rounded-full"
            onClick={() => { const v = role === r ? undefined : r; setRole(v); apply(v, status, q); }}
          >
            {r}
          </Button>
        ))}
        <span className="mx-1 text-neutral-300">|</span>
        {(["ACTIVE", "SUSPENDED"] as const).map((s) => {
          const v = s.toLowerCase();
          return (
            <Button
              key={s}
              size="sm"
              variant={status === v ? "default" : "outline"}
              className="rounded-full"
              onClick={() => { const nv = status === v ? undefined : v; setStatus(nv); apply(role, nv, q); }}
            >
              {s}
            </Button>
          );
        })}
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => { e.preventDefault(); apply(role, status, q); }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, @username or email…" className="w-52" />
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </div>
      <Card className="overflow-hidden p-0">
        {tableQuery.isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : tableQuery.isError ? (
          <ErrorState
            message={
              typeof loadError === "string" && loadError
                ? `Failed to load users: ${loadError}`
                : "Failed to load users."
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No users found" hint="Try different filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Orders</TableHead><TableHead>Stores</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell>
                    <p className="font-medium">{u.name ?? "—"}{u.username ? <span className="ml-1.5 font-mono text-xs font-semibold text-ali-red">@{u.username}</span> : null}</p>
                    <p className="text-xs text-neutral-500">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-full font-semibold ring-1 ring-inset", roleClass(u.role))}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.suspendedAt ? (
                      <Badge variant="outline" className="rounded-full bg-red-500/10 font-semibold text-red-700 ring-1 ring-inset ring-red-500/25 dark:text-red-400">
                        SUSPENDED
                      </Badge>
                    ) : (
                      <span className="text-xs text-neutral-400">Active</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{u.orderCount}</TableCell>
                  <TableCell className="tabular-nums">{u._count.stores}</TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(u.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/ys-admin/users/show/${u.id}`}>Open <ChevronRight className="size-3.5" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pager page={currentPage} pageCount={pageCount} total={total} onPage={setCurrentPage} />
    </div>
  );
}
