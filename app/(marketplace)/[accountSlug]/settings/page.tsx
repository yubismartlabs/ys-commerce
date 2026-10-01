import { Card } from "@/components/ui/card";
import { SecurityForm } from "@/components/account/security-form";

export const metadata = { title: "Personal info" };

export default function AccountSettingsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Personal info</h2>
      <Card className="p-6">
        <SecurityForm />
      </Card>
    </div>
  );
}
