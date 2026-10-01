'use client';

import { useState } from 'react';
import { coreGet, coreUpdate } from '@/api/core';
import { getServiceOnlineConfig, updateServiceOnlineConfig } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { LocaleCode, LocalizedText } from '@/domain/core';
import type { ServiceAvailabilityDays } from '@/domain/online';
import type { ServiceCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { Tabs } from '@/ui/Tabs';
import { TimePicker } from '@/ui/TimePicker';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const EMPTY_TEXT: LocalizedText = { ru: '', en: '', hy: '' };
/** F-03-115: онлайн-название/описание переводятся отдельно на каждый язык виджета, не копируются */
const CARD_LOCALES: LocaleCode[] = ['ru', 'en', 'hy'];

/**
 * Вклад раздела «online» в карточку услуги (хост «serviceCard»): вкладка «Онлайн-запись» (F-03-129) —
 * тумблер, онлайн-название, описание, картинка, ограничение по времени; для пакетов (F-03-130) —
 * то же плюс запись «Онлайн — только один пакет за раз» (пакетов в ядре пока нет, см. qa/requests/online.md).
 * Посмотреть вклад без хозяина хоста: /dev/ext/serviceCard/online
 */
export default function OnlineServiceCard({ mode, serviceId, businessId }: ServiceCardExtProps) {
  const t = useT('online');
  const toast = useToast();

  const serviceQ = useApiQuery(['online-servicecard', serviceId], () => coreGet('services', serviceId!), { enabled: Boolean(serviceId) });
  const configQ = useApiQuery(['online-servicecard-config', serviceId], () => getServiceOnlineConfig(serviceId!), { enabled: Boolean(serviceId) });
  const bookableMutation = useApiMutation((v: boolean) => coreUpdate('services', serviceId!, { onlineBookable: v }));
  const configMutation = useApiMutation((patch: Parameters<typeof updateServiceOnlineConfig>[1]) => updateServiceOnlineConfig(serviceId!, patch));

  // F-03-115: онлайн-название и описание — LocalizedText (по языку виджета), а не одна строка на все языки
  const [textLocale, setTextLocale] = useState<LocaleCode>('ru');
  const [onlineName, setOnlineName] = useState<LocalizedText>(EMPTY_TEXT);
  const [description, setDescription] = useState<LocalizedText>(EMPTY_TEXT);
  const [days, setDays] = useState<ServiceAvailabilityDays>('any');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [hoursFrom, setHoursFrom] = useState('');
  const [hoursTo, setHoursTo] = useState('');
  const [subscriptionOnly, setSubscriptionOnly] = useState(false);
  const [subscriptionPlanName, setSubscriptionPlanName] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  // Подхватываем поля из загруженного конфига прямо при рендере (не в эффекте, как LinkSettingsScreen) —
  // так форма не мигает лишним рендером и не ловит react-hooks/set-state-in-effect.
  const [loadedConfigFor, setLoadedConfigFor] = useState<string | null>(null);
  if (configQ.data && serviceId !== loadedConfigFor) {
    setOnlineName(configQ.data.onlineName ?? EMPTY_TEXT);
    setDescription(configQ.data.description ?? EMPTY_TEXT);
    setDays(configQ.data.availability?.days ?? 'any');
    setPeriodFrom(configQ.data.availability?.periodFrom ?? '');
    setPeriodTo(configQ.data.availability?.periodTo ?? '');
    setHoursFrom(configQ.data.availability?.hoursFrom ?? '');
    setHoursTo(configQ.data.availability?.hoursTo ?? '');
    setSubscriptionOnly(configQ.data.subscriptionOnly ?? false);
    setSubscriptionPlanName(configQ.data.subscriptionPlanName ?? '');
    setImageUrls(configQ.data.imageUrl ? [configQ.data.imageUrl] : []);
    setLoadedConfigFor(serviceId ?? null);
  }

  // F-03-129/130 (добавлено проверкой 2): у НОВОЙ, ещё не сохранённой услуги вкладка «Онлайн-запись»
  // недоступна — все её настройки открываются только после первого сохранения (02-services.md).
  if (mode === 'create' || !serviceId) {
    return <EmptyState title={t('serviceCard.saveFirstTitle')} description={t('serviceCard.saveFirstDescription')} />;
  }

  // До данных — та же вкладка с пустыми полями, без ввода (inert); поля заполнятся из конфига без перестройки
  const loading = serviceQ.isLoading || configQ.isLoading;
  if (!loading && (serviceQ.isError || !serviceQ.data)) {
    return <p className="text-sm text-muted">{t('staffCard.loadFailed')}</p>;
  }

  const service = serviceQ.data;
  const isPackage = false; // ⭐ в ядре пока нет типа «пакет» (Service.kind — только individual/group), см. qa/requests/online.md
  void businessId;

  const saveField = async (patch: Parameters<typeof updateServiceOnlineConfig>[1], successKey: string) => {
    try {
      await configMutation.mutate(patch);
      toast.success(t(successKey as never));
      configQ.refetch();
    } catch {
      toast.error(t('page.brands.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4" data-f="F-03-129" inert={loading} aria-busy={loading || undefined}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">{t('serviceCard.onlineToggle')}</span>
        <Switch
          checked={service?.onlineBookable ?? true}
          disabled={bookableMutation.isPending}
          onCheckedChange={async (checked) => {
            try {
              await bookableMutation.mutate(checked);
              toast.success(checked ? t('serviceCard.onlineOn') : t('serviceCard.onlineOff'));
              serviceQ.refetch();
            } catch {
              toast.error(t('staffCard.updateFailed'));
            }
          }}
        />
      </div>

      {/* F-03-115: у названия и описания — отдельный перевод на каждый язык виджета, не одна строка на все */}
      <div className="flex flex-col gap-3" data-f="F-03-115">
        <Tabs variant="pill" value={textLocale} onValueChange={(v) => setTextLocale(v as LocaleCode)} items={CARD_LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))} />

        <FormField label={t('serviceCard.onlineName')} hint={t('serviceCard.onlineNameHint')}>
          <Input
            value={onlineName[textLocale] ?? ''}
            onChange={(e) => setOnlineName((prev) => ({ ...prev, [textLocale]: e.target.value }))}
            onBlur={() => saveField({ onlineName }, 'settings.saved')}
            maxLength={60}
          />
        </FormField>

        <FormField label={t('serviceCard.description')} optional>
          <div>
            <Textarea
              value={description[textLocale] ?? ''}
              onChange={(e) => setDescription((prev) => ({ ...prev, [textLocale]: e.target.value.slice(0, 450) }))}
              onBlur={() => saveField({ description }, 'settings.saved')}
              maxLength={450}
              rows={3}
            />
            <p className="mt-1 text-right text-xs text-muted">{(description[textLocale] ?? '').length}/450</p>
          </div>
        </FormField>
      </div>

      <FormField label={t('serviceCard.image')} optional>
        <ImageUpload
          value={imageUrls}
          onValueChange={(urls) => {
            setImageUrls(urls);
            saveField({ imageUrl: urls[0] }, 'settings.saved');
          }}
          aspect="16/9"
          maxSizeMb={12}
          label={t('serviceCard.imageUpload')}
        />
      </FormField>

      <div className="flex flex-col gap-2" data-f="F-03-096">
        <Checkbox
          checked={subscriptionOnly}
          onCheckedChange={(v) => {
            setSubscriptionOnly(v);
            saveField(v ? { subscriptionOnly: v } : { subscriptionOnly: v, subscriptionPlanName: undefined }, 'settings.saved');
          }}
          label={t('serviceCard.subscriptionOnly')}
        />
        {subscriptionOnly && (
          <FormField label={t('serviceCard.subscriptionPlanName')} hint={t('serviceCard.subscriptionPlanNameHint')} optional>
            <Input
              value={subscriptionPlanName}
              onChange={(e) => setSubscriptionPlanName(e.target.value)}
              onBlur={() => saveField({ subscriptionPlanName: subscriptionPlanName.trim() || undefined }, 'settings.saved')}
              maxLength={80}
            />
          </FormField>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
        <p className="text-sm font-medium text-fg">{t('serviceCard.availability.title')}</p>
        <div className="grid grid-cols-2 gap-2">
          <FormField label={t('serviceCard.availability.from')} optional>
            <DatePicker
              value={periodFrom || null}
              onValueChange={(v) => {
                setPeriodFrom(v ?? '');
                saveField({ availability: { days, periodFrom: v ?? undefined, periodTo: periodTo || undefined, hoursFrom: hoursFrom || undefined, hoursTo: hoursTo || undefined } }, 'settings.saved');
              }}
            />
          </FormField>
          <FormField label={t('serviceCard.availability.to')} optional>
            <DatePicker
              value={periodTo || null}
              onValueChange={(v) => {
                setPeriodTo(v ?? '');
                saveField({ availability: { days, periodFrom: periodFrom || undefined, periodTo: v ?? undefined, hoursFrom: hoursFrom || undefined, hoursTo: hoursTo || undefined } }, 'settings.saved');
              }}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FormField label={t('serviceCard.availability.hoursFrom')} optional>
            <TimePicker
              value={hoursFrom || null}
              onValueChange={(v) => {
                setHoursFrom(v);
                saveField({ availability: { days, periodFrom: periodFrom || undefined, periodTo: periodTo || undefined, hoursFrom: v || undefined, hoursTo: hoursTo || undefined } }, 'settings.saved');
              }}
            />
          </FormField>
          <FormField label={t('serviceCard.availability.hoursTo')} optional>
            <TimePicker
              value={hoursTo || null}
              onValueChange={(v) => {
                setHoursTo(v);
                saveField({ availability: { days, periodFrom: periodFrom || undefined, periodTo: periodTo || undefined, hoursFrom: hoursFrom || undefined, hoursTo: v || undefined } }, 'settings.saved');
              }}
            />
          </FormField>
        </div>
        <FormField label={t('serviceCard.availability.days')}>
          <Select
            value={days}
            onValueChange={(v) => {
              const next = v as ServiceAvailabilityDays;
              setDays(next);
              saveField({ availability: { days: next, periodFrom: periodFrom || undefined, periodTo: periodTo || undefined, hoursFrom: hoursFrom || undefined, hoursTo: hoursTo || undefined } }, 'settings.saved');
            }}
            options={[
              { value: 'any', label: t('serviceCard.availability.any') },
              { value: 'weekdays', label: t('serviceCard.availability.weekdays') },
              { value: 'weekends', label: t('serviceCard.availability.weekends') },
            ]}
          />
        </FormField>
      </div>

      {isPackage && <p className="text-sm text-muted">{t('serviceCard.packageOneAtATime')}</p>}
    </div>
  );
}
