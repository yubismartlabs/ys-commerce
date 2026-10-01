import { Card } from "@/components/ui/card";
import { AddressBook } from "@/components/account/address-book";

export const metadata = { title: "Addresses" };

export default function AccountAddressesPage() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Addresses</h2>
        <p className="text-sm text-neutral-500">
          Where your orders ship. You pick one at checkout; we keep it on the order as a record of where the
          parcel went.
        </p>
      </div>
      <Card className="p-6">
        <AddressBook />
      </Card>
    </div>
  );
}