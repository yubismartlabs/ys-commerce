import { db } from "@/lib/db";
import { getActiveDeal } from "@/lib/deals/pricing";
import { toCitation, type AiCitation } from "@/lib/ai/context";

export type MissionSlot = {
  label: string;
  note?: string;
  tag?: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
};

export type MissionGroup = { title: string; note?: string; items: AiCitation[] };

export type MissionPack = {
  mission: { slug: string; title: string; description: string | null };
  reply: string;
  citations: AiCitation[];
  groups: MissionGroup[];
};

function parseSlots(value: unknown): MissionSlot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is MissionSlot => !!s && typeof s === "object" && typeof (s as MissionSlot).label === "string")
    .map((s) => ({
      label: String(s.label).slice(0, 60),
      ...(typeof s.note === "string" ? { note: s.note.slice(0, 160) } : {}),
      ...(typeof s.tag === "string" ? { tag: s.tag.slice(0, 30) } : {}),
      ...(typeof s.category === "string" ? { category: s.category.slice(0, 60) } : {}),
      ...(typeof s.brand === "string" ? { brand: s.brand.slice(0, 40) } : {}),
      ...(typeof s.maxPrice === "number" ? { maxPrice: s.maxPrice } : {}),
    }))
    .slice(0, 6);
}

async function resolveSlot(slot: MissionSlot): Promise<AiCitation[]> {
  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      ...(slot.tag ? { tags: { has: slot.tag.toLowerCase() } } : {}),
      ...(slot.category ? { category: { equals: slot.category, mode: "insensitive" } } : {}),
      ...(slot.brand ? { brand: { equals: slot.brand, mode: "insensitive" } } : {}),
      ...(typeof slot.maxPrice === "number" ? { price: { lte: slot.maxPrice } } : {}),
    },
    orderBy: { soldCount: "desc" },
    select: {
      id: true, slug: true, title: true, price: true, compareAt: true, image: true,
      ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
      freeShipping: true, brand: true, category: true,
      store: { select: { id: true, name: true, slug: true } },
    },
    take: 3,
  });
  const out: AiCitation[] = [];
  for (const p of rows) {
    const deal = await getActiveDeal(p.id);
    out.push(toCitation(p, deal ? Number(deal.dealPrice) : null, p.store));
  }
  return out;
}

/**
 * Mission-style questions ("robust offgrid network") resolve quota-free:
 * trigger match → live picks per slot → packed answer with slot sections.
 * Returns null for ordinary questions (caller falls through to the LLM).
 */
export async function matchMissionPack(userText: string): Promise<MissionPack | null> {
  const text = userText.toLowerCase();
  if (text.length < 8) return null;
  const missions = await db.mission.findMany({ where: { active: true } });
  const hit = missions.find((m) => {
    const triggers = Array.isArray(m.triggers) ? (m.triggers as string[]) : [];
    return triggers.some((t) => {
      const phrase = String(t).toLowerCase().trim();
      if (!phrase) return false;
      if (text.includes(phrase)) return true;
      // Word-overlap fallback for paraphrases ("off grid wifi setup").
      const words = phrase.split(/\s+/).filter((w) => w.length > 3);
      return words.length >= 2 && words.filter((w) => text.includes(w)).length >= 2;
    });
  });
  if (!hit) return null;

  const slots = parseSlots(hit.slots);
  const groups: MissionGroup[] = [];
  const citations: AiCitation[] = [];
  for (const slot of slots) {
    const items = await resolveSlot(slot);
    if (items.length === 0) continue;
    groups.push({ title: slot.label, ...(slot.note ? { note: slot.note } : {}), items });
    for (const c of items) {
      if (citations.length >= 9 || citations.some((x) => x.slug === c.slug)) continue;
      citations.push(c);
    }
  }
  if (groups.length === 0) return null;

  const lines = groups.map(
    (g) => `**${g.title}**: ` + g.items.map((c) => `**${c.title}** (${c.slug})`).join(", ")
  );
  return {
    mission: { slug: hit.slug, title: hit.title, description: hit.description },
    reply:
      `**${hit.title}** — ${hit.description ?? "here's a complete setup, slot by slot."}\n\n` +
      lines.join("\n") +
      `\n\nTap any pick for details, or ask me to compare them.`,
    citations,
    groups,
  };
}
