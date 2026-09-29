// Seed: mirrors lib/mocks/catalog.ts so the admin UI has real rows day one.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const catalog: Array<{
  title: string;
  category: string;
  price: number;
  compareAt?: number;
  badge?: string;
}> = [
  { title: "Wireless Bluetooth 5.3 Earbuds with Noise Cancellation Charging Case", category: "electronics", price: 12.49, compareAt: 29.99, badge: "Choice" },
  { title: "Men's Lightweight Running Sneakers Breathable Casual Shoes", category: "fashion", price: 19.99, compareAt: 45.0, badge: "Hot" },
  { title: "LED Strip Lights 10M RGB Music Sync with Remote + App Control", category: "home", price: 8.79, compareAt: 19.99, badge: "Sale" },
  { title: "Stainless Steel Electric Lint Remover Rechargeable Fabric Shaver", category: "home", price: 6.59, compareAt: 13.99 },
  { title: "Women's Summer Floral Maxi Dress Beach Boho Sundress", category: "fashion", price: 14.29, compareAt: 32.5, badge: "Choice" },
  { title: "4K Action Camera Waterproof Sports Cam with Dual Screen", category: "electronics", price: 39.99, compareAt: 89.99, badge: "Hot" },
  { title: "Vitamin C Brightening Serum Hyaluronic Acid Facial Skincare 30ml", category: "beauty", price: 4.99, compareAt: 12.99, badge: "Choice" },
  { title: "Portable Mini Blender USB Rechargeable Fruit Juicer 380ml", category: "home", price: 11.59, compareAt: 24.99 },
  { title: "Smart Watch Fitness Tracker Heart Rate Blood Oxygen 1.85\" Display", category: "electronics", price: 16.99, compareAt: 39.99, badge: "Sale" },
  { title: "Building Blocks City Set 1200pcs STEM Educational Toy Gift", category: "toys", price: 21.49, compareAt: 42.0 },
  { title: "Car Vacuum Cleaner Portable Wireless Handheld 120W High Power", category: "automotive", price: 22.99, compareAt: 49.99 },
  { title: "Magnetic Phone Case with Stand for iPhone Samsung Shockproof", category: "phones", price: 3.29, compareAt: 9.99, badge: "Choice" },
  { title: "Yoga Mat Non-Slip Exercise Fitness Mat with Carry Strap 6mm", category: "sports", price: 13.99, compareAt: 27.99 },
  { title: "Solar Outdoor String Lights 12M Waterproof Garden Decor", category: "home", price: 9.49, compareAt: 21.99, badge: "Sale" },
  { title: "Mechanical Gaming Keyboard RGB Backlit Wired 87 Keys", category: "electronics", price: 24.59, compareAt: 55.0, badge: "Hot" },
  { title: "Waterproof Hiking Backpack 50L Travel Camping Rucksack", category: "sports", price: 18.79, compareAt: 38.99 },
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
    { name: "TechChoice Store", slug: "techchoice-store", status: "APPROVED" as const },
    { name: "FashionForward", slug: "fashionforward", status: "APPROVED" as const },
    { name: "HomeEssentials", slug: "homeessentials", status: "PENDING" as const },
    { name: "GadgetHub", slug: "gadgethub", status: "PENDING" as const },
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
      update: { status: s.status },
      create: { name: s.name, slug: s.slug, status: s.status, ownerId: owner.id },
    });
  }

  const stores = await prisma.store.findMany();
  for (const [i, item] of catalog.entries()) {
    const store = stores[i % stores.length];
    const slug = `product-${i + 1}`;
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: item.title,
        description: "Mock description seeded for admin development.",
        image: `https://picsum.photos/seed/ys-product-${i + 1}/600/600`,
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
