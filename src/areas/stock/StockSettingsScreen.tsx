'use client';

/**
 * /biz/stock/settings — F-08-096…098, F-00-140: настройки склада — алгоритм себестоимости, запрет операций
 * при нехватке остатка (F-08-099: сама настройка сохраняется здесь; проверка на реальную нехватку у продажи/
 * списания/перемещения — отдельная пачка) и за сколько дней предупреждать об истекающем сроке годности.
 */
import { useRouter } from 'next/navigation';
import { Receipt, ShieldCheck } from 'lucide-react';
import { getStockSettings, updateStockSettings } from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { CostMethod } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';
import { HelpArticleButton } from '@/areas/stock/HelpArticleButton';

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export function StockSettingsScreen() {
  const t = useT('stock');
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const enabled = ready && Boolean(businessId);

  const q = useApiQuery(['stock', 'settings', businessId], () => getStockSettings(businessId!), { enabled });
  const mutation = useApiMutation((patch: Parameters<typeof updateStockSettings>[1]) => updateStockSettings(businessId!, patch));

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  // Пока настройки грузятся — та же страница: те же карточки и поля, неактивные и пустые (скелетон = страница)
  const settings = q.data;
  const loading = !settings;
  const save = async (patch: Parameters<typeof updateStockSettings>[1]) => {
    try {
      await mutation.mutate(patch);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div data-f="F-08-096 F-08-097 F-08-098 F-08-099 F-00-140" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} actions={<HelpArticleButton titleKey="help.settings.title" bodyKey="help.settings.body" />} />

      <SectionCard title={t('settings.costMethodTitle')}>
        <FormField label={t('settings.costMethod')} hint={t('settings.costMethodHint')}>
          <Select
            value={settings?.costMethod}
            disabled={loading}
            placeholder={loading ? '' : undefined}
            onValueChange={(v) => save({ costMethod: v as CostMethod })}
            options={[
              { value: 'lastPurchase', label: t('settings.costMethodLast') },
              { value: 'average', label: t('settings.costMethodAverage') },
              { value: 'fromGoodSettings', label: t('settings.costMethodGoods') },
            ]}
          />
        </FormField>
      </SectionCard>

      <SectionCard title={t('settings.expiryTitle')}>
        <FormField label={t('settings.expiryWarningDays')} hint={t('settings.expiryWarningDaysHint')}>
          <Select
            value={settings ? String(settings.expiryWarningDays) : undefined}
            disabled={loading}
            placeholder={loading ? '' : undefined}
            onValueChange={(v) => save({ expiryWarningDays: Number(v) })}
            options={DAY_OPTIONS.map((d) => ({ value: String(d), label: t('settings.days', { count: d }) }))}
          />
        </FormField>
      </SectionCard>

      <SectionCard title={t('settings.shortageTitle')}>
        <Checkbox
          checked={settings?.forbidOnShortage ?? false}
          disabled={loading}
          onCheckedChange={(checked) => save({ forbidOnShortage: checked })}
          label={t('settings.shortageLabel')}
          description={t('settings.shortageHint')}
        />
      </SectionCard>

      <div data-f="F-00-165">
        <SectionCard title={t('settings.adsTitle')}>
          <Checkbox
            checked={settings?.adsOptIn ?? false}
            disabled={loading}
            onCheckedChange={(checked) => save({ adsOptIn: checked })}
            label={t('settings.adsLabel')}
            description={t('settings.adsHint')}
          />
        </SectionCard>
      </div>

      {/* F-08-109…118: мелкие права на склад по каждому сотруднику */}
      <SectionCard title={t('settings.accessTitle')} description={t('settings.accessHint')}>
        <Button variant="secondary" leftIcon={<ShieldCheck aria-hidden />} onClick={() => router.push('/biz/stock/settings/access')}>
          {t('settings.accessOpen')}
        </Button>
      </SectionCard>

      {/* F-08-151: покупки товаров клиента — временно здесь, пары clientCard/stock ещё нет */}
      <SectionCard title={t('settings.clientPurchasesTitle')} description={t('settings.clientPurchasesHint')}>
        <Button variant="secondary" leftIcon={<Receipt aria-hidden />} onClick={() => router.push('/biz/stock/clients')}>
          {t('settings.clientPurchasesOpen')}
        </Button>
      </SectionCard>
    </div>
  );
}
