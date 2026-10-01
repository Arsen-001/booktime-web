"use client";

/**
 * /biz/network — обзор сети (F-11-001, F-11-006, F-11-162). Шапка и меню отличаются от кабинета филиала:
 * фиолетовый акцент подсветки меню сети задаёт shell (permission network.manage), здесь — заголовок «Сеть <имя>».
 */
import {
  Building2,
  Globe,
  KeyRound,
  Landmark,
  MapPinned,
  PiggyBank,
  Settings as SettingsIcon,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setLocationId } from "@/demo/store";
import { getNetworkBranchDailyStats, listNetworkLocations } from "@/api/network";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { today } from "@/lib/date";
import { pickText } from "@/lib/text";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Button } from "@/ui/Button";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { StatCard } from "@/ui/StatCard";
import { useLocale } from "next-intl";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { NetworkFinanceCard } from "@/areas/network/lib/NetworkFinanceCard";
import { useNetwork } from "@/areas/network/lib/useNetwork";
import { useNetworkAccess } from "@/areas/network/lib/useNetworkAccess";

const OWN_SECTIONS = [
  { icon: Building2, key: "journal", href: "/biz/journal" },
  { icon: Warehouse, key: "stock", href: "/biz/stock" },
  { icon: PiggyBank, key: "finance", href: "/biz/finance" },
  { icon: SettingsIcon, key: "settings", href: "/biz/settings" },
] as const;

const BRANCH_ROW =
  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border px-3 py-2.5";

/** Место выручки и числа записей филиала — те же строки, значения полосами */
function BranchStatSkeleton() {
  return (
    <div className="flex shrink-0 flex-col items-end">
      <span className="num-headline text-base text-fg">
        <SkeletonText width="8ch" />
      </span>
      <span className="text-xs text-muted">
        <SkeletonText width="9ch" />
      </span>
    </div>
  );
}

/** Скелетон строки филиала — та же разметка: значок, название (и «Главный»), адрес, выручка, «Открыть» */
function BranchRowSkeleton({ main }: { main: boolean }) {
  const t = useT("network");
  return (
    <li className={BRANCH_ROW}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
        <Building2 className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-fg">
            {/* Типичное «Manana Beauty» — метка «Главный филиал» встаёт на то же место */}
            <SkeletonText width="15.2ch" />
          </p>
          {main && (
            <Badge tone="accent" size="sm">
              {t("settings.mainLocation")}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted">
          <SkeletonText width="24ch" />
        </p>
      </div>
      <BranchStatSkeleton />
      <Button variant="ghost" size="sm" className="ml-auto shrink-0 sm:ml-0" disabled>
        {t("overview.openBranch")}
      </Button>
    </li>
  );
}

export function OverviewScreen() {
  const t = useT("network");
  const format = useFormat();
  const locale = useLocale() as "ru" | "en" | "hy";
  const router = useRouter();
  const { ready, networkId, isLoading, isError, refetch, network } =
    useNetwork();
  const access = useNetworkAccess();
  const q = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  // F-11-156 (тот же источник, что и переключатель /biz/network/switch): выручка и записи за сегодня
  // по каждому филиалу сети — это и есть «сводка владельца», а не только список адресов.
  const branchIds = (q.data ?? []).map((row) => row.business.id);
  const statsQ = useApiQuery(
    ["network", "branchDailyStats", branchIds, today()],
    () => getNetworkBranchDailyStats(branchIds, today()),
    { enabled: ready && branchIds.length > 0 },
  );

  const skeletonRows = useSkeletonCount("networkBranches", { loading: isLoading || q.isLoading, count: q.data?.length, fallback: 2, max: 20 });

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const statsLoading = isLoading || q.isLoading || (branchIds.length > 0 && statsQ.isLoading);
  const totalRevenue = (statsQ.data ?? []).reduce((sum, s) => sum + s.revenue, 0);
  const totalBookings = (statsQ.data ?? []).reduce((sum, s) => sum + s.bookingsCount, 0);
  const branchesCount = q.data?.length ?? 0;

  return (
    <div
      data-f="F-11-001 F-11-003 F-11-004"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader
        title={
          isLoading ? (
            <SkeletonText width="14ch" />
          ) : (
            t("overview.title", { name: network?.name ?? "" })
          )
        }
        description={t("overview.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.overview.title"
            bodyKey="help.overview.body"
          />
        }
      />

      <div data-f="F-11-156" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          loading={statsLoading}
          label={t("overview.statRevenue")}
          value={format.money(totalRevenue)}
          icon={<PiggyBank aria-hidden />}
        />
        <StatCard
          loading={statsLoading}
          label={t("overview.statBookings")}
          value={totalBookings}
          icon={<Building2 aria-hidden />}
        />
        <StatCard
          className="col-span-2 sm:col-span-1"
          loading={isLoading || q.isLoading}
          label={t("overview.statBranches")}
          value={branchesCount}
          icon={<Landmark aria-hidden />}
        />
      </div>

      <SectionCard
        title={t("overview.locationsTitle")}
        description={t("overview.locationsSubtitle")}
      >
        {isLoading || q.isLoading ? (
          <ul aria-hidden className="flex flex-col gap-2">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <BranchRowSkeleton key={i} main={i === 0} />
            ))}
          </ul>
        ) : !q.data?.length ? (
          <EmptyState compact title={t("overview.noLocations")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {q.data.map((row) => {
              const stat = statsQ.data?.find(
                (s) => s.businessId === row.business.id,
              );
              return (
                <li key={row.business.id} className={BRANCH_ROW}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                    <Building2 className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-fg">
                        {row.business.name}
                      </p>
                      {row.isMain && (
                        <Badge tone="accent" size="sm">
                          {t("settings.mainLocation")}
                        </Badge>
                      )}
                    </div>
                    {row.location && (
                      <p className="truncate text-xs text-muted">
                        {pickText(row.location.address, locale)}
                      </p>
                    )}
                  </div>
                  {/* Выручка за сегодня грузится отдельно — пока идёт, на её месте полосы, а не пустота */}
                  {statsQ.isLoading && !stat ? (
                    <BranchStatSkeleton />
                  ) : stat && (
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="num-headline text-base text-fg">
                        {format.money(stat.revenue)}
                      </span>
                      <span className="text-xs text-muted">
                        {t("overview.branchBookings", { count: stat.bookingsCount })}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto shrink-0 sm:ml-0"
                    onClick={() => {
                      // Сеть3: «Открыть» выбирает этот филиал в шапке и только потом ведёт в журнал
                      const locationId = row.location?.id ?? row.business.locationIds[0];
                      if (locationId) setLocationId(locationId);
                      router.push("/biz/journal");
                    }}
                  >
                    {t("overview.openBranch")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Выручка по филиалам — раздел «Аналитика»: пользователю сети без этого права карточка не показывается */}
      {access.canSee("/biz/network/analytics") && (
        <NetworkFinanceCard networkId={networkId} enabled={ready} />
      )}

      <div data-f="F-11-006">
        <SectionCard
          title={t("overview.ownTitle")}
          description={t("overview.ownSubtitle")}
        >
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OWN_SECTIONS.map(({ icon: Icon, key, href }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="flex h-full flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-center text-xs font-medium text-fg transition-colors hover:border-accent hover:bg-surface-2"
                >
                  <Icon className="size-5 text-muted" aria-hidden />
                  {t(`overview.own.${key}` as const)}
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div data-f="F-11-162">
        <SectionCard
          title={t("overview.scopeTitle")}
          description={t("overview.scopeSubtitle")}
        >
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Landmark className="size-4 shrink-0 text-muted" aria-hidden />
              {t("overview.scopeNetworkOnly")}
            </li>
            <li className="flex items-center gap-2">
              <Building2 className="size-4 shrink-0 text-muted" aria-hidden />
              {t("overview.scopeBranchOnly")}
            </li>
          </ul>
        </SectionCard>
      </div>

      <div data-f="F-11-160 F-11-161">
        <SectionCard title={t("overview.accountTitle")}>
          <div className="flex items-start gap-3 text-sm text-muted">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p>{t("overview.accountBody")}</p>
              <p className="mt-2 text-xs">{t("overview.startPageLink")}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-11-157 F-11-158 F-11-159 F-11-165">
        <SectionCard title={t("overview.ecosystemTitle")}>
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {(
              ["clientApp", "brandedApp", "partners", "countryLimits"] as const
            ).map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Globe className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                {t(`overview.ecosystemItems.${key}` as const)}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div data-f="F-11-121 F-11-122 F-11-123 F-11-124">
        <SectionCard
          title={t("overview.onlineTitle")}
          description={t("overview.onlineSubtitle")}
        >
          <ul className="flex flex-col gap-2 text-sm text-muted">
            {(["link", "display", "mainLink", "clientPick"] as const).map(
              (key) => (
                <li key={key} className="flex items-start gap-2">
                  <MapPinned
                    className="mt-0.5 size-4 shrink-0 text-muted"
                    aria-hidden
                  />
                  {t(`overview.onlineItems.${key}` as const)}
                </li>
              ),
            )}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
