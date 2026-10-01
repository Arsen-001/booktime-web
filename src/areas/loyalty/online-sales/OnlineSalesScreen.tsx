'use client';

/**
 * /biz/loyalty/online-sales — «Онлайн-продажи»: вкладка «Оплата» (F-06-148 — способ оплаты «Другой
 * способ», филиал выручки для сети, email уведомлений) и вкладка «Виджет» (F-06-149 — оформление,
 * включение, ссылка, предпросмотр). Публичный адрес самой витрины — просьба к разделу online
 * (qa/requests/loyalty.md); пока ждём — открывается собственный предпросмотр /biz/loyalty/online-sales/preview.
 */
import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Eye, Mail } from 'lucide-react';
import { coreList } from '@/api/core';
import { getOnlineSalePayment, getOnlineSaleWidget, setOnlineSalePayment, setOnlineSaleWidget } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import { defaultOnlineSalePayment, defaultOnlineSaleWidget, type OnlineSalePaymentSettings, type OnlineSaleWidgetSettings } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button, LinkButton } from '@/ui/Button';
import { ColorPicker } from '@/ui/ColorPicker';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

function PaymentTab({ businessId }: { businessId: string }) {
  const t = useT('loyalty');
  const toast = useToast();
  const { ready, networkId, locationIds } = useCurrent();
  const { lang } = useDemo();
  const locale = lang === 'en' ? 'en' : 'ru';
  const q = useApiQuery(['loyalty', 'onlineSalePayment', businessId], () => getOnlineSalePayment(businessId), { enabled: ready && Boolean(businessId) });
  const locationsQ = useApiQuery(['loyalty', 'locationsForOnlineSales', businessId], () => coreList('locations', { businessId }), { enabled: ready && Boolean(networkId) });
  const locationOptions = useMemo(
    () => (locationsQ.data ?? []).filter((l) => locationIds.includes(l.id)).map((l) => ({ value: l.id, label: pickText(l.name, locale) })),
    [locationsQ.data, locationIds, locale],
  );
  const [localDraft, setLocalDraft] = useState<OnlineSalePaymentSettings | null>(null);
  // Загрузка — та же форма со значениями по умолчанию, поля выключены: пришли настройки — ничего не сдвинулось
  const loading = q.isLoading || !(localDraft ?? q.data);
  const draft = localDraft ?? q.data ?? defaultOnlineSalePayment();
  const setDraft = setLocalDraft;
  const saveMutation = useApiMutation((value: OnlineSalePaymentSettings) => setOnlineSalePayment(businessId, value));

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const save = async () => {
    try {
      await saveMutation.mutate(draft);
      toast.success(t('onlineSales.saved'));
    } catch {
      toast.error(t('onlineSales.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t('onlineSales.payment.methodTitle')} padding="sm">
        <Switch checked={draft.otherMethodEnabled} disabled={loading} onCheckedChange={(v) => setDraft({ ...draft, otherMethodEnabled: v })} label={t('onlineSales.payment.otherMethod')} description={t('onlineSales.payment.otherMethodHint')} />
        {draft.otherMethodEnabled && (
          <div className="mt-3">
            <FormField label={t('onlineSales.payment.detailsLabel')}>
              <Textarea value={draft.otherMethodDetails ?? ''} disabled={loading} onChange={(e) => setDraft({ ...draft, otherMethodDetails: e.target.value })} placeholder={t('onlineSales.payment.detailsPlaceholder')} maxLength={500} autoResize />
            </FormField>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">{t('onlineSales.payment.cardDisabledHint')}</p>
      </SectionCard>

      {Boolean(networkId) && (
        <SectionCard title={t('onlineSales.payment.revenueLocationTitle')} padding="sm">
          <FormField label={t('onlineSales.payment.revenueLocationLabel')}>
            <Select
              value={draft.revenueLocationId ?? ''}
              disabled={loading}
              onValueChange={(v) => setDraft({ ...draft, revenueLocationId: v || undefined })}
              options={locationOptions}
              placeholder={t('onlineSales.payment.revenueLocationPlaceholder')}
            />
          </FormField>
        </SectionCard>
      )}

      <SectionCard title={t('onlineSales.payment.notifyTitle')} padding="sm">
        <FormField label={t('onlineSales.payment.emailLabel')}>
          <Input value={draft.notifyEmail ?? ''} disabled={loading} onChange={(e) => setDraft({ ...draft, notifyEmail: e.target.value })} placeholder="shop@example.com" leftIcon={<Mail aria-hidden />} />
        </FormField>
      </SectionCard>

      <Button loading={saveMutation.isPending} disabled={loading} onClick={save} className="self-start">
        {t('onlineSales.save')}
      </Button>
    </div>
  );
}

function WidgetTab({ businessId }: { businessId: string }) {
  const t = useT('loyalty');
  const toast = useToast();
  const { ready } = useCurrent();
  const { lang } = useDemo();
  const locale = lang === 'en' ? 'en' : 'ru';
  const q = useApiQuery(['loyalty', 'onlineSaleWidget', businessId], () => getOnlineSaleWidget(businessId), { enabled: ready && Boolean(businessId) });
  const [localDraft, setLocalDraft] = useState<OnlineSaleWidgetSettings | null>(null);
  // Загрузка — та же форма со значениями по умолчанию, поля выключены
  const loading = q.isLoading || !(localDraft ?? q.data);
  const draft = localDraft ?? q.data ?? defaultOnlineSaleWidget();
  const setDraft = setLocalDraft;
  const saveMutation = useApiMutation((value: OnlineSaleWidgetSettings) => setOnlineSaleWidget(businessId, value));

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const save = async () => {
    try {
      await saveMutation.mutate(draft);
      toast.success(t('onlineSales.saved'));
    } catch {
      toast.error(t('onlineSales.saveFailed'));
    }
  };

  const previewUrl = typeof window !== 'undefined' ? `${window.location.origin}/biz/loyalty/online-sales/preview` : '/biz/loyalty/online-sales/preview';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success(t('onlineSales.widget.linkCopied'));
    } catch {
      toast.error(t('onlineSales.widget.linkCopyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t('onlineSales.widget.title')} padding="sm">
        <Switch checked={draft.enabled} disabled={loading} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} label={t('onlineSales.widget.enable')} description={t('onlineSales.widget.enableHint')} />
        <div className="mt-3 flex flex-col gap-3">
          <FormField label={t('onlineSales.widget.titleLabel')}>
            <Input value={draft.title[locale] ?? ''} disabled={loading} onChange={(e) => setDraft({ ...draft, title: { ...draft.title, ru: draft.title.ru ?? '', [locale]: e.target.value } })} maxLength={80} />
          </FormField>
          <ColorPicker value={draft.accentColorIndex} onValueChange={(idx) => setDraft({ ...draft, accentColorIndex: idx })} label={t('onlineSales.widget.colorLabel')} />
        </div>
      </SectionCard>

      {draft.enabled && (
        <SectionCard title={t('onlineSales.widget.linkTitle')} padding="sm">
          <div className="flex items-center gap-2">
            <Input value={previewUrl} readOnly className="flex-1" />
            <Button size="sm" variant="outline" leftIcon={<Copy aria-hidden />} onClick={copyLink}>
              {t('onlineSales.widget.copy')}
            </Button>
          </div>
          <LinkButton href="/biz/loyalty/online-sales/preview" target="_blank" variant="outline" size="sm" leftIcon={<Eye aria-hidden />} className="mt-3">
            {t('onlineSales.widget.preview')}
          </LinkButton>
        </SectionCard>
      )}

      <Button loading={saveMutation.isPending} disabled={loading} onClick={save} className="self-start">
        {t('onlineSales.save')}
      </Button>
    </div>
  );
}

export function OnlineSalesScreen() {
  const t = useT('loyalty');
  const { businessId: current } = useCurrent();
  // До выбора бизнеса — та же страница: вкладки на месте, формы ждут (запросы включатся с businessId)
  const businessId = current ?? '';

  return (
    <div data-f="F-06-148 F-06-149 F-06-153" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('onlineSales.title')} description={t('onlineSales.description')} />
      <LinkButton href="/biz/loyalty/online-sales/orders" variant="outline" size="sm" leftIcon={<ExternalLink aria-hidden />} className="self-start">
        {t('onlineSales.ordersLink')}
      </LinkButton>
      <Tabs
        items={[
          { value: 'payment', label: t('onlineSales.tabs.payment') },
          { value: 'widget', label: t('onlineSales.tabs.widget') },
        ]}
        defaultValue="payment"
        panels={{ payment: <PaymentTab businessId={businessId} />, widget: <WidgetTab businessId={businessId} /> }}
      />
    </div>
  );
}
