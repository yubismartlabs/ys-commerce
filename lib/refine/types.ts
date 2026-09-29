export type Vendor = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";
  commissionRate: number;
  createdAt: string;
  owner: { email: string; name: string | null };
  _count: { products: number };
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image: string;
  price: number;
  compareAt: number | null;
  category: string;
  badge: string | null;
  freeShipping: boolean;
  status: "DRAFT" | "ACTIVE" | "TAKEDOWN";
  createdAt: string;
  store: { name: string; slug: string };
  variants?: Array<{ id: string; name: string; sku: string | null; price: number | null; stock: number }>;
};

export type OrderItem = {
  id: string;
  title: string;
  image: string;
  price: number;
  qty: number;
  variant: string | null;
};

export type Order = {
  id: string;
  number: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  disputes?: Dispute[];
};

export type DisputeMessage = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type Dispute = {
  id: string;
  reason: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CLOSED";
  createdAt: string;
  order: { number: string; total: number; status: string };
  buyer: { email: string; name: string | null };
  messages: DisputeMessage[];
};

export type Coupon = {
  id: string;
  code: string;
  pctOff: number;
  active: boolean;
  createdAt: string;
};
