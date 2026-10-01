import { Suspense } from "react";
import { StaffCardScreen } from "@/areas/staff/StaffCardScreen";
import { StaffCardFallback } from "@/areas/staff/components/card/StaffCardFallback";

// /biz/staff/[staffId] — карточка сотрудника (F-10-024…039, F-10-097/098/119/137, F-00-045/046/048).
export default function Page() {
  return (
    <Suspense fallback={<StaffCardFallback />}>
      <StaffCardScreen />
    </Suspense>
  );
}
