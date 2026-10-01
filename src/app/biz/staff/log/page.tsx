import { Suspense } from "react";
import { AuditLogScreen } from "@/areas/staff/AuditLogScreen";
import { Skeleton } from "@/ui/Skeleton";

// /biz/staff/log — «Изменения данных» / «Операции с данными» / «Входы» (F-10-100…107).
export default function Page() {
  return (
    <Suspense
      fallback={<Skeleton variant="rect" className="h-64 w-full rounded-xl" />}
    >
      <AuditLogScreen />
    </Suspense>
  );
}
