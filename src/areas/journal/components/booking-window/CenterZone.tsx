'use client';

/**
 * Окно записи → центр: статус, состав визита, «К оплате» (F-01-054…062, F-01-211).
 * Когда открыта плитка «Расширенные поля» (F-01-049), центр временно показывает её форму вместо
 * статусов и состава — так описана проверка 2 у F-01-037; onHideExpanded возвращает обычный вид.
 */
import type { ReactNode } from 'react';
import type { BookingStatus, Id, Service, ServiceCategory, Staff } from '@/domain/core';
import type { ServiceUpsell } from '@/domain/services';
import { UpsellQuickAdd } from '@/areas/journal/components/booking-window/UpsellQuickAdd';
import type { GoodsCatalogItem } from '@/domain/journal';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import type { UiGoodsLine, UiServiceLine } from '@/areas/journal/lib/lineTotals';
import { visitTotal } from '@/areas/journal/lib/lineTotals';
import { isNotFullyPaid } from '@/areas/journal/lib/status';
import { StatusButtons } from '@/areas/journal/components/booking-window/StatusButtons';
import { Badge } from '@/ui/Badge';
import { ServiceLineRow } from '@/areas/journal/components/booking-window/ServiceLineRow';
import { GoodsLineRow } from '@/areas/journal/components/booking-window/GoodsLineRow';
import { ServicePicker } from '@/areas/journal/components/booking-window/ServicePicker';
import { GoodsPicker } from '@/areas/journal/components/booking-window/GoodsPicker';
import { Button } from '@/ui/Button';
import { Tabs } from '@/ui/Tabs';

export type CenterTab = 'services' | 'goods';

export interface CenterZoneProps {
  isEdit: boolean;
  status: BookingStatus;
  onStatusChange: (status: BookingStatus) => void;
  activeTab: CenterTab;
  onActiveTabChange: (tab: CenterTab) => void;
  services: Service[];
  categories: ServiceCategory[];
  frequentServices: Service[];
  lastClientServiceId?: string;
  serviceLines: UiServiceLine[];
  onAddService: (service: Service, upsellOf?: Id) => void;
  onUpdateServiceLine: (index: number, patch: Partial<UiServiceLine>) => void;
  onRemoveServiceLine: (index: number) => void;
  goodsCatalog: GoodsCatalogItem[];
  goodsLines: UiGoodsLine[];
  staffOptions: Staff[];
  /** F-01-059 */
  assistantPayEnabled?: boolean;
  onAddGoods: (item: GoodsCatalogItem, upsellOf?: Id) => void;
  /** ⭐ Допродажа: сопутствующие услуг бизнеса — «Предложить клиенту» над выбором услуг */
  upsellConfigs?: Record<Id, ServiceUpsell>;
  onUpdateGoodsLine: (id: string, patch: Partial<UiGoodsLine>) => void;
  onRemoveGoodsLine: (id: string) => void;
  paidAmount: number;
  onPay: () => void;
  paying: boolean;
  /** F-01-138: право «Проводить оплату» — без него кнопки «Оплатить» нет вовсе */
  canPay: boolean;
  /** F-01-079: сбросить отметку оплаты — визит становится «оплачен не полностью» */
  onCancelPayment?: () => void;
  cancelingPayment?: boolean;
  expandedTileActive: boolean;
  expandedFieldsPanel: ReactNode;
  /** F-01-146: снимок условий предоплаты — рисует BookingWindow (PaymentPolicyBlock), только когда есть Booking.prepayment */
  paymentPolicy?: ReactNode;
  /** ⭐ «Закончили раньше» / «Пришёл раньше — начать сейчас» у сохранённой записи (lib/visitTiming) — сразу, без «Сохранить» */
  timingActions?: ReactNode;
  /** F-16-125/129/130: пакеты, добавленные из списка услуг, и их связанные записи — рисует BookingWindow */
  packagePanel?: ReactNode;
}

export function CenterZone({
  isEdit,
  status,
  onStatusChange,
  activeTab,
  onActiveTabChange,
  services,
  categories,
  frequentServices,
  lastClientServiceId,
  serviceLines,
  onAddService,
  onUpdateServiceLine,
  onRemoveServiceLine,
  goodsCatalog,
  goodsLines,
  staffOptions,
  assistantPayEnabled,
  onAddGoods,
  onUpdateGoodsLine,
  onRemoveGoodsLine,
  paidAmount,
  onPay,
  paying,
  canPay,
  onCancelPayment,
  cancelingPayment,
  expandedTileActive,
  expandedFieldsPanel,
  paymentPolicy,
  timingActions,
  packagePanel,
  upsellConfigs,
}: CenterZoneProps) {
  const t = useT('journal');
  const format = useFormat();

  if (expandedTileActive) {
    return <div>{expandedFieldsPanel}</div>;
  }

  const total = visitTotal(serviceLines, goodsLines);
  const notArrived = status === 'no_show';
  const paidFully = total > 0 && paidAmount >= total;
  const notFullyPaid = isNotFullyPaid(status, total, paidAmount);

  return (
    <div className="flex flex-col gap-5">
      <StatusButtons value={status} onValueChange={onStatusChange} />
      {timingActions}
      {paymentPolicy}

      {(serviceLines.length > 0 || goodsLines.length > 0) && (
        <div data-f="F-01-058 F-01-060 F-01-211 F-01-130 F-08-068" className="flex flex-col gap-2">
          {serviceLines.map((line, index) => (
            <ServiceLineRow
              key={`${line.serviceId}:${index}`}
              line={line}
              defaultCollapsed={isEdit}
              onChange={(patch) => onUpdateServiceLine(index, patch)}
              onRemove={() => onRemoveServiceLine(index)}
              assistantPayEnabled={assistantPayEnabled}
              assistantOptions={staffOptions.filter((s) => s.id !== line.staffId)}
              allStaffOptions={staffOptions}
              onChangeStaff={(staffId) => onUpdateServiceLine(index, { staffId })}
            />
          ))}
          {goodsLines.map((line) => (
            <GoodsLineRow
              key={line.id}
              line={line}
              staffOptions={staffOptions}
              requiresCode={goodsCatalog.find((g) => g.id === line.itemId)?.requiresCode ?? false}
              onChange={(patch) => onUpdateGoodsLine(line.id, patch)}
              onRemove={() => onRemoveGoodsLine(line.id)}
            />
          ))}
        </div>
      )}

      {packagePanel}

      <UpsellQuickAdd
        configs={upsellConfigs}
        serviceLines={serviceLines}
        goodsLines={goodsLines}
        services={services}
        goodsCatalog={goodsCatalog}
        onAddService={onAddService}
        onAddGoods={onAddGoods}
      />

      <div className="flex flex-col gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => onActiveTabChange(v as CenterTab)}
          variant="pill"
          items={[
            { value: 'services', label: t('window.center.tabServices') },
            { value: 'goods', label: t('window.center.tabGoods') },
          ]}
        />
        {activeTab === 'services' ? (
          <ServicePicker
            services={services}
            categories={categories}
            frequent={frequentServices}
            lastClientServiceId={lastClientServiceId}
            onAdd={onAddService}
          />
        ) : (
          <GoodsPicker catalog={goodsCatalog} onAdd={onAddGoods} />
        )}
      </div>

      {!notArrived && (
        <div data-f="F-01-061" className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">{t('window.toPay')}</p>
              {/* Уже внесённое (предоплата, частичная оплата) вычтено — та же сумма, что в окне «Оплата визита» */}
              <p className="text-lg font-semibold text-fg">{format.money(paidFully ? total : Math.max(0, total - paidAmount))}</p>
            </div>
            {paidFully ? (
              <div className="text-right">
                <p className="text-sm font-medium text-success">{t('window.paidFull')}</p>
                <button type="button" className="text-xs text-primary-text hover:underline" onClick={onPay}>
                  {t('window.viewDetails')}
                </button>
              </div>
            ) : (
              canPay && (
                <Button data-f="F-01-083" type="button" disabled={total <= 0} loading={paying} onClick={onPay}>
                  {t('window.pay')}
                </Button>
              )
            )}
          </div>
          {notFullyPaid && (
            <div data-f="F-01-079" className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <Badge tone="warning" size="sm">
                {paidAmount > 0 ? t('window.paidPartially', { amount: format.money(paidAmount) }) : t('window.notFullyPaid')}
              </Badge>
              {onCancelPayment && paidAmount > 0 && (
                <Button type="button" size="sm" variant="ghost" loading={cancelingPayment} onClick={onCancelPayment}>
                  {t('window.cancelPayment')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {notArrived && (
        // F-01-082: последствия «Не пришёл» — оплата становится недоступна (блок F-01-061 выше
        // скрыт через `!notArrived`), неявка +1 уже считает ядро (`noShowDelta`, api/core.ts) при
        // смене статуса. Метка — на видимом доказательстве этого пункта.
        <p data-f="F-01-082" className="text-sm text-muted">
          {t('window.notArrivedHint')}
        </p>
      )}
    </div>
  );
}
