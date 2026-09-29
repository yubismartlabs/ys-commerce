import { Card } from "@/components/ui/card";

export default function Page({ params }: { params?: Promise<unknown> }) {
  void params;
  return <Card className="p-6 text-sm text-neutral-500">Mock table. Full seller orders UI next iteration.</Card>;
}
