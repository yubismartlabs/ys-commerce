import { Card } from "@/components/ui/card";

const kpis = [
  { label: "Revenue (30d)", value: "$4,280.50" },
  { label: "Orders", value: "312" },
  { label: "Conversion", value: "3.8%" },
  { label: "Rating", value: "4.7 ★" },
];

export default function SellerDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Selling Dashboard (mock)</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-xs text-neutral-500">{k.label}</p>
            <p className="text-xl font-extrabold">{k.value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-6 text-sm text-neutral-500">Sales chart + recent orders table land here. Backend later.</Card>
    </div>
  );
}
