import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/selling/dashboard", label: "Dashboard" },
  { href: "/selling/listings", label: "Listings" },
  { href: "/selling/orders", label: "Orders" },
  { href: "/selling/coupons", label: "Coupons" },
  { href: "/selling/questions", label: "Q&A" },
  { href: "/selling/disputes", label: "Disputes" },
  { href: "/selling/returns", label: "Returns" },
  { href: "/selling/messages", label: "Messages" },
  { href: "/selling/payouts", label: "Payouts" },
  { href: "/selling/store", label: "Store settings" },
];

export default function SellingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit p-2">
        <p className="px-2 py-1 text-xs font-bold uppercase text-neutral-400">Selling</p>
        {links.map((l) => (
          <Button key={l.href} variant="ghost" asChild className="w-full justify-start">
            <Link href={l.href}>{l.label}</Link>
          </Button>
        ))}
      </Card>
      <div>{children}</div>
    </div>
  );
}
