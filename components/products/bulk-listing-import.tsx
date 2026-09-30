"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type RowError = { line: number; field: string; message: string };
type BulkResult = {
  createdCount: number;
  rejectedCount: number;
  total: number;
  created: Array<{ slug: string; title: string }>;
  errors: RowError[];
  failed: Array<{ line: number; title: string; reason: string }>;
};
type Preview = {
  total: number;
  importable: number;
  errors: RowError[];
  preview: Array<{ line: number; title: string; slug: string; slugTaken: boolean }>;
  hasClashes: boolean;
};

/**
 * Bulk listing importer.
 *
 * Dry-run preview first, so a seller sees exactly which lines will be
 * rejected before anything is written to their catalogue.
 */
export function BulkListingImport({ stores }: { stores: Array<{ id: string; name: string }> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [publish, setPublish] = useState(false);

  const preview = useMutation({
    mutationFn: async () => readData<Preview>(await putJson({ csv })),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't read that file."),
  });

  const run = useMutation({
    mutationFn: async () => readData<BulkResult>(await postJson({ csv, storeId, publish })),
    onSuccess: (r) => {
      toast.success(`Imported ${r.createdCount} product${r.createdCount === 1 ? "" : "s"}.`);
      setCsv("");
      preview.reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed."),
  });

  const onFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("That file is larger than 2MB.");
      return;
    }
    const text = await file.text();
    setCsv(text);
    preview.reset();
  };

  const canRun = csv.trim().length > 0 && !!storeId && !run.isPending;
  const busy = preview.isPending || run.isPending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Bulk listings</h1>
          <p className="text-sm text-neutral-500">
            Import many products at once. Start from the template so the columns line up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/v1/selling/products/bulk/template" download>
              <Download className="size-4" /> Template
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="size-4" /> Choose CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Upload a CSV file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="bulk-store" className="text-sm font-medium">Import into</label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger id="bulk-store">
                <SelectValue placeholder="Pick a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="bulk-publish" className="text-sm font-medium">Publish state</label>
            <Select value={publish ? "live" : "draft"} onValueChange={(v) => setPublish(v === "live")}>
              <SelectTrigger id="bulk-publish">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Save as drafts (review first)</SelectItem>
                <SelectItem value="live">Publish immediately</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="bulk-csv" className="text-sm font-medium">CSV data</label>
          <Textarea
            id="bulk-csv"
            value={csv}
            onChange={(e) => { setCsv(e.target.value); preview.reset(); }}
            rows={8}
            placeholder={"title,price,category,stock,image\nWireless Earbuds,24.99,electronics,50,https://…"}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => preview.mutate()} disabled={!csv.trim() || busy}>
            {preview.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Check file
          </Button>
          <Button size="sm" onClick={() => run.mutate()} disabled={!canRun} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import
          </Button>
          {preview.data ? (
            <span className="self-center text-xs text-neutral-500">
              {preview.data.importable} of {preview.data.total} rows ready
            </span>
          ) : null}
        </div>
      </Card>

      {preview.data ? <PreviewReport data={preview.data} /> : null}
      {run.data ? <ImportReport data={run.data} /> : null}
    </div>
  );
}

function PreviewReport({ data }: { data: Preview }) {
  return (
    <Card className="space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        {data.errors.length > 0 ? (
          <><AlertTriangle className="size-4 text-amber-600" /> {data.errors.length} problem{data.errors.length === 1 ? "" : "s"} to fix</>
        ) : (
          <><CheckCircle2 className="size-4 text-emerald-600" /> All rows look good</>
        )}
      </p>
      <ErrorList errors={data.errors} />
      {data.preview.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-neutral-500">
                <th className="py-1 pr-3">Line</th>
                <th className="py-1 pr-3">Title</th>
                <th className="py-1">URL slug</th>
              </tr>
            </thead>
            <tbody>
              {data.preview.map((p) => (
                <tr key={p.line} className="border-b last:border-0">
                  <td className="py-1 pr-3 tabular-nums text-neutral-500">{p.line}</td>
                  <td className="py-1 pr-3">{p.title}</td>
                  <td className="py-1 font-mono">
                    /product/{p.slug}
                    {p.slugTaken ? <Badge variant="secondary" className="ml-2 text-[10px]">EXISTS — will get a suffix</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {data.preview.length === 50 && data.total > 50 ? (
        <p className="text-[11px] text-neutral-400">Showing the first 50 rows.</p>
      ) : null}
    </Card>
  );
}

function ImportReport({ data }: { data: BulkResult }) {
  return (
    <Card className="space-y-2 p-4">
      <p className="text-sm font-bold">
        Imported {data.createdCount} of {data.total} rows
        {data.rejectedCount > 0 ? ` · ${data.rejectedCount} skipped` : ""}
      </p>
      <ErrorList errors={data.errors} />
      {data.failed.length > 0 ? (
        <>
          <p className="text-xs font-semibold text-red-600">Rows the database rejected</p>
          <ul className="space-y-0.5 text-xs text-neutral-600">
            {data.failed.slice(0, 20).map((f, i) => (
              <li key={i}>Line {f.line} — {f.title}: {f.reason}</li>
            ))}
          </ul>
        </>
      ) : null}
      {data.created.length > 0 ? (
        <ul className="space-y-0.5 text-xs">
          {data.created.slice(0, 20).map((c) => (
            <li key={c.slug}>
              <Link href={`/product/${c.slug}`} className="underline">{c.title}</Link>
            </li>
          ))}
          {data.created.length > 20 ? <li className="text-neutral-400">and {data.created.length - 20} more</li> : null}
        </ul>
      ) : null}
    </Card>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  const grouped = useMemo(() => {
    const byLine = new Map<number, RowError[]>();
    for (const e of errors) byLine.set(e.line, [...(byLine.get(e.line) ?? []), e]);
    return [...byLine.entries()].sort((a, b) => a[0] - b[0]);
  }, [errors]);

  if (grouped.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs">
      {grouped.slice(0, 25).map(([line, errs]) => (
        <li key={line} className={cn("rounded px-2 py-1", "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300")}>
          <span className="font-semibold">Line {line}:</span>{" "}
          {errs.map((e) => `${e.field} — ${e.message}`).join("; ")}
        </li>
      ))}
      {grouped.length > 25 ? <li className="text-neutral-400">and {grouped.length - 25} more lines…</li> : null}
    </ul>
  );
}

async function postJson(body: unknown): Promise<Response> {
  return fetch("/api/v1/selling/products/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function putJson(body: unknown): Promise<Response> {
  return fetch("/api/v1/selling/products/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
