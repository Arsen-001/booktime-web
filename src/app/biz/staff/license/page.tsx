import { Suspense } from "react";
import { LicenseScreen } from "@/areas/staff/LicenseScreen";
import { Skeleton } from "@/ui/Skeleton";

// /biz/staff/license — «Управление лицензией» (F-10-111).
export default function Page() {
  return (
    <Suspense
      fallback={<Skeleton variant="rect" className="h-64 w-full rounded-xl" />}
    >
      <LicenseScreen />
    </Suspense>
  );
}
