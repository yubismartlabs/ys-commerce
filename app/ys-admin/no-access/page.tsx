import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm space-y-4 p-7 text-center">
        <ShieldAlert className="mx-auto size-10 text-amber-500" />
        <h1 className="text-xl font-bold">No access to this area</h1>
        <p className="text-sm text-neutral-500">
          Your staff role doesn&apos;t include this section. Ask an admin to extend your scopes.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline"><Link href="/ys-admin">Console home</Link></Button>
          <Button asChild variant="ghost"><Link href="/">Marketplace</Link></Button>
        </div>
      </Card>
    </div>
  );
}
