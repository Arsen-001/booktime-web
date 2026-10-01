import { Suspense } from "react";
import { RolesScreen } from "@/areas/staff/RolesScreen";
import { Skeleton } from "@/ui/Skeleton";

// /biz/staff/roles — «Роли и права» (С19): роли, кто на них и права роли разом.
export default function Page() {
  return (
    <Suspense fallback={<Skeleton variant="rect" className="h-64 w-full rounded-xl" />}>
      <RolesScreen />
    </Suspense>
  );
}
