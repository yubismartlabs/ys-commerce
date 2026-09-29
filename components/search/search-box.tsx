"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, Search, TrendingUp } from "lucide-react";

export type Suggestion = { type: "product" | "category" | "query"; text: string; meta?: string };

const RECENT_KEY = "ys-recent-searches";

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string): void {
  try {
    const next = [q, ...readRecents().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // private mode
  }
}

/** Header search with live suggestions + recent searches. */
export function SearchBox({ mobile = false, inputClassName = "" }: { mobile?: boolean; inputClassName?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => readRecents());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  const suggestionsQuery = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: async (): Promise<Suggestion[]> => {
      const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(debounced)}`);
      if (!res.ok) throw new Error("suggest");
      return ((await res.json()).data ?? []) as Suggestion[];
    },
    enabled: debounced.length >= 2,
    staleTime: 60_000,
    retry: false,
  });
  const suggestions = suggestionsQuery.data ?? [];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (term: string) => {
    const t = term.trim();
    if (t) pushRecent(t);
    setOpen(false);
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    go(q);
  };

  const hrefFor = (s: Suggestion) =>
    s.type === "category" ? `/search?category=${encodeURIComponent(s.text)}` : `/search?q=${encodeURIComponent(s.text)}`;

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit} className={mobile ? "" : "hidden flex-1 items-center md:flex"}>
        <div className="flex w-full items-stretch overflow-hidden rounded-full border-2 border-ali-red bg-white">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setRecents(readRecents());
              setOpen(true);
            }}
            placeholder="wireless earbuds, summer dress, led lights..."
            className={`h-11 flex-1 bg-transparent px-4 text-sm outline-none ${inputClassName}`}
            aria-label="Search products"
          />
          <button type="submit" className="flex shrink-0 items-center gap-1 bg-ali-red px-6 text-sm font-bold text-white hover:bg-ali-red-dark" aria-label="Search">
            <Search className="size-4" /> {!mobile && <span className="hidden lg:inline">Search</span>}
          </button>
        </div>
      </form>
      {open && (suggestions.length > 0 || recents.length > 0) ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-white shadow-xl">
          {suggestions.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {suggestions.map((s, i) => (
                <li key={`${s.type}-${s.text}-${i}`}>
                  <Link
                    href={hrefFor(s)}
                    onClick={() => {
                      pushRecent(s.text);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-neutral-100"
                  >
                    {s.type === "query" ? (
                      <TrendingUp className="size-3.5 shrink-0 text-neutral-400" />
                    ) : (
                      <Search className="size-3.5 shrink-0 text-neutral-400" />
                    )}
                    <span className="flex-1 truncate">{s.text}</span>
                    {s.type === "category" ? (
                      <span className="shrink-0 text-[11px] text-neutral-400">in Category</span>
                    ) : null}
                    {s.meta ? <span className="shrink-0 text-[11px] text-neutral-400">{s.meta}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {recents.length > 0 ? (
            <div className="border-t px-4 py-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Recent</p>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {recents.map((r) => (
                  <button
                    key={r}
                    onClick={() => go(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs hover:bg-neutral-200"
                  >
                    <Clock className="size-3 text-neutral-400" /> {r}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
