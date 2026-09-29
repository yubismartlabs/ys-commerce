import { NextResponse } from "next/server";
import { serialize } from "@/lib/api/http";
import { suggest } from "@/lib/search/engine";

/** Autocomplete: products + categories + popular past queries (no auth). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const items = await suggest(q).catch(() => []);
  return NextResponse.json(serialize({ data: items }));
}
