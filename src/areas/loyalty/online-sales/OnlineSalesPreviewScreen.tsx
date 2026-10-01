'use client';

/**
 * /biz/loyalty/online-sales/preview — F-06-151 «Покупка клиентом онлайн»: предпросмотр витрины (то, что
 * увидит клиент по ссылке виджета). Публичный адрес без входа в кабинет — просьба к разделу online
 * (F-06-149/151, qa/requests/loyalty.md); пока ждём — этот экран открывается прямо из кабинета и создаёт
 * настоящий заказ (F-06-148 «Другой способ» — статус «Ждёт оплаты» сразу, без интеграции платежей).
 */
import { useState } from 'react';
import { Check, CreditCard, Gift, ShoppingBag } from 'lucide-react';
import { createOnlineOrder, getOnlineSaleWidget, listOnlineSaleCatalog, type OnlineSaleCatalogItem } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function OnlineSalesPreviewScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const { ready, businessId, locationIds } = useCurrent();
  const { lang } = useDemo();
  const locale = lang === 'en' ? 'en' : 'ru';

  const widgetQ = useApiQuery(['loyalty', 'onlineSaleWidget', businessId], () => getOnlineSaleWidget(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const catalogQ = useApiQuery(['loyalty', 'onlineSaleCatalog', businessId, locale], () => listOnlineSaleCatalog(businessId!, locale), {
    enabled: ready && Boolean(businessId),
  });

  const [buyItem, setBuyItem] = useState<OnlineSaleCatalogItem | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);

  const orderMutation = useApiMutation((args: { itemKind: OnlineSaleCatalogItem['kind']; itemTypeId: string }) =>
    createOnlineOrder(businessId!, {
      itemKind: args.itemKind,
      itemTypeId: args.itemTypeId,
      clientName: name,
      clientPhone: phone,
      locationId: locationIds[0] ?? businessId!,
    }),
  );

  const submit = async () => {
    if (!buyItem || !name.trim() || !phone.trim()) return;
    try {
      await orderMutation.mutate({ itemKind: buyItem.kind, itemTypeId: buyItem.typeId });
      setDone(true);
    } catch {
      toast.error(t('onlineSales.preview.orderFailed'));
    }
  };

  const closeModal = () => {
    setBuyItem(null);
    setName('');
    setPhone('');
    setDone(false);
  };

  if (widgetQ.isLoading || catalogQ.isLoading) return <Skeleton lines={4} />;
  if (widgetQ.isError || catalogQ.isError) return <ErrorState onRetry={() => (widgetQ.refetch(), catalogQ.refetch())} />;

  if (!widgetQ.data?.enabled) {
    return (
      <EmptyState
        icon={<ShoppingBag aria-hidden />}
        title={t('onlineSales.preview.widgetOff')}
        description={t('onlineSales.preview.widgetOffHint')}
      />
    );
  }

  const items = catalogQ.data ?? [];

  return (
    <div data-f="F-06-149 F-06-151 F-08-078" className="mx-auto flex max-w-md flex-col gap-6">
      <PageHeader title={widgetQ.data.title[locale] || widgetQ.data.title.ru} description={t('onlineSales.preview.description')} />
      {items.length === 0 ? (
        <EmptyState icon={<Gift aria-hidden />} title={t('onlineSales.preview.emptyTitle')} description={t('onlineSales.preview.emptyText')} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <SectionCard key={`${item.kind}_${item.typeId}`} title={item.name} padding="sm">
              <div className="flex items-center gap-3">
                {item.kind === 'certificate' ? (
                  <Gift aria-hidden className="size-5 shrink-0 text-primary-text" />
                ) : (
                  <CreditCard aria-hidden className="size-5 shrink-0 text-primary-text" />
                )}
                <div className="min-w-0 flex-1">{item.description && <p className="truncate text-xs text-muted">{item.description}</p>}</div>
                <p className="shrink-0 font-semibold text-fg">{format.money(item.price)}</p>
              </div>
              <Button size="sm" className="mt-3 w-full" onClick={() => setBuyItem(item)}>
                {t('onlineSales.preview.buy')}
              </Button>
            </SectionCard>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(buyItem)}
        onOpenChange={(open) => !open && closeModal()}
        title={done ? t('onlineSales.preview.doneTitle') : t('onlineSales.preview.buyTitle')}
        footer={
          done ? (
            <Button onClick={closeModal}>{t('onlineSales.preview.close')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={closeModal}>
                {t('clientCard.cancel')}
              </Button>
              <Button loading={orderMutation.isPending} disabled={!name.trim() || !phone.trim()} onClick={submit}>
                {t('onlineSales.preview.submit')}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Check aria-hidden className="size-10 text-success" />
            <p className="text-sm text-fg">{t('onlineSales.preview.doneText')}</p>
          </div>
        ) : (
          buyItem && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                {buyItem.name} · {format.money(buyItem.price)}
              </p>
              <FormField label={t('onlineSales.preview.nameLabel')}>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <FormField label={t('onlineSales.preview.phoneLabel')}>
                <PhoneInput value={phone} onValueChange={setPhone} />
              </FormField>
              <p className="text-xs text-muted">{t('onlineSales.preview.paymentHint')}</p>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
