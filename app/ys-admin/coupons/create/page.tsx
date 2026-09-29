"use client";

import { useCreate } from "@refinedev/core";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackLink, PageHeader } from "@/components/refine/ui";
import { CouponForm } from "@/components/coupons/coupon-form";

export default function CouponCreatePage() {
  const { mutate, mutation } = useCreate();
  const router = useRouter();

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/coupons" label="Coupons" />
      <PageHeader title="New coupon" description="Codes are uppercase and immutable after creation." />
      <CouponForm
        defaults={{}}
        isCreate
        saving={mutation.isPending}
        onSubmit={(values) =>
          mutate(
            { resource: "coupons", values },
            {
              onSuccess: (res) => {
                toast.success("Coupon created.");
                const id = (res?.data as { id?: string })?.id;
                router.push(id ? `/ys-admin/coupons/show/${id}` : "/ys-admin/coupons");
              },
              onError: (e) => toast.error((e as { message?: string })?.message ?? "Create failed."),
            }
          )
        }
      />
    </div>
  );
}
