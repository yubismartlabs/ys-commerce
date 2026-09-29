import Link from "next/link";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/ys-admin/dashboard", label: "Dashboard" },
  { href: "/ys-admin/vendors", label: "Vendors" },
  { href: "/ys-admin/products", label: "Products" },
  { href: "/ys-admin/orders", label: "Orders" },
  { href: "/ys-admin/disputes", label: "Disputes" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-100">
      <aside className="hidden w-60 shrink-0 flex-col bg-neutral-950 p-4 text-white md:flex">
        <Link href="/ys-admin/dashboard" className="mb-6 text-xl font-black">
          <span className="text-ali-red">ys</span>-admin
        </Link>
        <div className="grid gap-1">
          {links.map((l) => (
            <Button key={l.href} variant="ghost" asChild className="justify-start text-white/80 hover:text-white">
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </div>
        <Link href="/" className="mt-auto text-xs text-white/50">← Back to marketplace</Link>
      </aside>
      <div className="flex-1">
        <div className="border-b bg-white px-6 py-3 text-sm font-semibold">ys-admin · isolated dashboard (UI mock)</div>
        <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
