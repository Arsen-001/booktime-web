"use client";

/**
 * /biz/staff/license — «Управление лицензией» (F-10-111, F-10-113, F-10-119): сводка, кто занимает
 * платные места, разбивка «Платные / Бесплатные», сумма подписки и когда каждый последний раз входил.
 * ⭐ по нашей цене (F-00-013/014/016): места не лимитированы, платит роль, а не право; строим по этой
 * модели, а не по «лимит N / M» Altegio (F-10-113). «График работы, до» — поле schedule (не заведено;
 * см. qa/requests/staff.md), колонку не показываем, пока его нет.
 */
import { useRouter } from "next/navigation";
import { CircleAlert, KeyRound } from "lucide-react";
import { listLogins, listStaffRows } from "@/api/staff";
import { useApiQuery } from "@/api/request";
import { totalSeatCost } from "@/areas/staff/pricing";
import { NoAccessState } from "@/areas/staff/components/NoAccessState";
import { useCan, useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { pickText } from "@/lib/text";
import { Accordion } from "@/ui/Accordion";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";

export function LicenseScreen() {
  const t = useT("staff");
  const format = useFormat();
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const canManage = useCan("staff.manage");

  const rowsQ = useApiQuery(
    ["staff", "rows", businessId, "all"],
    () =>
      listStaffRows({
        businessId: businessId!,
        filters: { status: "all", license: "all" },
      }),
    { enabled: ready && !!businessId && canManage },
  );
  const loginsQ = useApiQuery(
    ["staff", "logins", businessId],
    () => listLogins(businessId!),
    { enabled: ready && !!businessId && canManage },
  );

  if (!ready) return <Skeleton lines={6} />;
  if (!canManage) return <NoAccessState />;
  if (rowsQ.isError || loginsQ.isError)
    return (
      <ErrorState
        onRetry={() => {
          void rowsQ.refetch();
          void loginsQ.refetch();
        }}
      />
    );

  const rows = (rowsQ.data ?? []).filter((r) => r.staff.status !== "fired");
  const lastLoginByStaff = new Map<string, string>();
  for (const entry of loginsQ.data ?? []) {
    const prev = lastLoginByStaff.get(entry.staffId);
    if (!prev || entry.at > prev) lastLoginByStaff.set(entry.staffId, entry.at);
  }

  const paid = rows.filter((r) => r.seat.paid);
  const free = rows.filter((r) => !r.seat.paid);
  const total = totalSeatCost(rows.map((r) => r.seat));

  return (
    <div data-f="F-10-111" className="flex flex-col gap-6">
      <PageHeader
        title={t("license.title")}
        description={t("license.subtitle")}
        back={{ href: "/biz/staff", label: t("nav.list") }}
      />

      <div data-f="F-10-113" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SectionCard title={t("license.monthlyTotal")}>
          <p className="text-2xl font-semibold text-fg">{format.money(total)}</p>
        </SectionCard>
        <SectionCard title={t("license.hintTitle")}>
          <p className="text-sm text-muted">{t("license.hint")}</p>
        </SectionCard>
      </div>

      <div data-f="F-10-114">
        <SectionCard
          title={t("license.ruleChangeTitle")}
          description={t("license.ruleChangeHint")}
        >
          <Accordion
            variant="plain"
            items={[
              {
                id: "history",
                title: <span data-f="F-10-116">{t("license.historyTitle")}</span>,
                content: (
                  <p className="whitespace-pre-line">{t("license.historyText")}</p>
                ),
              },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard
        title={t("license.paidTitle", { n: paid.length })}
        description={t("license.paidHint")}
      >
        {paid.length === 0 ? (
          <EmptyState icon={<KeyRound className="size-6" />} title={t("license.paidEmpty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {paid.map((r) => (
              <LicenseRow
                key={r.staff.id}
                name={r.staff.name}
                avatarUrl={r.staff.avatarUrl}
                position={pickText(r.staff.position, "ru") || r.positionLabel}
                lastLogin={lastLoginByStaff.get(r.staff.id)}
                price={r.seat.price}
                onOpen={() => router.push(`/biz/staff?staff=${r.staff.id}`)}
                t={t}
                format={format}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={t("license.freeTitle", { n: free.length })}
        description={t("license.freeHint")}
      >
        {free.length === 0 ? (
          <EmptyState icon={<CircleAlert className="size-6" />} title={t("license.freeEmpty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {free.map((r) => (
              <LicenseRow
                key={r.staff.id}
                name={r.staff.name}
                avatarUrl={r.staff.avatarUrl}
                position={pickText(r.staff.position, "ru") || r.positionLabel}
                lastLogin={lastLoginByStaff.get(r.staff.id)}
                price={0}
                onOpen={() => router.push(`/biz/staff?staff=${r.staff.id}`)}
                t={t}
                format={format}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function LicenseRow({
  name,
  avatarUrl,
  position,
  lastLogin,
  price,
  onOpen,
  t,
  format,
}: {
  name: string;
  avatarUrl?: string;
  position: string;
  lastLogin?: string;
  price: number;
  onOpen: () => void;
  t: ReturnType<typeof useT>;
  format: ReturnType<typeof useFormat>;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <Avatar src={avatarUrl} name={name} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          <span className="truncate text-xs text-muted">{position}</span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
        <span>
          {lastLogin ? format.ago(lastLogin) : t("license.neverLoggedIn")}
        </span>
        {price > 0 ? (
          <Badge tone="neutral">{format.money(price)}</Badge>
        ) : (
          <Badge tone="success">{t("table.free")}</Badge>
        )}
      </span>
    </li>
  );
}
