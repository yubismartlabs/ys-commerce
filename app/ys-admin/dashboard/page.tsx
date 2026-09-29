import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const rows = [
  { vendor: "TechChoice Store", status: "Pending", products: 42 },
  { vendor: "FashionForward", status: "Approved", products: 128 },
  { vendor: "HomeEssentials", status: "Pending", products: 17 },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["GMV (30d)", "$128,400"],
          ["Vendors", "1,204"],
          ["Orders", "8,312"],
          ["Disputes", "23"],
        ].map(([k, v]) => (
          <Card key={k} className="p-4"><p className="text-xs text-neutral-500">{k}</p><p className="text-xl font-extrabold">{v}</p></Card>
        ))}
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Products</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.vendor}>
                <TableCell>{r.vendor}</TableCell>
                <TableCell>{r.products}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline">Review</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
