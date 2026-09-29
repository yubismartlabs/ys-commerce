import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ali-bg p-4">
      <Card className="w-full max-w-sm space-y-3 p-7 text-center">
        <p className="font-mono text-5xl font-black text-neutral-200">404</p>
        <p className="text-xl font-bold">Page not found</p>
        <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/">Back to shopping</Link>
        </Button>
      </Card>
    </div>
  );
}
