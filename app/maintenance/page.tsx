import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSettings } from "@/lib/server-settings";

// Always render live — this page only exists while maintenance mode is on.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return { title: `Maintenance | ${settings.site.siteName}` };
}

export default async function MaintenancePage() {
  const settings = await getSettings();
  if (!settings.maintenance.enabled) redirect("/");

  const { siteName, logoUrl, supportEmail } = settings.site;
  const { message } = settings.maintenance;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ali-bg px-4 py-12">
      <Card className="w-full max-w-md space-y-5 p-8 text-center">
        {logoUrl ? (
          <img src={logoUrl} alt={siteName} className="mx-auto h-10 max-w-44 object-contain" />
        ) : (
          <p className="text-2xl font-black tracking-tight">
            <span className="text-ali-red">ys</span>-commerce
          </p>
        )}
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-400/15">
          <Wrench className="size-7 text-amber-600" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">We&apos;ll be right back</h1>
          <p className="text-sm text-neutral-500">{message}</p>
        </div>
        {supportEmail ? (
          <p className="text-sm text-neutral-500">
            Need help?{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-1 font-medium text-ali-red hover:underline"
            >
              <Mail className="size-3.5" /> {supportEmail}
            </a>
          </p>
        ) : null}
        <div className="flex flex-col gap-2 pt-1">
          <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/">Check again</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/ys-admin/login">Admin sign in</Link>
          </Button>
        </div>
      </Card>
      <p className="mt-6 text-xs text-neutral-400">{siteName} · scheduled maintenance</p>
    </div>
  );
}
