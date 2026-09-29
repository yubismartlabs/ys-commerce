import { RefineProvider } from "@/components/refine/refine-provider";
import { AdminShell } from "@/components/refine/admin-shell";

// Authenticated console: always render dynamically, never prerender.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RefineProvider>
      <AdminShell>{children}</AdminShell>
    </RefineProvider>
  );
}
