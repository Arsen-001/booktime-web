"use client";

/**
 * /biz/network/services — «Настройки услуг» сети (F-11-079): категории всех локаций сети одним списком,
 * счётчик услуг. Раздача сетевых по филиалам — b03 (см. qa/requests/network.md).
 */
import { useState } from "react";
import { FolderPlus, Layers, Plus, Tags } from "lucide-react";
import { listNetworkPackages, listNetworkServiceCategories } from "@/api/network";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useLocale } from "next-intl";
import { pickText } from "@/lib/text";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { LinkButton } from "@/ui/Button";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { useSkeletonCount } from "@/ui/hooks/useSkeletonCount";
import { NetworkPageActions } from "@/areas/network/NetworkPageHelp";
import { useNetwork } from "@/areas/network/lib/useNetwork";
import { PackageFormModal } from "@/areas/network/PackageFormModal";

/** Строка категории — одной высоты со значком «Сеть» и без (h-11 / md:h-10), скелетон той же коробки */
const CATEGORY_ROW = "flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left md:h-10";
const PACKAGE_ROW = "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2";

function CategoryRowSkeleton({ i }: { i: number }) {
  return (
    <li>
      <span className={CATEGORY_ROW}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">
            <SkeletonText width={i % 2 ? "12ch" : "16ch"} />
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted">
          <SkeletonText width="8ch" />
        </span>
      </span>
    </li>
  );
}

function PackageRowSkeleton() {
  return (
    <li className={PACKAGE_ROW}>
      <span className="truncate text-sm font-medium text-fg">
        <SkeletonText width="18ch" />
      </span>
      <span className="shrink-0 text-xs text-muted">
        <SkeletonText width="9ch" />
      </span>
    </li>
  );
}

export function ServicesScreen() {
  const t = useT("network");
  const locale = useLocale() as "ru" | "en" | "hy";
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(
    ["network", "serviceCategories", networkId],
    () => listNetworkServiceCategories(networkId!),
    {
      enabled: ready && Boolean(networkId),
    },
  );
  const packagesQ = useApiQuery(
    ["network", "packages", networkId],
    () => listNetworkPackages(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const [packageOpen, setPackageOpen] = useState(false);

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: categoriesPage, pager: categoriesPager } = usePagedList(q.data ?? []);
  const { pageItems: packagesPage, pager: packagesPager } = usePagedList(packagesQ.data ?? []);

  const categoriesLoading = !ready || q.isLoading;
  const packagesLoading = !ready || packagesQ.isLoading;
  const categoryRows = useSkeletonCount("networkServiceCategories", { loading: categoriesLoading, count: q.data ? categoriesPage.length : undefined, fallback: 4, max: 10 });
  const packageRows = useSkeletonCount("networkPackages", { loading: packagesLoading, count: packagesQ.data ? packagesPage.length : undefined, fallback: 0, max: 10 });

  if (isError || q.isError)
    return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  return (
    <div
      data-f="F-11-079"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader
        title={t("services.title")}
        description={t("services.subtitle")}
        actions={
          <NetworkPageActions
            titleKey="help.services.title"
            bodyKey="help.services.body"
            extra={
              <div className="flex flex-wrap items-center gap-2">
                <LinkButton
                  href="/biz/network/services/categories/new"
                  variant="secondary"
                  size="sm"
                  leftIcon={<FolderPlus aria-hidden />}
                >
                  {t("services.addCategory")}
                </LinkButton>
                <LinkButton href="/biz/services" variant="secondary" size="sm">
                  {t("services.openCatalog")}
                </LinkButton>
              </div>
            }
          />
        }
      />
      {categoriesLoading ? (
        <ul aria-hidden className="flex flex-col gap-2">
          {Array.from({ length: categoryRows }, (_, i) => (
            <CategoryRowSkeleton key={i} i={i} />
          ))}
        </ul>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Tags aria-hidden />}
          title={t("services.empty")}
          description={t("services.emptyHint")}
          action={
            <LinkButton href="/biz/network/services/categories/new" leftIcon={<FolderPlus aria-hidden />}>
              {t("services.addCategory")}
            </LinkButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {categoriesPage.map((row) => (
              <li key={row.key}>
                <LinkButton
                  href={`/biz/network/services/categories/${encodeURIComponent(row.key)}`}
                  variant="ghost"
                  className={CATEGORY_ROW}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {row.isNetwork && (
                      <Badge tone="accent" size="sm">
                        {t("services.networkMark")}
                      </Badge>
                    )}
                    <span className="truncate text-sm font-medium text-fg">
                      {pickText(row.category.name, locale)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {t("services.count", { count: row.servicesCount })}
                  </span>
                </LinkButton>
              </li>
            ))}
          </ul>
          {categoriesPager}
        </div>
      )}

      <div data-f="F-11-095">
        <SectionCard
          title={t("services.packagesTitle")}
          description={t("services.packagesSubtitle")}
          actions={
            <Button
              size="sm"
              leftIcon={<Plus aria-hidden />}
              onClick={() => setPackageOpen(true)}
              disabled={!q.data?.length}
            >
              {t("services.addPackage")}
            </Button>
          }
        >
          {packagesLoading ? (
            packageRows > 0 ? (
              <ul aria-hidden className="flex flex-col gap-2">
                {Array.from({ length: packageRows }, (_, i) => (
                  <PackageRowSkeleton key={i} />
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Layers aria-hidden />} title={t("services.packagesEmpty")} />
            )
          ) : !packagesQ.data?.length ? (
            <EmptyState
              compact
              icon={<Layers aria-hidden />}
              title={t("services.packagesEmpty")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {packagesPage.map((row) => (
                <li key={row.key} className={PACKAGE_ROW}>
                  <span className="truncate text-sm font-medium text-fg">
                    {pickText(row.service.name, locale)}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {t("services.packageItems", {
                      count: row.service.servicePackage?.items.length ?? 0,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {packagesPager && <div className="mt-4">{packagesPager}</div>}
        </SectionCard>
      </div>

      <div data-f="F-11-084">
        <SectionCard title={t("services.lockedTitle")}>
          <p className="text-sm text-muted">{t("services.lockedBody")}</p>
        </SectionCard>
      </div>

      <PackageFormModal
        open={packageOpen}
        onOpenChange={setPackageOpen}
        onSaved={() => packagesQ.refetch()}
      />
    </div>
  );
}
