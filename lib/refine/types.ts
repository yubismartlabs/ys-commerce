export type Vendor = {
  id: string;
  name: string;
  slug: string;
  username: string | null;
  usernameChangeCount: number;
  description: string | null;
  logo: string | null;
  banner: string | null;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  announcement: string | null;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";
  commissionRate: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  followerCount: number;
  createdAt: string;
  owner: { id?: string; email: string; name: string | null };
  _count: { products: number };
  analytics?: { orders: number; revenue: number; escrow: Partial<Record<string, number>> };
};

export type ProductVariant = { id: string; name: string; sku: string | null; price: number | null; image: string | null; stock: number };

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image: string;
  images: string[];
  specs: Array<{ k: string; v: string }> | null;
  price: number;
  compareAt: number | null;
  category: string;
  badge: string | null;
  freeShipping: boolean;
  status: "DRAFT" | "ACTIVE" | "TAKEDOWN";
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  createdAt: string;
  store: { id?: string; name: string; slug: string };
  variants?: ProductVariant[];
  _count?: { reviews: number };
};

export type OrderItem = {
  id: string;
  title: string;
  image: string;
  price: number;
  qty: number;
  variant: string | null;
  productId?: string;
  storeId?: string;
  shipmentId?: string | null;
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
  // Tracking lives on the parcel, not the order: a multi-seller basket is N
  // separate shipments.
  shipments?: ShipmentView[];
  protectionUntil: string | null;
  createdAt: string;
  items: OrderItem[];
  disputes?: Dispute[];
  returns?: ReturnView[];
  events?: OrderEvent[];
  buyer?: { id: string; email: string; name: string | null };
  stores?: Array<{ id: string; name: string; slug: string }>;
};

export type ShipmentStatus = "PENDING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export type ShipmentView = {
  id: string;
  orderId: string;
  storeId: string;
  status: ShipmentStatus;
  shippingCost: number;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  store?: { id: string; name: string; slug: string };
  _count?: { items: number };
  items?: Array<{ id: string; title: string; qty: number }>;
};

export type ReturnStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "RECEIVED"
  | "REFUNDED"
  | "REJECTED"
  | "CANCELLED";

export type ReturnView = {
  id: string;
  orderId: string;
  storeId: string;
  status: ReturnStatus;
  reason: string;
  note: string | null;
  items: Array<{ orderItemId: string; title: string; qty: number; price: number }>;
  refundAmount: number | null;
  sellerNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  store?: { id: string; name: string; slug: string };
  order?: { number: string };
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
  buyerId: string;
  order: { id?: string; number: string; total: number; status: string };
  buyer: { email: string; name: string | null };
  messages: DisputeMessage[];
  holds?: EscrowHoldView[];
  chats?: Array<{
    id: string;
    type: string;
    subject: string | null;
    messages: Array<{ senderId: string; text: string; imageUrl: string | null; flagged: boolean; createdAt: string }>;
  }>;
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

export type StaffRole = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  _count?: { users: number };
  users?: Array<{ id: string; name: string | null; email: string }>;
};

export type AdminUser = {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  role: "BUYER" | "ADMIN";
  scopes: string[];
  staffRole: { id: string; name: string } | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  createdAt: string;
  orderCount: number;
  _count: { stores: number; disputes: number };
};

export type AdminUserDetail = AdminUser & {
  emailVerified: string | null;
  staffRole: { id: string; name: string; scopes: string[] } | null;
  orderTotal: number;
  redemptions: number;
  stores: Array<{ id: string; name: string; slug: string; status: string }>;
  auditRecent: Array<{ id: string; action: string; entity: string; entityId: string; createdAt: string }>;
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
