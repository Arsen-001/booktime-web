'use client';

/**
 * ⭐ Допродажа при записи (владелец, 01.10.2026): в окне записи — «Предложить клиенту». Те же сопутствующие, что
 * клиент видит онлайн (карточка услуги → «Сопутствующие услуги и товары»), для услуг уже в визите: услуги мастера
 * окна и товары склада в наличии. Нажали — строка добавлена (с пометкой «допродажа» для счётчика в карточке услуги).
 * Нечего предложить — блока нет.
 */
import { useLocale } from 'next-intl';
import { Package, Sparkles } from 'lucide-react';
import type { Id, Service } from '@/domain/core';
import type { GoodsCatalogItem } from '@/domain/journal';
import type { ServiceUpsell } from '@/domain/services';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { AddOnList, type AddOnItem } from '@/ui/AddOnList';
import type { UiGoodsLine, UiServiceLine } from '@/areas/journal/lib/lineTotals';

export function UpsellQuickAdd({
  configs,
  serviceLines,
  goodsLines,
  services,
  goodsCatalog,
  onAddService,
  onAddGoods,
}: {
  configs: Record<Id, ServiceUpsell> | undefined;
  serviceLines: UiServiceLine[];
  goodsLines: UiGoodsLine[];
  /** Услуги мастера окна */
  services: Service[];
  goodsCatalog: GoodsCatalogItem[];
  onAddService: (service: Service, upsellOf: Id) => void;
  onAddGoods: (item: GoodsCatalogItem, upsellOf: Id) => void;
}) {
  const t = useT('journal');
  const format = useFormat();
  const locale = useLocale();
  if (!configs) return null;
  const inVisit = new Set(serviceLines.map((l) => l.serviceId));
  const goodsInVisit = new Set(goodsLines.map((l) => l.itemId));
  const svcOffers: { service: Service; parent: Id }[] = [];
  const goodsOffers: { item: GoodsCatalogItem; parent: Id }[] = [];
  for (const line of serviceLines) {
    const cfg = configs[line.serviceId];
    if (!cfg) continue;
    for (const id of cfg.serviceIds) {
      const svc = services.find((s) => s.id === id);
      if (svc && !inVisit.has(id) && !svcOffers.some((o) => o.service.id === id)) svcOffers.push({ service: svc, parent: line.serviceId });
    }
    for (const id of cfg.productIds) {
      const item = goodsCatalog.find((g) => g.id === id && g.kind === 'product' && g.stock > 0);
      if (item && !goodsInVisit.has(id) && !goodsOffers.some((o) => o.item.id === id)) goodsOffers.push({ item, parent: line.serviceId });
    }
  }
  if (!svcOffers.length && !goodsOffers.length) return null;

  const items: AddOnItem[] = [
    ...svcOffers.map(({ service }) => ({
      id: `s:${service.id}`,
      title: pickText(service.name, locale),
      meta: `${format.duration(service.durationMin)} · ${format.moneyRange(service.priceMin, service.priceMax)}`,
      selected: false,
      icon: <Sparkles aria-hidden />,
    })),
    ...goodsOffers.map(({ item }) => ({
      id: `p:${item.id}`,
      title: item.name,
      meta: t('window.upsell.productMeta', { price: format.money(item.price), stock: item.stock }),
      selected: false,
      icon: <Package aria-hidden />,
    })),
  ];
  const add = (key: string) => {
    const id = key.slice(2);
    if (key.startsWith('s:')) {
      const o = svcOffers.find((x) => x.service.id === id);
      if (o) onAddService(o.service, o.parent);
    } else {
      const o = goodsOffers.find((x) => x.item.id === id);
      if (o) onAddGoods(o.item, o.parent);
    }
  };

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-primary/25 bg-primary-soft/40 px-3 pt-2.5 pb-1" data-f="F-01-055">
      <p className="text-sm font-medium text-fg">{t('window.upsell.title')}</p>
      <AddOnList compact items={items} onToggle={add} aria-label={t('window.upsell.title')} />
    </div>
  );
}
