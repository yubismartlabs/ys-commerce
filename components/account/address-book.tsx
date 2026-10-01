"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorCard } from "@/components/commerce/query-error";
import {
  AddressFields,
  EMPTY_ADDRESS,
  isAddressComplete,
  toFormValue,
  type AddressFormValue,
} from "@/components/account/address-fields";
import { readData, readEnvelope } from "@/lib/api/client";
import { countryName } from "@/lib/addresses/countries";
import { formatAddressLines } from "@/lib/addresses/schema";

export type Address = {
  id: string;
  label: string | null;
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const KEY = ["account-addresses"];

async function save(id: string | null, value: AddressFormValue) {
  const body = {
    ...value,
    label: value.label || null,
    phone: value.phone || null,
    line2: value.line2 || null,
    region: value.region || null,
  };
  return readData<Address>(
    await fetch(id ? `/api/v1/account/addresses/${id}` : "/api/v1/account/addresses", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

/** The buyer's saved addresses: create, edit, delete, choose a default. */
export function AddressBook() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null | "new">(null);
  const [form, setForm] = useState<AddressFormValue>(EMPTY_ADDRESS);
  const [removing, setRemoving] = useState<string | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const envelope = await readEnvelope<Address[]>(await fetch("/api/v1/account/addresses"));
      return { rows: envelope.data ?? [], max: Number(envelope.meta?.max ?? 10) };
    },
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    // Checkout preselects from the same book; a stale default there would
    // offer a deleted address at the last possible moment.
    qc.invalidateQueries({ queryKey: ["checkout-addresses"] });
  };

  const create = useMutation({
    mutationFn: () => save(null, form),
    onSuccess: () => {
      toast.success("Address saved.");
      setEditing(null);
      setForm(EMPTY_ADDRESS);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save the address."),
  });

  const update = useMutation({
    mutationFn: (id: string) => save(id, form),
    onSuccess: () => {
      toast.success("Address updated.");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update the address."),
  });

  const makeDefault = useMutation({
    mutationFn: async (id: string) =>
      readData<Address>(
        await fetch(`/api/v1/account/addresses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        })
      ),
    onSuccess: () => {
      toast.success("Default address updated.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't set the default."),
  });

  const destroy = useMutation({
    mutationFn: async (id: string) =>
      readData<{ id: string }>(
        await fetch(`/api/v1/account/addresses/${id}`, { method: "DELETE" })
      ),
    onSuccess: () => {
      toast.success("Address deleted.");
      setRemoving(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete the address."),
  });

  const rows = query.data?.rows ?? [];
  const max = query.data?.max ?? 10;
  const busy = create.isPending || update.isPending;

  const startEdit = (a: Address) => {
    setForm(toFormValue(a));
    setEditing(a.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">
          {rows.length === 0
            ? "Save an address once and checkout fills itself in."
            : `${rows.length} of ${max} saved. Checkout preselects your default.`}
        </p>
        {editing === null ? (
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length >= max}
            onClick={() => {
              setForm(EMPTY_ADDRESS);
              setEditing("new");
            }}
          >
            <Plus className="size-4" /> Add address
          </Button>
        ) : null}
      </div>

      {query.isError ? <QueryErrorCard error={query.error} what="addresses" onRetry={() => query.refetch()} /> : null}
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : null}

      {editing !== null ? (
        <Card className="space-y-3 border-neutral-300 p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold">{editing === "new" ? "New address" : "Edit address"}</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel">
              <X className="size-4" />
            </Button>
          </div>
          <AddressFields value={form} onChange={setForm} idPrefix={`addr-${editing}`} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !isAddressComplete(form)}
              onClick={() => (editing === "new" ? create.mutate() : update.mutate(editing))}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing === "new" ? "Save address" : "Save changes"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className="flex h-full flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{a.label || "Address"}</p>
                {a.isDefault ? (
                  <Badge className="gap-1">
                    <Star className="size-3" /> Default
                  </Badge>
                ) : null}
              </div>
              <address className="text-sm not-italic leading-relaxed text-neutral-600">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{a.name}</span>
                <br />
                {formatAddressLines(a).join(", ")}
                <br />
                {countryName(a.country)}
                {a.phone ? (
                  <>
                    <br />
                    {a.phone}
                  </>
                ) : null}
              </address>
              <div className="mt-auto flex flex-wrap gap-1 pt-1">
                {!a.isDefault ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={makeDefault.isPending}
                    onClick={() => makeDefault.mutate(a.id)}
                  >
                    <Star className="size-4" /> Make default
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                {removing === a.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={destroy.isPending}
                      onClick={() => destroy.mutate(a.id)}
                    >
                      {destroy.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(a.id)}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : query.isSuccess && editing === null ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-neutral-500">No saved addresses yet.</p>
        </Card>
      ) : null}
    </div>
  );
}