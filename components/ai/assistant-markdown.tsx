"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const SLUG_RE = /([a-z0-9]+(?:-[a-z0-9]+)*-\d+)/gi;
const BULLET_RE = /^\s*[-*•]\s+/;
const ORDERED_RE = /^\s*\d+[.)]\s+/;

/** Inline **bold** + (slug) product links. Built as React nodes — no raw HTML. */
function inline(text: string, titles: Map<string, string>, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Split keeping **bold** segments.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part, pi) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push(<strong key={`${keyPrefix}-b${pi}`}>{inlinePlain(part.slice(2, -2), titles, `${keyPrefix}-b${pi}`)}</strong>);
    } else {
      out.push(...inlinePlain(part, titles, `${keyPrefix}-t${pi}`));
    }
  });
  return out;
}

function inlinePlain(text: string, titles: Map<string, string>, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SLUG_RE.lastIndex = 0;
  let k = 0;
  while ((m = SLUG_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const slug = m[1].toLowerCase();
    out.push(
      <Link
        key={`${keyPrefix}-s${k++}`}
        href={`/product/${slug}`}
        className="font-semibold text-ali-red underline decoration-ali-red/30 underline-offset-2 hover:decoration-ali-red"
      >
        {titles.get(slug) ?? slug}
      </Link>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "bullets"; items: string[] }
  | { kind: "ordered"; items: string[] }
  | { kind: "para"; text: string };

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];
  const flush = () => {
    if (bullets.length > 0) blocks.push({ kind: "bullets", items: bullets });
    if (ordered.length > 0) blocks.push({ kind: "ordered", items: ordered });
    bullets = [];
    ordered = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (BULLET_RE.test(line)) bullets.push(line.replace(BULLET_RE, ""));
    else if (ORDERED_RE.test(line)) ordered.push(line.replace(ORDERED_RE, ""));
    else {
      flush();
      blocks.push({ kind: "para", text: line });
    }
  }
  flush();
  return blocks;
}

/**
 * Markdown-lite for assistant replies: paragraphs, **bold**, bullet and
 * numbered lists, and (product-slug) references linked to product pages.
 */
export function AssistantText({
  text,
  titles,
}: {
  text: string;
  titles: Map<string, string>;
}) {
  const blocks = blocksOf(text);
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (b.kind === "bullets") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((t, j) => (
                <li key={j}>{inline(t, titles, `b${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ordered") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((t, j) => (
                <li key={j}>{inline(t, titles, `o${i}-${j}`)}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{inline(b.text, titles, `p${i}`)}</p>;
      })}
    </div>
  );
}

/** Pull a trailing "Verdict: ..." line out of a compare answer for the table. */
export function splitVerdict(text: string): { body: string; verdict?: string } {
  const m = text.match(/(?:^|\n)\s*verdict\s*:\s*(.+?)\s*$/i);
  if (!m) return { body: text };
  return { body: text.slice(0, m.index).trim(), verdict: m[1].trim() };
}

const COMPARE_RE = /\bvs\b|versus|compar|difference|which (one|should|is better)|better (pick|choice|deal|buy)/i;

/** Should this answer render as a side-by-side comparison? */
export function isCompareAnswer(userText: string, citationCount: number): boolean {
  return citationCount >= 2 && COMPARE_RE.test(userText);
}
