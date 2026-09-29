import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { products } from "@/lib/mocks/catalog";
import { formatUSD } from "@/lib/format";

export default function ListingsPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Listings</h1>
        <Button className="bg-ali-red text-white hover:bg-ali-red-dark">Add product</Button>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {products.slice(0, 6).map((p) => (
              <TableRow key={p.slug}>
                <TableCell className="max-w-64 truncate">{p.title}</TableCell>
                <TableCell>{formatUSD(p.price)}</TableCell>
                <TableCell>128</TableCell>
                <TableCell>Active</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
