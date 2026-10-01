import { Suspense } from "react";
import { PositionsScreen } from "@/areas/staff/PositionsScreen";
import { Skeleton } from "@/ui/Skeleton";

// /biz/staff/positions — каталог должностей (F-10-015).
export default function Page() {
  return (
    <Suspense
      fallback={<Skeleton variant="rect" className="h-64 w-full rounded-xl" />}
    >
      <PositionsScreen />
    </Suspense>
  );
}
