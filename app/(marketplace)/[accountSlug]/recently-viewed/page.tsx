import { Card } from "@/components/ui/card";
import { RecentlyViewedList } from "@/components/account/recently-viewed-list";

export const metadata = { title: "Recently viewed" };

export default function RecentlyViewedPage() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Recently viewed</h2>
        <p className="text-sm text-neutral-500">
          Products you have looked at while signed in, newest first.
        </p>
      </div>
      <Card className="px-6 py-2">
        <RecentlyViewedList />
        <p className="border-t py-2.5 text-[11px] leading-relaxed text-neutral-400">
          This history is visible only to you and is kept per account, so it follows you across devices.
          Use “Clear all” to erase it.
        </p>
      </Card>
    </div>
  );
}