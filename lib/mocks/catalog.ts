export type Product = {
  slug: string;
  title: string;
  image: string;
  price: number;
  compareAt?: number;
  rating: number;
  reviews: number;
  sold: number;
  store: string;
  storeSlug: string;
  badge?: "Choice" | "Hot" | "Sale" | "New";
  freeShipping: boolean;
  category: string;
  colors?: string[];
};

export type Category = {
  slug: string;
  label: string;
  image: string;
};

export const categories: Category[] = [
  { slug: "electronics", label: "Electronics", image: "https://picsum.photos/seed/cat-electronics/200/200" },
  { slug: "fashion", label: "Fashion", image: "https://picsum.photos/seed/cat-fashion/200/200" },
  { slug: "home", label: "Home & Garden", image: "https://picsum.photos/seed/cat-home/200/200" },
  { slug: "beauty", label: "Beauty", image: "https://picsum.photos/seed/cat-beauty/200/200" },
  { slug: "sports", label: "Sports", image: "https://picsum.photos/seed/cat-sports/200/200" },
  { slug: "toys", label: "Toys & Kids", image: "https://picsum.photos/seed/cat-toys/200/200" },
  { slug: "automotive", label: "Automotive", image: "https://picsum.photos/seed/cat-auto/200/200" },
  { slug: "phones", label: "Phones", image: "https://picsum.photos/seed/cat-phones/200/200" },
];

const titles: Array<Pick<Product, "title" | "category" | "price" | "compareAt" | "rating" | "reviews" | "sold" | "badge">> = [
  { title: "Wireless Bluetooth 5.3 Earbuds with Noise Cancellation Charging Case", category: "electronics", price: 12.49, compareAt: 29.99, rating: 4.7, reviews: 23104, sold: 50000, badge: "Choice" },
  { title: "Men's Lightweight Running Sneakers Breathable Casual Shoes", category: "fashion", price: 19.99, compareAt: 45.0, rating: 4.6, reviews: 8931, sold: 21000, badge: "Hot" },
  { title: "LED Strip Lights 10M RGB Music Sync with Remote + App Control", category: "home", price: 8.79, compareAt: 19.99, rating: 4.5, reviews: 15230, sold: 34000, badge: "Sale" },
  { title: "Stainless Steel Electric Lint Remover Rechargeable Fabric Shaver", category: "home", price: 6.59, compareAt: 13.99, rating: 4.4, reviews: 4210, sold: 9800 },
  { title: "Women's Summer Floral Maxi Dress Beach Boho Sundress", category: "fashion", price: 14.29, compareAt: 32.5, rating: 4.6, reviews: 6712, sold: 12500, badge: "Choice" },
  { title: "4K Action Camera Waterproof Sports Cam with Dual Screen", category: "electronics", price: 39.99, compareAt: 89.99, rating: 4.5, reviews: 3120, sold: 7400, badge: "Hot" },
  { title: "Vitamin C Brightening Serum Hyaluronic Acid Facial Skincare 30ml", category: "beauty", price: 4.99, compareAt: 12.99, rating: 4.7, reviews: 18930, sold: 42000, badge: "Choice" },
  { title: "Portable Mini Blender USB Rechargeable Fruit Juicer 380ml", category: "home", price: 11.59, compareAt: 24.99, rating: 4.3, reviews: 5210, sold: 15600 },
  { title: "Smart Watch Fitness Tracker Heart Rate Blood Oxygen 1.85\" Display", category: "electronics", price: 16.99, compareAt: 39.99, rating: 4.6, reviews: 12480, sold: 28000, badge: "Sale" },
  { title: "Building Blocks City Set 1200pcs STEM Educational Toy Gift", category: "toys", price: 21.49, compareAt: 42.0, rating: 4.8, reviews: 3420, sold: 8900 },
  { title: "Car Vacuum Cleaner Portable Wireless Handheld 120W High Power", category: "automotive", price: 22.99, compareAt: 49.99, rating: 4.4, reviews: 2870, sold: 6700 },
  { title: "Magnetic Phone Case with Stand for iPhone Samsung Shockproof", category: "phones", price: 3.29, compareAt: 9.99, rating: 4.5, reviews: 31240, sold: 80000, badge: "Choice" },
  { title: "Yoga Mat Non-Slip Exercise Fitness Mat with Carry Strap 6mm", category: "sports", price: 13.99, compareAt: 27.99, rating: 4.6, reviews: 4980, sold: 11200 },
  { title: "Solar Outdoor String Lights 12M Waterproof Garden Decor", category: "home", price: 9.49, compareAt: 21.99, rating: 4.5, reviews: 7640, sold: 19800, badge: "Sale" },
  { title: "Mechanical Gaming Keyboard RGB Backlit Wired 87 Keys", category: "electronics", price: 24.59, compareAt: 55.0, rating: 4.7, reviews: 6130, sold: 13400, badge: "Hot" },
  { title: "Waterproof Hiking Backpack 50L Travel Camping Rucksack", category: "sports", price: 18.79, compareAt: 38.99, rating: 4.6, reviews: 3890, sold: 9200 },
];

const stores = [
  { name: "TechChoice Store", slug: "techchoice-store" },
  { name: "FashionForward", slug: "fashionforward" },
  { name: "HomeEssentials", slug: "homeessentials" },
  { name: "GadgetHub", slug: "gadgethub" },
];

export const products: Product[] = titles.map((t, i) => ({
  slug: `product-${i + 1}`,
  title: t.title,
  image: `https://picsum.photos/seed/ys-product-${i + 1}/600/600`,
  price: t.price,
  compareAt: t.compareAt,
  rating: t.rating,
  reviews: t.reviews,
  sold: t.sold,
  store: stores[i % stores.length].name,
  storeSlug: stores[i % stores.length].slug,
  badge: t.badge,
  freeShipping: i % 3 !== 2,
  category: t.category,
  colors: ["#191919", "#e62e1b", "#2563eb", "#f5f5f5"],
}));

// TODO(API): replace with REST/GraphQL calls to custom backend
export async function getProducts(query?: { category?: string; search?: string }): Promise<Product[]> {
  let list = products;
  if (query?.category) list = list.filter((p) => p.category === query.category);
  if (query?.search) {
    const q = query.search.toLowerCase();
    list = list.filter((p) => p.title.toLowerCase().includes(q));
  }
  return list;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return products.find((p) => p.slug === slug);
}
