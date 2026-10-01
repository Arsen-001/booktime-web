"use client";

/**
 * F-01-055 (вкладка «Услуги» + поиск), F-01-056 (частые услуги мастера), F-01-057 (все услуги по
 * категориям). Список — только услуги, которые оказывает выбранный мастер (уже отфильтровано выше).
 */
import { useMemo, useState } from "react";
import type { Service, ServiceCategory } from "@/domain/core";
import { useLocale } from "next-intl";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { normalizeSearch } from "@/lib/text";
import { pickText } from "@/lib/text";
import { Accordion } from "@/ui/Accordion";
import { Badge } from "@/ui/Badge";
import { SearchInput } from "@/ui/SearchInput";

export interface ServicePickerProps {
  services: Service[];
  categories: ServiceCategory[];
  frequent: Service[];
  lastClientServiceId?: string;
  onAdd: (service: Service) => void;
}

export function ServicePicker({
  services,
  categories,
  frequent,
  lastClientServiceId,
  onAdd,
}: ServicePickerProps) {
  const t = useT("journal");
  const format = useFormat();
  const locale = useLocale();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return services;
    return services.filter((s) =>
      normalizeSearch(pickText(s.name, locale)).includes(q),
    );
  }, [services, query, locale]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      const list = map.get(s.categoryId) ?? [];
      list.push(s);
      map.set(s.categoryId, list);
    }
    return categories
      .filter((c) => map.has(c.id))
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ category: c, items: map.get(c.id) ?? [] }));
  }, [filtered, categories]);

  const lastService = lastClientServiceId
    ? services.find((s) => s.id === lastClientServiceId)
    : undefined;

  return (
    <div data-f="F-01-055 F-01-057" className="flex flex-col gap-3">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("window.center.searchServices")}
      />

      {!query && (
        <div data-f="F-01-056" className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">
            {t("window.center.frequentTitle")}
          </p>
          {lastService && (
            <button
              type="button"
              onClick={() => onAdd(lastService)}
              className="flex min-h-10 items-center justify-between rounded-lg border border-dashed border-primary bg-primary-soft px-3 text-left text-sm"
            >
              <span className="truncate text-primary-text">
                {t("window.center.lastClientServiceHint", {
                  name: pickText(lastService.name, locale),
                })}
              </span>
            </button>
          )}
          {frequent.length === 0 && !lastService ? (
            <p className="text-sm text-muted">
              {t("window.center.frequentEmpty")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {frequent.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onAdd(s)}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-sm hover:border-border-strong hover:bg-surface-2"
                >
                  {pickText(s.name, locale)}
                  <span className="text-muted">{format.moneyRange(s.priceMin, s.priceMax)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted">
          {t("window.center.allServicesTitle")}
        </p>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted">
            {t("window.center.allServicesEmpty")}
          </p>
        ) : (
          <Accordion
            multiple
            items={byCategory.map(({ category, items }) => ({
              id: category.id,
              title: pickText(category.name, locale),
              defaultOpen: Boolean(query),
              content: (
                <div className="flex flex-col gap-1">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onAdd(s)}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">
                          {pickText(s.name, locale)}
                        </span>
                        {/* F-16-125: пакеты в дереве и в поиске помечены меткой «Пакет» */}
                        {s.servicePackage && (
                          <Badge data-f="F-16-125" tone="accent" size="sm">
                            {t("window.package.badge")}
                          </Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-muted">
                        {s.servicePackage
                          ? t("window.packageDraft.itemsCount", {
                              n: s.servicePackage.items.length,
                            })
                          : `${format.moneyRange(s.priceMin, s.priceMax)} · ${format.duration(s.durationMin)}`}
                      </span>
                    </button>
                  ))}
                </div>
              ),
            }))}
          />
        )}
      </div>
    </div>
  );
}
