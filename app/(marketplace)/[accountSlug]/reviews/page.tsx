import { Card } from "@/components/ui/card";
import { AccountReviewsTab } from "@/components/products/account-reviews";

export const metadata = { title: "My reviews" };

export default function AccountReviewsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">My reviews</h2>
      <Card className="p-6">
        <AccountReviewsTab />
      </Card>
    </div>
  );
}
