'use client';

/**
 * ⭐ «Сопутствующие услуги и товары» карточки услуги (допродажа при записи, владелец 01.10.2026). Владелец выбирает
 * до 12 услуг и товаров склада; клиент при онлайн-записи видит их одним блоком и добавляет в одно касание (услуга —
 * если мастер успевает, товар — если есть на складе), администратор — подсказкой в окне записи. Снизу — «Допродано»
 * за 90 дней. Значение — часть черновика формы (сохраняется общей кнопкой «Сохранить»).
 */
import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Package, Scissors, TrendingUp, X } from 'lucide-react';
import { useApiQuery } from '@/api/request';
import { getUpsellStats, listUpsellCandidates } from '@/api/services-upsell';
import type { Id } from '@/domain/core';
import { UPSELL_MAX, type ServiceUpsell } from '@/domain/services';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Combobox } from '@/ui/Combobox';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';

interface Row {
  id: Id;
  title: string;
  meta: string;
}

function PickedList({ rows, icon, removeLabel, onRemove, disabled }: { rows: Row[]; icon: ReactNode; removeLabel: string; onRemove: (id: Id) => void; disabled?: boolean }) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id} className="flex min-h-12 items-center gap-3 border-b border-border last:border-b-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted [&_svg]:size-4">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{r.title}</p>
            <p className="truncate text-xs text-muted tabular-nums">{r.meta}</p>
          </div>
          {!disabled && <IconButton icon={<X aria-hidden />} label={removeLabel} variant="ghost" onClick={() => onRemove(r.id)} />}
        </li>
      ))}
    </ul>
  );
}

export function UpsellSection({
  businessId,
  serviceId,
  value,
  onValueChange,
  disabled,
}: {
  businessId: Id | undefined;
  serviceId: Id | undefined;
  value: ServiceUpsell;
  onValueChange: (v: ServiceUpsell) => void;
  disabled?: boolean;
}) {
  const t = useT('services');
  const fmt = useFormat();
  const locale = useLocale();
  const candQ = useApiQuery(['services', 'upsellCandidates', businessId], () => listUpsellCandidates(businessId ?? ''), { enabled: Boolean(businessId) });
  const statsQ = useApiQuery(['services', 'upsellStats', businessId, serviceId], () => getUpsellStats(businessId ?? '', serviceId ?? ''), {
    enabled: Boolean(businessId && serviceId),
  });
  const cand = candQ.data;
  const loading = candQ.isLoading;

  const svcRows: Row[] = value.serviceIds.flatMap((id) => {
    const s = cand?.services.find((x) => x.id === id);
    return s ? [{ id, title: pickText(s.name, locale), meta: `${fmt.duration(s.durationMin)} · ${fmt.moneyRange(s.priceMin, s.priceMax)}` }] : [];
  });
  const prodRows: Row[] = value.productIds.flatMap((id) => {
    const p = cand?.products.find((x) => x.id === id);
    return p ? [{ id, title: p.name, meta: [fmt.money(p.price), p.locationName ? pickText(p.locationName, locale) : ''].filter(Boolean).join(' · ') }] : [];
  });
  const svcOptions = (cand?.services ?? [])
    .filter((s) => s.id !== serviceId && !value.serviceIds.includes(s.id))
    .map((s) => ({ value: s.id, label: pickText(s.name, locale), description: `${fmt.duration(s.durationMin)} · ${fmt.moneyRange(s.priceMin, s.priceMax)}` }));
  const prodOptions = (cand?.products ?? [])
    .filter((p) => !value.productIds.includes(p.id))
    .map((p) => ({ value: p.id, label: p.name, description: [fmt.money(p.price), p.locationName ? pickText(p.locationName, locale) : ''].filter(Boolean).join(' · ') }));
  const stats = statsQ.data;

  return (
    <div data-f="F-00-082" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg">{t('upsell.servicesLabel')}</p>
        {svcRows.length > 0 && (
          <PickedList rows={svcRows} icon={<Scissors aria-hidden />} removeLabel={t('upsell.remove')} disabled={disabled} onRemove={(id) => onValueChange({ ...value, serviceIds: value.serviceIds.filter((x) => x !== id) })} />
        )}
        {!disabled && value.serviceIds.length < UPSELL_MAX && (
          <Combobox
            options={svcOptions}
            value={null}
            loading={loading}
            placeholder={t('upsell.addService')}
            emptyText={t('upsell.noServices')}
            onValueChange={(id) => id && onValueChange({ ...value, serviceIds: [...value.serviceIds, id] })}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fg">{t('upsell.productsLabel')}</p>
        {prodRows.length > 0 && (
          <PickedList rows={prodRows} icon={<Package aria-hidden />} removeLabel={t('upsell.remove')} disabled={disabled} onRemove={(id) => onValueChange({ ...value, productIds: value.productIds.filter((x) => x !== id) })} />
        )}
        {!disabled && value.productIds.length < UPSELL_MAX && (
          <Combobox
            options={prodOptions}
            value={null}
            loading={loading}
            placeholder={t('upsell.addProduct')}
            emptyText={t('upsell.noProducts')}
            onValueChange={(id) => id && onValueChange({ ...value, productIds: [...value.productIds, id] })}
          />
        )}
      </div>

      {serviceId && (
        <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-fg" data-f="F-00-082">
          <TrendingUp aria-hidden className="size-4 shrink-0 text-muted" />
          {statsQ.isLoading || !stats ? (
            <SkeletonText width="24ch" />
          ) : stats.accepted > 0 ? (
            <span>{t('upsell.stats', { count: stats.accepted, days: stats.days, money: fmt.money(stats.revenue) })}</span>
          ) : (
            <span className="text-muted">{t('upsell.statsNone', { days: stats.days })}</span>
          )}
        </p>
      )}
    </div>
  );
}
