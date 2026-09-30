// Seed: mirrors lib/mocks/catalog.ts so the admin UI has real rows day one.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const catalog: Array<{
  title: string;
  category: string;
  brand: string;
  price: number;
  compareAt?: number;
  badge?: string;
}> = [
  { title: "Wireless Bluetooth 5.3 Earbuds with Noise Cancellation Charging Case", category: "electronics", brand: "SonicWave", price: 12.49, compareAt: 29.99, badge: "Choice" },
  { title: "Men's Lightweight Running Sneakers Breathable Casual Shoes", category: "fashion", brand: "StrideX", price: 19.99, compareAt: 45.0, badge: "Hot" },
  { title: "LED Strip Lights 10M RGB Music Sync with Remote + App Control", category: "home", brand: "LumiGlow", price: 8.79, compareAt: 19.99, badge: "Sale" },
  { title: "Stainless Steel Electric Lint Remover Rechargeable Fabric Shaver", category: "home", brand: "FabricPro", price: 6.59, compareAt: 13.99 },
  { title: "Women's Summer Floral Maxi Dress Beach Boho Sundress", category: "fashion", brand: "BellaModa", price: 14.29, compareAt: 32.5, badge: "Choice" },
  { title: "4K Action Camera Waterproof Sports Cam with Dual Screen", category: "electronics", brand: "VoltCam", price: 39.99, compareAt: 89.99, badge: "Hot" },
  { title: "Vitamin C Brightening Serum Hyaluronic Acid Facial Skincare 30ml", category: "beauty", brand: "GlowLab", price: 4.99, compareAt: 12.99, badge: "Choice" },
  { title: "Portable Mini Blender USB Rechargeable Fruit Juicer 380ml", category: "home", brand: "NutriMix", price: 11.59, compareAt: 24.99 },
  { title: "Smart Watch Fitness Tracker Heart Rate Blood Oxygen 1.85\" Display", category: "electronics", brand: "PulseFit", price: 16.99, compareAt: 39.99, badge: "Sale" },
  { title: "Building Blocks City Set 1200pcs STEM Educational Toy Gift", category: "toys", brand: "BuildJoy", price: 21.49, compareAt: 42.0 },
  { title: "Car Vacuum Cleaner Portable Wireless Handheld 120W High Power", category: "automotive", brand: "TurboVac", price: 22.99, compareAt: 49.99 },
  { title: "Magnetic Phone Case with Stand for iPhone Samsung Shockproof", category: "phones", brand: "ShieldCase", price: 3.29, compareAt: 9.99, badge: "Choice" },
  { title: "Yoga Mat Non-Slip Exercise Fitness Mat with Carry Strap 6mm", category: "sports", brand: "FlexFlow", price: 13.99, compareAt: 27.99 },
  { title: "Solar Outdoor String Lights 12M Waterproof Garden Decor", category: "home", brand: "SunGlow", price: 9.49, compareAt: 21.99, badge: "Sale" },
  { title: "Mechanical Gaming Keyboard RGB Backlit Wired 87 Keys", category: "electronics", brand: "KeyStrike", price: 24.59, compareAt: 55.0, badge: "Hot" },
  { title: "Waterproof Hiking Backpack 50L Travel Camping Rucksack", category: "sports", brand: "TrailPack", price: 18.79, compareAt: 38.99 },
];

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

  const stores = await prisma.store.findMany();
  for (const [i, item] of catalog.entries()) {
    const store = stores[i % stores.length];
    const slug = `product-${i + 1}`;
    const gallery = [0, 1, 2].map((g) => `https://picsum.photos/seed/ys-product-${i + 1}-${g}/800/800`);
    await prisma.product.upsert({
      where: { slug },
      update: {
        brand: item.brand,
        images: gallery,
        specs: [
          { k: "Brand", v: "YS Choice" },
          { k: "Category", v: item.category },
          { k: "Warranty", v: "12 months" },
          { k: "Ships from", v: "United States" },
        ],
      },
      create: {
        slug,
        title: item.title,
        description: "Mock description seeded for admin development.",
        brand: item.brand,
        image: `https://picsum.photos/seed/ys-product-${i + 1}/600/600`,
        images: gallery,
        specs: [
          { k: "Brand", v: "YS Choice" },
          { k: "Category", v: item.category },
          { k: "Warranty", v: "12 months" },
          { k: "Ships from", v: "United States" },
        ],
        price: item.price,
        compareAt: item.compareAt,
        category: item.category,
        badge: item.badge,
        freeShipping: i % 3 !== 2,
        status: "ACTIVE",
        storeId: store.id,
      },
    });
  }

  // Demo orders spanning vendors + one dispute
  const products = await prisma.product.findMany({ take: 4 });
  for (let n = 1; n <= 3; n++) {
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

  // Sample verified reviews on the demo orders' products + aggregates.
  const { recalcProductRating, recalcStoreRating } = await import("../lib/products/ratings");
  const reviewSamples = [
    { slug: "product-1", rating: 5, title: "Exceeded expectations", body: "Sound quality is great for the price. Shipping took 9 days." },
    { slug: "product-2", rating: 4, title: "Good value", body: "Comfortable and true to size. Slight glue smell at first." },
    { slug: "product-3", rating: 5, title: "Love the app control", body: "Bright colors, easy install behind the TV." },
  ];
  for (const r of reviewSamples) {
    const p = await prisma.product.findUnique({ where: { slug: r.slug } });
    if (!p) continue;
    const exists = await prisma.review.findUnique({
      where: { productId_authorId: { productId: p.id, authorId: buyer.id } },
    });
    if (!exists) {
      await prisma.review.create({
        data: {
          productId: p.id,
          storeId: p.storeId,
          authorId: buyer.id,
          rating: r.rating,
          title: r.title,
          body: r.body,
          verified: true,
          helpful: r.rating === 5 ? 12 : 4,
        },
      });
    }
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

  // Demo flash deals: one live, one scheduled (scheduler owns transitions).
  const now = Date.now();
  const dealSamples = [
    { slug: "product-2", dealPrice: 14.99, startsAt: new Date(now - 86400000), endsAt: new Date(now + 2 * 86400000), stockCap: 50, status: "ACTIVE" as const },
    { slug: "product-6", dealPrice: 29.99, startsAt: new Date(now + 2 * 86400000), endsAt: new Date(now + 5 * 86400000), stockCap: null, status: "SCHEDULED" as const },
  ];
  for (const d of dealSamples) {
    const p = await prisma.product.findUnique({ where: { slug: d.slug } });
    if (!p) continue;
    await prisma.deal.deleteMany({ where: { productId: p.id } });
    await prisma.deal.create({
      data: { productId: p.id, dealPrice: d.dealPrice, startsAt: d.startsAt, endsAt: d.endsAt, stockCap: d.stockCap, status: d.status },
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

  console.log(`Seeded. Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
