"use client";

/**
 * /biz/network/goods/stock — остатки каждого сетевого товара по филиалам (F-11-120).
 */
import { Boxes } from "lucide-react";
import { getNetworkGoodsStock, listNetworkLocations } from "@/api/network";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { LinkButton } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function GoodsStockScreen() {
  const t = useT("network");
  const { ready, networkId, isError, refetch } = useNetwork();
  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const stockQ = useApiQuery(
    ["network", "goodsStock", networkId],
    () => getNetworkGoodsStock(networkId!),
    { enabled: ready && Boolean(networkId) },
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: stockPage, pager } = usePagedList(stockQ.data ?? []);

  if (isError || stockQ.isError)
    return (
      <ErrorState onRetry={() => (isError ? refetch() : stockQ.refetch())} />
    );

  const locations = locationsQ.data ?? [];

  return (
    <div
      data-f="F-11-120"
      className="flex w-full flex-col gap-6"
    >
      <PageHeader title={t("goods.stock.title")} description={t("goods.stock.subtitle")} />
      <LinkButton href="/biz/network/goods" variant="ghost" size="sm" className="w-fit">
        ← {t("goods.title")}
      </LinkButton>

      <SectionCard title={t("goods.stock.title")} padding="none">
        {!ready || stockQ.isLoading || locationsQ.isLoading ? (
          <div className="p-5">
            <Skeleton lines={4} />
          </div>
        ) : !stockQ.data?.length ? (
          <div className="p-5">
            <EmptyState compact icon={<Boxes aria-hidden />} title={t("goods.stock.empty")} />
          </div>
        ) : (
          <>
            <div className="main-scrollbar overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                      {t("goods.stock.colProduct")}
                    </th>
                    {locations.map((l) => (
                      <th key={l.business.id} className="px-2 py-2.5 text-center font-medium">
                        {l.business.name}
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-center font-medium">
                      {t("goods.stock.colTotal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stockPage.map((row) => (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-fg">
                        {row.name}
                      </td>
                      {locations.map((l) => (
                        <td key={l.business.id} className="px-2 py-2 text-center text-fg">
                          {row.byBusiness.find((b) => b.businessId === l.business.id)?.qty ?? 0}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-semibold text-fg">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pager && <div className="border-t border-border px-4 py-3">{pager}</div>}
          </>
        )}
      </SectionCard>
    </div>
  );
}
