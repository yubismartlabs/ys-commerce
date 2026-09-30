// Seed: mirrors lib/mocks/catalog.ts so the admin UI has real rows day one.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// NOTE: the mock catalog lived here and was removed (full replace). The live
// catalog is the scraped test import — see scripts/import-catalog/README.
// Seed anchors demo orders/disputes/deals to the first ACTIVE products found,
// and skips them with a message when the catalog is empty.

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ys.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
    create: {
      email: adminEmail,
      name: "YS Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@ys.local" },
    update: {},
    create: { email: "buyer@ys.local", name: "Demo Buyer", role: "BUYER", passwordHash: await bcrypt.hash("buyer123", 10) },
  });

  const storeDefs = [
    { name: "TechChoice Store", slug: "techchoice-store", status: "APPROVED" as const, description: "Gadgets, audio and smart home picks — tested before listing.", shippingPolicy: "Ships in 48h with tracking. Free over $25.", returnPolicy: "14-day returns, buyer pays return shipping unless faulty." },
    { name: "FashionForward", slug: "fashionforward", status: "APPROVED" as const, description: "Trend-led fashion essentials, true-to-size guaranteed.", shippingPolicy: "Ships in 24h. Free worldwide over $25.", returnPolicy: "30-day free returns on unworn items." },
    { name: "HomeEssentials", slug: "homeessentials", status: "PENDING" as const, description: "Home and garden staples for everyday living.", shippingPolicy: "Ships in 72h.", returnPolicy: "14-day returns." },
    { name: "GadgetHub", slug: "gadgethub", status: "PENDING" as const, description: "New gadgets weekly — early-bird prices.", shippingPolicy: "Ships in 48h.", returnPolicy: "14-day returns." },
  ];

  const sellers = [];
  for (const [i, s] of storeDefs.entries()) {
    const owner = await prisma.user.upsert({
      where: { email: `seller${i + 1}@ys.local` },
      update: {},
      create: { email: `seller${i + 1}@ys.local`, name: `${s.name} Owner`, role: "SELLER", passwordHash: await bcrypt.hash("seller123", 10) },
    });
    sellers.push(owner);
    await prisma.store.upsert({
      where: { slug: s.slug },
      update: { status: s.status, description: s.description, shippingPolicy: s.shippingPolicy, returnPolicy: s.returnPolicy },
      create: { name: s.name, slug: s.slug, status: s.status, ownerId: owner.id, description: s.description, shippingPolicy: s.shippingPolicy, returnPolicy: s.returnPolicy },
    });
  }

  // Full replace: mock catalog rows are wiped every run; the live catalog is
  // the scraped test import (see scripts/import-catalog). Seeded demo orders,
  // disputes and deals re-anchor to whatever is present. Seeded disputes and
  // YS- demo orders are removed first (dev only). No reviews or Q&A are
  // seeded — fabricated UGC would poison AI evaluation; depth accrues live.
  await prisma.returnRequest.deleteMany({});
  await prisma.dispute.deleteMany({});
  await prisma.order.deleteMany({ where: { number: { startsWith: "YS-" } } });
  await prisma.deal.deleteMany({});
  const wiped = await prisma.product.deleteMany({ where: { source: null } });
  if (wiped.count > 0) console.log(`Removed ${wiped.count} mock product rows.`);

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    take: 4,
  });
  if (products.length === 0) {
    console.log("No ACTIVE products — run the test-catalog importer first (see scripts/import-catalog/README).");
  }

  // Demo orders spanning vendors + one dispute
  for (let n = 1; n <= Math.min(3, products.length); n++) {
    const number = `YS-100${n}`;
    const p = products[n - 1];
    const existing = await prisma.order.findUnique({ where: { number } });
    if (!existing) {
      const order = await prisma.order.create({
        data: {
          number,
          buyerId: buyer.id,
          status: n === 1 ? "PAID" : n === 2 ? "SHIPPED" : "DELIVERED",
          subtotal: p.price,
          shipping: 0,
          total: p.price,
          items: {
            create: {
              productId: p.id,
              storeId: p.storeId,
              title: p.title,
              image: p.image,
              price: p.price,
              qty: n,
            },
          },
        },
      });
      if (n === 3) {
        await prisma.dispute.create({
          data: {
            orderId: order.id,
            buyerId: buyer.id,
            reason: "Item arrived damaged (seeded demo dispute)",
            status: "OPEN",
            messages: { create: { author: "buyer", body: "The box was crushed on arrival." } },
          },
        });
      }
    }
  }

  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: { type: "PERCENT", pctOff: 10, active: true },
    create: { code: "WELCOME10", type: "PERCENT", pctOff: 10 },
  });
  await prisma.coupon.upsert({
    where: { code: "SAVE5" },
    update: {},
    create: { code: "SAVE5", type: "FIXED", amountOff: 5, minSubtotal: 25 },
  });
  await prisma.coupon.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: { code: "FREESHIP", type: "FREESHIP" },
  });

  // Rating aggregates (no seeded reviews — see note above).
  const { recalcProductRating, recalcStoreRating } = await import("../lib/products/ratings");
  for (const p of products) {
    await recalcProductRating(p.id);
  }

  // Store ratings + units sold from seeded orders.
  for (const s of await prisma.store.findMany({ select: { id: true } })) {
    await recalcStoreRating(s.id);
  }
  const soldByProduct = await prisma.orderItem.groupBy({ by: ["productId"], _sum: { qty: true } });
  for (const row of soldByProduct) {
    await prisma.product.update({ where: { id: row.productId }, data: { soldCount: row._sum.qty ?? 0 } });
  }
  const soldByStore = await prisma.orderItem.groupBy({ by: ["storeId"], _sum: { qty: true } });
  for (const row of soldByStore) {
    await prisma.store.update({ where: { id: row.storeId }, data: { soldCount: row._sum.qty ?? 0 } });
  }

  // Example staff roles (assignable in ys-admin → Users → Roles).
  await prisma.staffRole.upsert({
    where: { name: "Support" },
    update: {},
    create: { name: "Support", scopes: ["orders", "disputes", "vendors", "products", "users"] },
  });
  await prisma.staffRole.upsert({
    where: { name: "Finance" },
    update: {},
    create: { name: "Finance", scopes: ["orders", "payouts", "coupons"] },
  });

  // Demo flash deals anchored to live products (scheduler owns transitions).
  // dealPrice is 75% of the listing price so it always reads as a markdown.
  const now = Date.now();
  const dealTargets = products.slice(0, 2);
  for (const [di, p] of dealTargets.entries()) {
    const dealPrice = Math.max(0.99, Math.round(Number(p.price) * 0.75 * 100) / 100);
    await prisma.deal.deleteMany({ where: { productId: p.id } });
    await prisma.deal.create({
      data: {
        productId: p.id,
        dealPrice,
        startsAt: new Date(now - 86400000 + di * 4 * 86400000),
        endsAt: new Date(now + 2 * 86400000 + di * 4 * 86400000),
        stockCap: di === 0 ? 50 : null,
        status: di === 0 ? "ACTIVE" : "SCHEDULED",
      },
    });
  }

  const { defaultSettings, SETTING_GROUPS } = await import("../lib/settings");
  const defaults = defaultSettings();
  for (const group of SETTING_GROUPS) {
    await prisma.setting.upsert({
      where: { key: group },
      update: {},
      create: { key: group, value: defaults[group] as object },
    });
  }

  // Curated mission packs for the assistant's mission-style answers.
  const missions: Array<{
    slug: string;
    title: string;
    description: string;
    triggers: string[];
    slots: Array<{ label: string; note?: string; tag?: string; category?: string; brand?: string; maxPrice?: number }>;
  }> = [
    {
      slug: "offgrid-network",
      title: "Robust off-grid network",
      description: "Stay connected beyond the grid: a connectivity hub to share one uplink across the site, off-grid power to run it, and outdoor-rated essentials to survive the weather.",
      triggers: ["offgrid network", "off grid internet", "off-grid internet", "starlink setup", "remote cabin internet", "rv internet", "cabin wifi", "offgrid setup"],
      slots: [
        { label: "Connectivity hub", note: "Share one uplink across every device on site", tag: "networking" },
        { label: "Off-grid power", note: "Keep the gear running with no mains power", tag: "power" },
        { label: "Outdoor essentials", note: "Weatherproof the setup", tag: "outdoors" },
      ],
    },
    {
      slug: "home-gym-starter",
      title: "Home gym starter",
      description: "Train at home with the essentials: fitness gear for the workout and fuel for recovery.",
      triggers: ["home gym", "workout setup", "home workout", "gym at home"],
      slots: [
        { label: "Training gear", tag: "fitness" },
        { label: "Fuel & recovery", note: "Post-workout nutrition", tag: "smoothies" },
      ],
    },
    {
      slug: "gaming-setup",
      title: "Gaming setup",
      description: "Level up the battlestation: responsive gear, immersive lighting and audio that keeps up.",
      triggers: ["gaming setup", "gaming station", "gaming desk", "streaming setup"],
      slots: [
        { label: "Gear", tag: "gaming" },
        { label: "Audio", tag: "audio" },
      ],
    },
    {
      slug: "indoor-garden",
      title: "Indoor garden",
      description: "Grow inside year-round: light for growth and warmth for mood.",
      triggers: ["indoor garden", "grow plants", "plant setup", "grow lights"],
      slots: [
        { label: "Grow lighting", tag: "home-decor" },
        { label: "Garden glow", tag: "garden" },
      ],
    },
    {
      slug: "gift-under-20",
      title: "Gifts under $20",
      description: "Thoughtful picks that stay under budget.",
      triggers: ["gift ideas", "gift under", "gifts under", "present ideas", "birthday gift"],
      slots: [{ label: "Gift picks", tag: "giftable", maxPrice: 20 }],
    },
    {
      slug: "smoothie-station",
      title: "Smoothie station",
      description: "Blend and fuel: everything for daily smoothies.",
      triggers: ["smoothie", "smoothies", "juice cleanse", "protein shakes"],
      slots: [
        { label: "Blending", tag: "kitchen" },
        { label: "Active fuel", tag: "fitness" },
      ],
    },
  ];
  for (const m of missions) {
    await prisma.mission.upsert({
      where: { slug: m.slug },
      update: { title: m.title, description: m.description, triggers: m.triggers, slots: m.slots as object, active: true },
      create: { slug: m.slug, title: m.title, description: m.description, triggers: m.triggers, slots: m.slots as object },
    });
  }

  console.log(`Seeded. Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
