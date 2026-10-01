import { Suspense } from "react";
import { StaffListScreen } from "@/areas/staff/StaffListScreen";
import { Skeleton } from "@/ui/Skeleton";

// /biz/staff — список сотрудников (F-10-001…018, F-10-022, F-10-023, F-10-110, F-10-112, F-10-113, F-10-132).
export default function Page() {
  return (
    <Suspense
      fallback={<Skeleton variant="rect" className="h-96 w-full rounded-xl" />}
    >
      <StaffListScreen />
    </Suspense>
  );
}
