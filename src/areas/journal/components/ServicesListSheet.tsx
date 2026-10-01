"use client";

/**
 * F-01-152: «Список услуг» — прайс локации окном поверх журнала. Карандаш ведёт в настройку услуги
 * (раздел «Услуги» — своя страница, мы туда не пишем).
 */
import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Pencil, Plus, Search } from "lucide-react";
import type { Id } from "@/domain/core";
import { coreList } from "@/api/core";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { normalizeSearch } from "@/lib/text";
import { pickText } from "@/lib/text";
import { Accordion } from "@/ui/Accordion";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { Input } from "@/ui/Input";
import { LinkButton } from "@/ui/Button";
import { Sheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";

export interface ServicesListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
}

export function ServicesListSheet({
  open,
  onOpenChange,
  businessId,
}: ServicesListSheetProps) {
  const t = useT("journal");
  const locale = useLocale();
  const format = useFormat();
  const [query, setQuery] = useState("");

  const servicesQuery = useApiQuery(
    ["journal", "services-list", businessId],
    () => coreList("services", { businessId }),
    { enabled: open },
  );
  const categoriesQuery = useApiQuery(
    ["journal", "services-list-categories", businessId],
    () => coreList("serviceCategories", { businessId }),
    { enabled: open },
  );
  const staffQuery = useApiQuery(
    ["journal", "services-list-staff", businessId],
    () => coreList("staff", { businessId }),
    { enabled: open },
  );

  const filtered = useMemo(() => {
    const services = servicesQuery.data ?? [];
    if (!query.trim()) return services;
    const needle = normalizeSearch(query);
    return services.filter((s) =>
      normalizeSearch(pickText(s.name, locale)).includes(needle),
    );
  }, [servicesQuery.data, query, locale]);

  const byCategory = useMemo(() => {
    const map = new Map<Id, typeof filtered>();
    for (const s of filtered)
      map.set(s.categoryId, [...(map.get(s.categoryId) ?? []), s]);
    return map;
  }, [filtered]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("sidebar.serviceListSheetTitle")}
      side="right"
      size="md"
    >
      <div data-f="F-01-152" className="flex flex-col gap-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search aria-hidden />}
          placeholder={t("sidebar.serviceListSearchPlaceholder")}
        />

        {servicesQuery.isLoading ? (
          <Skeleton lines={6} />
        ) : filtered.length === 0 ? (
          <EmptyState kind="search" />
        ) : (
          <Accordion
            items={(categoriesQuery.data ?? [])
              .filter((c) => (byCategory.get(c.id) ?? []).length > 0)
              .map((c) => ({
                id: c.id,
                title: pickText(c.name, locale),
                content: (
                  <div className="flex flex-col gap-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="py-1.5">
                            {t("sidebar.serviceListColumns.name")}
                          </th>
                          <th className="py-1.5">
                            {t("sidebar.serviceListColumns.online")}
                          </th>
                          <th className="py-1.5">
                            {t("sidebar.serviceListColumns.duration")}
                          </th>
                          <th className="py-1.5">
                            {t("sidebar.serviceListColumns.price")}
                          </th>
                          <th className="py-1.5">
                            {t("sidebar.serviceListColumns.staff")}
                          </th>
                          <th className="py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {(byCategory.get(c.id) ?? []).map((s) => (
                          <tr key={s.id} className="border-t border-border">
                            <td className="py-2 font-medium text-fg">
                              {pickText(s.name, locale)}
                            </td>
                            <td className="py-2">
                              <Badge
                                tone={s.onlineBookable ? "success" : "neutral"}
                                size="sm"
                              >
                                {s.onlineBookable
                                  ? t("sidebar.serviceListColumns.onlineOn")
                                  : t("sidebar.serviceListColumns.onlineOff")}
                              </Badge>
                            </td>
                            <td className="py-2 text-muted">
                              {format.duration(s.durationMin)}
                            </td>
                            <td className="py-2 text-muted">
                              {format.money(s.priceMin)}
                            </td>
                            <td className="py-2 text-muted">
                              {s.staffIds
                                .map(
                                  (id) =>
                                    (staffQuery.data ?? []).find(
                                      (st) => st.id === id,
                                    )?.name,
                                )
                                .filter(Boolean)
                                .slice(0, 2)
                                .join(", ")}
                            </td>
                            <td className="py-2 text-right">
                              <LinkButton
                                href={`/biz/services/${s.id}`}
                                variant="ghost"
                                size="sm"
                              >
                                <Pencil aria-hidden className="size-4" />
                              </LinkButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
              }))}
          />
        )}

        <LinkButton
          href="/biz/services"
          variant="outline"
          leftIcon={<Plus aria-hidden />}
        >
          {t("sidebar.serviceListAdd")}
        </LinkButton>
      </div>
    </Sheet>
  );
}
