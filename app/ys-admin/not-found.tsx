import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-3 p-7 text-center">
        <p className="font-mono text-5xl font-black text-neutral-200 dark:text-neutral-800">404</p>
        <p className="text-xl font-bold">Page not found</p>
        <p className="text-sm text-neutral-500">This console page doesn&apos;t exist or was moved.</p>
        <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/ys-admin">Back to console</Link>
        </Button>
      </Card>
    </div>
  );
}
