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

export type OrderEvent = {
  id: string;
  type: "CREATED" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "NOTE";
  message: string | null;
  createdAt: string;
};

export type Order = {
  id: string;
  number: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  subtotal: number;
  shipping: number;
  discount: number | null;
  couponCode: string | null;
  total: number;
  currency: string;
  shipName: string | null;
  shipPhone: string | null;
  shipStreet: string | null;
  shipCity: string | null;
  shipZip: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  protectionUntil: string | null;
  createdAt: string;
  items: OrderItem[];
  disputes?: Dispute[];
  events?: OrderEvent[];
  buyer?: { id: string; email: string; name: string | null };
};

export type DisputeMessage = {
  id: string;
  author: string;
  authorId: string | null;
  body: string;
  createdAt: string;
};

export type EscrowHoldView = {
  id: string;
  storeId: string;
  gross: number;
  commission: number;
  net: number;
  status: "HELD" | "FROZEN" | "RELEASED" | "REFUNDED";
};

export type Dispute = {
  id: string;
  reason: string;
  category: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CLOSED";
  resolvedAt: string | null;
  createdAt: string;
  order: { id?: string; number: string; total: number; status: string };
  buyer: { email: string; name: string | null };
  messages: DisputeMessage[];
  holds?: EscrowHoldView[];
};

export type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREESHIP";
  pctOff: number | null;
  amountOff: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  categories: string[];
  storeIds: string[];
  createdAt: string;
  _count?: { redemptions: number };
  redemptions?: Array<{ id: string; userId: string; orderId: string | null; amount: number; createdAt: string }>;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type EmailLogItem = {
  id: string;
  to: string;
  template: string;
  subject: string;
  status: "SENT" | "SKIPPED" | "FAILED";
  resendId: string | null;
  error: string | null;
  createdAt: string;
};
