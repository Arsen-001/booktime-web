'use client';

/**
 * /biz/notifications/types/[typeId] и /types/[typeId]/templates — страница типа уведомления:
 * каркас (F-05-005), блок «Отправка уведомлений» со сценариями (F-05-006, F-05-007, F-05-008),
 * условия отправки конкретного типа (F-05-009, F-05-024…F-05-040), вкладка «Шаблоны уведомлений»
 * (F-05-013): текст по каналам (F-05-014…F-05-020), предпросмотр (F-05-021), переменные (F-05-022,
 * F-05-023), язык и формат уведомлений (F-05-010, F-05-011), имя отправителя (F-05-012).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Bell, Bold, Italic, Smartphone, Strikethrough, Underline } from 'lucide-react';
import { getNotifySettings, getType, listChannels, updateType } from '@/api/notify';
import { useMessageLanguage } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { coreGet, useCoreList } from '@/api/core';
import { SmsCounter } from '@/areas/notify/components/SmsCounter';
import { previewDelivery } from '@/areas/notify/lib/engine';
import {
  LEGACY_VARIABLES,
  SYSTEM_TYPE7_TEMPLATES,
  VARIABLES,
  channelLabel,
  previewData,
  recipientLabel,
  renderTemplate,
  smsPreviewData,
  smsVariants,
  variableLabel,
} from '@/areas/notify/lib/registry';
import { typeOptimistic } from '@/areas/notify/lib/typeOptimistic';
import { isServerSoonType } from '@/areas/notify/lib/serverSoon';
import { NOTIFY_LANGUAGE_OPTIONS } from '@/areas/notify/types/NotifySettingsCard';
import { HINT_FUTURE_ONLY_TYPES, TYPES_WITH_CONDITIONS, TypeConditionsFields } from '@/areas/notify/types/TypeConditionsFields';
import type {
  EmailExtra,
  NotifyChannel,
  NotifyChannelSetting,
  NotifyDateFormat,
  NotifyLanguage,
  NotifyScenario,
  TypeConditions,
} from '@/domain/notify';
import { NOTIFY_LANGUAGES } from '@/domain/notify';
import type { Locale } from '@/i18n/config';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { Popover } from '@/ui/Popover';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

/** F-05-042: письма этих типов показывают условия политики оплаты, если она действует на запись */
const ATTENDANCE_TYPES_WITH_POLICY = new Set([2, 8, 9, 74]);

const SCENARIO_OPTIONS_2 = ['off', 'always'] as const;
const SCENARIO_OPTIONS_3 = ['off', 'always', 'fallback'] as const;
const EMOJI_LIST = ['😊', '💇‍♀️', '📅', '⏰', '🎉', '💳'];

/**
 * Отрисовывает **жирный**, _курсив_, __подчёркнутый__ и ~~зачёркнутый~~ в предпросмотре (F-05-015):
 * маркеры, которые ставят кнопки формата, иначе так и остались бы видимым текстом.
 */
function renderFormattedText(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|_[^_]+_)/g;
  const parts = text.split(pattern).filter((p) => p !== '');
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('__') && part.endsWith('__')) return <u key={i}>{part.slice(2, -2)}</u>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <s key={i}>{part.slice(2, -2)}</s>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function scenarioLabel(t: ReturnType<typeof useT<'notify'>>, scenario: NotifyScenario): string {
  if (scenario === 'off') return t('typeDetail.scenario.off');
  if (scenario === 'always') return t('typeDetail.scenario.always');
  return t('typeDetail.scenario.fallback');
}

export function TypeDetailScreen({ tab }: { tab: 'basic' | 'templates' }) {
  const t = useT('notify');
  const toast = useToast();
  const router = useRouter();
  // Язык интерфейса кабинета (заголовки, подписи каналов) — отдельно от языка сообщений клиенту (`lang` ниже, F-05-010)
  const uiLocale = useLocale() as Locale;
  const params = useParams<{ typeId: string }>();
  const code = Number(params.typeId);
  const { ready, businessId } = useCurrent();
  const [pendingSave, setPendingSave] = useState(false);

  // Ув3: язык, который правим в редакторе, — свой переключатель, отдельно от языка отправки салона
  // (раньше править hy/en можно было только сменой языка отправки для ВСЕХ клиентов). null — язык отправки.
  const [editLangChoice, setEditLangChoice] = useState<NotifyLanguage | null>(null);
  // Черновики по паре «канал:язык» (Ув3): переключение языка не переносит русский черновик в армянский шаблон
  const [draftTemplates, setDraftTemplates] = useState<Partial<Record<string, string>>>({});
  const [draftEmailExtra, setDraftEmailExtra] = useState<EmailExtra | null>(null);
  const [activeChannel, setActiveChannel] = useState<NotifyChannel | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const textareaRefs = useRef<Partial<Record<NotifyChannel, HTMLTextAreaElement | null>>>({});
  const emailExtraTextRef = useRef<HTMLTextAreaElement | null>(null);

  const typeQ = useApiQuery(['notify', 'type', businessId, code], () => getType(businessId!, code), {
    enabled: ready && !!businessId && Number.isFinite(code),
  });
  const channelsQ = useApiQuery(['notify', 'channels', businessId], () => listChannels(businessId!), { enabled: ready && !!businessId });
  const settingsQ = useApiQuery(['notify', 'settings', businessId], () => getNotifySettings(businessId!), { enabled: ready && !!businessId });
  const businessQ = useApiQuery(['core', 'business', businessId], () => coreGet('businesses', businessId!), { enabled: ready && !!businessId });
  // Ув7: предпросмотр — на данных самого салона (адрес, услуга, мастер), а не на выдуманной «Мимозе»
  const locationsQ = useCoreList('locations', { businessId }, { enabled: ready && !!businessId });
  const servicesQ = useCoreList('services', { businessId }, { enabled: ready && !!businessId });
  const staffQ = useCoreList('staff', { businessId }, { enabled: ready && !!businessId });
  // Ув4: сценарии каналов, тумблер и условия — оптимистично, без перечитывания и блокировки всех полей
  const save = useApiMutation(updateType, { optimistic: typeOptimistic });

  const type = typeQ.data;
  // Н5: язык отправки — единый, из «Системных» (useMessageLanguage), а не своя копия уведомлений
  const sendLang: NotifyLanguage = useMessageLanguage(businessId, { enabled: ready });
  const lang: NotifyLanguage = editLangChoice ?? sendLang;
  // F-05-012: бренд для клиентов — Business.brandName; пусто — название локации (core-k3).
  const senderName = businessQ.data?.brandName || businessQ.data?.name || '';

  const preview = useMemo(() => (type ? previewDelivery(type, true) : null), [type]);
  const previewNoApp = useMemo(() => (type ? previewDelivery(type, false) : null), [type]);
  const dateFormat: NotifyDateFormat = settingsQ.data?.dateFormat ?? '24h';
  const business = businessQ.data;
  const location = locationsQ.data?.[0];
  const sampleService = servicesQ.data?.find((sv) => sv.active) ?? servicesQ.data?.[0];
  const sampleStaff = staffQ.data?.find((st) => sampleService?.staffIds.includes(st.id)) ?? staffQ.data?.[0];
  // F-05-011: {date}/{time}/{dateTime} в предпросмотре меняются вслед за форматом; Ув7 — данные салона и язык шаблона
  const testData = previewData(lang, dateFormat, {
    companyName: business?.brandName || business?.name,
    slug: business?.slug,
    companyPhone: location?.phone || business?.phone,
    website: business?.socials?.website,
    address: location?.address,
    service: sampleService?.name,
    staff: sampleStaff?.name,
  });
  // 28.09: в SMS ссылки уходят короткими (booktime.am/s/…) — предпросмотр и счётчик частей считают так же
  const smsTestData = smsPreviewData(testData);
  const templatesDirty = Object.keys(draftTemplates).length > 0 || draftEmailExtra !== null;
  // Ув9: уход со страницы с несохранённым шаблоном — сначала вопрос
  const { confirmLeave } = useUnsavedGuard(templatesDirty);

  // F-05-009/024-040: последняя известная версия conditions, обновляется синхронно на каждый рендер (когда
  // ничего не в полёте) И сразу при отправке нового патча — иначе вторая правка подряд мержится поверх
  // УСТАРЕВШЕГО замыкания и тихо теряет первую (см. saveConditionsPatch).
  const conditionsRef = useRef<TypeConditions>({});
  const conditionsInFlightRef = useRef(0);
  const conditionsSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const conditions: TypeConditions = useMemo(() => type?.conditions ?? {}, [type]);
  // Синхронизируем ref со свежими данными сервера, но только когда ни одна правка условий не в полёте —
  // иначе перетираем оптимистичный результат первого клика данными, снятыми до него (эффект, не рендер:
  // мутировать ref во время рендера запрещено правилом react-hooks/refs).
  useEffect(() => {
    if (conditionsInFlightRef.current === 0) {
      conditionsRef.current = conditions;
    }
  }, [conditions]);

  // ux-r5 M21: шапка с «‹ Назад» должна остаться видна и при ошибке — иначе с экрана можно уйти только бургером
  if (typeQ.isError || channelsQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader back={{ href: '/biz/notifications', label: t('title') }} title={t('title')} />
        <ErrorState onRetry={() => (typeQ.isError ? typeQ.refetch() : channelsQ.refetch())} />
      </div>
    );
  }
  if (!ready || typeQ.isLoading || channelsQ.isLoading) {
    // Скелет в форме страницы (шапка, вкладки, карточка) — не «полоски текста» на всю ширину
    return (
      <div aria-hidden className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton variant="rect" className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (!type) return <ErrorState title={t('typeDetail.notFound')} onRetry={() => router.push('/biz/notifications')} />;

  // ⭐ Telegram — наш бесплатный бот (напоминания 1/73, код входа 7), WhatsApp кода входа (7) — канал платформы: бизнесу
  // подключать нечего. Раньше у них стояла «Подключить», ведущая во вкладку каналов, где их нет, — тупик.
  const connectedSet = new Set<NotifyChannel>([
    ...(channelsQ.data ?? []).filter((c) => c.connected).map((c) => c.channel),
    'telegram',
    ...(code === 7 ? (['whatsapp'] as const) : []),
  ]);

  const draftKey = (channel: NotifyChannel) => `${channel}:${lang}`;
  /** Нет своего текста на этом языке — показываем русский как основу для перевода (сохранится уже на этом языке) */
  const savedText = (channel: NotifyChannel): string => type.templates[channel]?.[lang] ?? type.templates[channel]?.ru ?? '';
  const templateText = (channel: NotifyChannel): string => draftTemplates[draftKey(channel)] ?? savedText(channel);
  const setDraft = (channel: NotifyChannel, text: string) =>
    setDraftTemplates((d) => {
      const key = draftKey(channel);
      if (text === savedText(channel)) {
        const next = { ...d };
        delete next[key];
        return next;
      }
      return { ...d, [key]: text };
    });

  const setScenario = async (channel: NotifyChannel, scenario: NotifyScenario) => {
    const nextChannels: NotifyChannelSetting[] = type.channels.map((c) => (c.channel === channel ? { ...c, scenario } : c));
    try {
      await save.mutate({ businessId: businessId!, code, patch: { channels: nextChannels } });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    try {
      await save.mutate({ businessId: businessId!, code, patch: { enabled } });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const saveConditionsPatch = (patch: Partial<TypeConditions>) => {
    // Мержим поверх ref (последний ОТПРАВЛЕННЫЙ, не последний ПОЛУЧЕННЫЙ с сервера набор условий) и сразу
    // обновляем ref — синхронно, до await — так что вторая правка, кликнутая пока первая ещё в полёте,
    // видит уже смерженный результат первой, а не устаревшее замыкание рендера.
    const merged = { ...conditionsRef.current, ...patch };
    conditionsRef.current = merged;
    conditionsInFlightRef.current += 1;
    const run = async () => {
      try {
        await save.mutate({ businessId: businessId!, code, patch: { conditions: merged } });
      } catch {
        toast.error(t('typeDetail.saveFailed'));
      } finally {
        conditionsInFlightRef.current -= 1;
      }
    };
    // Очередь сериализует фактическую отправку — так итоговая запись на сервере всегда соответствует
    // порядку кликов, даже если сетевые ответы придут не по порядку.
    conditionsSaveQueueRef.current = conditionsSaveQueueRef.current.then(run, run);
    return conditionsSaveQueueRef.current;
  };

  const saveTemplates = async () => {
    setPendingSave(true);
    try {
      const templatesPatch: Partial<Record<NotifyChannel, Partial<{ ru: string; hy?: string; en?: string }>>> = {};
      for (const [key, text] of Object.entries(draftTemplates)) {
        if (text === undefined) continue;
        const [channel, draftLang] = key.split(':') as [NotifyChannel, NotifyLanguage];
        templatesPatch[channel] = { ...templatesPatch[channel], [draftLang]: text };
      }
      await save.mutate({
        businessId: businessId!,
        code,
        patch: { templates: Object.keys(templatesPatch).length ? templatesPatch : undefined, emailExtra: draftEmailExtra ?? undefined },
      });
      setDraftTemplates({});
      setDraftEmailExtra(null);
      toast.success(t('typeDetail.saved'));
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    } finally {
      setPendingSave(false);
    }
  };

  const insertToken = (channel: NotifyChannel | null, token: string) => {
    if (!channel) return;
    const el = textareaRefs.current[channel];
    const current = templateText(channel);
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      setDraft(channel, next);
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + token.length;
      });
    } else {
      setDraft(channel, current + token);
    }
  };

  const wrapEmailExtraText = (marker: string) => {
    const el = emailExtraTextRef.current;
    const extra = draftEmailExtra ?? type.emailExtra ?? { enabled: true, indent: false, text: '' };
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = extra.text;
    const next = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
    setDraftEmailExtra({ ...extra, text: next });
  };

  const emailExtra = draftEmailExtra ?? type.emailExtra ?? { enabled: false, indent: false, text: '' };
  const emailMainText = renderTemplate(templateText('email'), testData);
  const showConditions = TYPES_WITH_CONDITIONS.has(code);

  return (
    <div data-f="F-05-005" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      {/* Метка функции ТЗ конкретно этого клиентского типа (F-05-024…F-05-040) — literal data-f на код,
          иначе node scripts/fids.mjs (статический разбор текста) не находит её через CLIENT_TYPE_FID. */}
      {code === 2 && <i data-f="F-05-024" hidden />}
      {code === 8 && <i data-f="F-05-025" hidden />}
      {code === 9 && <i data-f="F-05-026 F-01-087" hidden />}
      {code === 74 && <i data-f="F-05-027 F-01-117" hidden />}
      {code === 73 && <i data-f="F-05-028 F-01-088" hidden />}
      {code === 1 && <i data-f="F-05-029" hidden />}
      {code === 4 && <i data-f="F-05-030 F-01-125" hidden />}
      {code === 75 && <i data-f="F-05-031" hidden />}
      {code === 72 && <i data-f="F-05-032" hidden />}
      {(code === 6 || code === 20) && <i data-f="F-05-033" hidden />}
      {code === 3 && <i data-f="F-05-034" hidden />}
      {code === 16 && <i data-f="F-05-035" hidden />}
      {code === 17 && <i data-f="F-05-036" hidden />}
      {code === 55 && <i data-f="F-05-037" hidden />}
      {code === 85 && <i data-f="F-05-038" hidden />}
      {code === 7 && <i data-f="F-05-039" hidden />}
      {code === 65 && <i data-f="F-05-040" hidden />}
      {code === 10 && <i data-f="F-05-044 F-14-133" hidden />}
      {code === 56 && <i data-f="F-05-045" hidden />}
      {code === 41 && <i data-f="F-05-046" hidden />}
      {code === 12 && <i data-f="F-05-047" hidden />}
      {code === 19 && <i data-f="F-05-048" hidden />}
      {code === 11 && <i data-f="F-05-049" hidden />}
      {code === 57 && <i data-f="F-05-050" hidden />}
      {code === 42 && <i data-f="F-05-051" hidden />}
      {code === 13 && <i data-f="F-05-052" hidden />}
      {code === 76 && <i data-f="F-05-053" hidden />}
      {code === 43 && <i data-f="F-05-054" hidden />}
      <PageHeader
        back={{ href: '/biz/notifications', label: t('title') }}
        title={type.name[uiLocale] ?? type.name.ru}
        description={type.description[uiLocale] ?? type.description.ru}
        meta={
          <>
            <Badge tone="neutral" size="sm">
              {recipientLabel(type.recipient, uiLocale)}
            </Badge>
            {/* Со свитчем «Тип включён» в actions бейдж дублировал бы то же состояние вторым способом
                (ux-r5 §2) — показываем бейдж только там, где свитча нет (alwaysOn: тип 7, код входа). */}
            {type.alwaysOn && (
              <Badge tone={type.enabled ? 'success' : 'neutral'} size="sm">
                {type.enabled ? t('typeDetail.enabled') : t('typeDetail.disabled')}
              </Badge>
            )}
          </>
        }
        actions={
          !type.alwaysOn ? (
            <Switch checked={type.enabled} onCheckedChange={toggleEnabled} label={t('typeDetail.enableToggle')} />
          ) : undefined
        }
      />

      <Tabs
        variant="line"
        value={tab}
        onValueChange={async (value) => {
          if (!(await confirmLeave())) return;
          router.push(value === 'basic' ? `/biz/notifications/types/${code}` : `/biz/notifications/types/${code}/templates`);
        }}
        items={[
          { value: 'basic', label: t('typeDetail.tabs.basic') },
          { value: 'templates', label: t('typeDetail.tabs.templates') },
        ]}
      />

      {tab === 'basic' ? (
        <div data-f="F-05-006 F-05-007 F-05-008 F-05-009 F-14-066" className="flex flex-col gap-6">
          {type.systemLocked && (
            <p data-f="F-05-020" className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
              {t('typeDetail.systemLockedBanner')}
            </p>
          )}
          {isServerSoonType(type.code) && (
            <p role="status" className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
              {t('typeDetail.soonBanner')}
            </p>
          )}
          <SectionCard title={t('typeDetail.channelsTitle')} description={t('typeDetail.channelsHint')}>
            <ul className="flex flex-col divide-y divide-border">
              {type.availableChannels.map((channel) => {
                const connected = connectedSet.has(channel);
                const setting = type.channels.find((c) => c.channel === channel);
                const scenario = setting?.scenario ?? 'off';
                const hasFallback = channel === 'sms' || channel === 'brandedApp';
                const options = (hasFallback ? SCENARIO_OPTIONS_3 : SCENARIO_OPTIONS_2).map((s) => ({ value: s, label: scenarioLabel(t, s) }));
                return (
                  <li key={channel} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0 font-medium text-fg sm:flex-1">{channelLabel(channel, uiLocale)}</span>
                    {connected ? (
                      <Select
                        className="w-full sm:w-56"
                        aria-label={channelLabel(channel, uiLocale)}
                        options={options}
                        value={scenario}
                        disabled={type.systemLocked || (type.alwaysOn && channel === 'sms')}
                        onValueChange={(v) => setScenario(channel, v as NotifyScenario)}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(channel === 'sms' ? '/biz/notifications/channels/sms' : '/biz/notifications/channels')}
                      >
                        {t('channelsTab.connect')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {showConditions && !type.systemLocked && (
            <SectionCard
              title={t('conditions.sectionTitle')}
              description={HINT_FUTURE_ONLY_TYPES.has(code) ? t('typeDetail.hintFutureOnly') : undefined}
            >
              <TypeConditionsFields code={code} conditions={conditions} onChange={saveConditionsPatch} disabled={false} />
            </SectionCard>
          )}

          {type.recipient === 'client' && preview && previewNoApp && (
            <SectionCard title={t('typeDetail.previewTitle')} description={t('typeDetail.previewHint')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                    <Smartphone aria-hidden className="size-4" /> {t('typeDetail.previewWithApp')}
                  </p>
                  {preview.willSend.length ? (
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {preview.willSend.map((c, i) => (
                        <span key={c} className="flex items-center gap-1.5">
                          {i > 0 && <ArrowRight aria-hidden className="size-3.5" />}
                          <Badge tone="primary" size="sm">
                            {channelLabel(c, uiLocale)}
                          </Badge>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">{t('typeDetail.previewNothing')}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                    <Bell aria-hidden className="size-4" /> {t('typeDetail.previewNoApp')}
                  </p>
                  {previewNoApp.willSend.length ? (
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {previewNoApp.willSend.map((c, i) => (
                        <span key={c} className="flex items-center gap-1.5">
                          {i > 0 && <ArrowRight aria-hidden className="size-3.5" />}
                          <Badge tone="primary" size="sm">
                            {channelLabel(c, uiLocale)}
                          </Badge>
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">{t('typeDetail.previewNothing')}</p>
                  )}
                  {code !== 7 && previewNoApp.willSend.includes('telegram') && (
                    <p className="text-sm text-muted">{t(code === 73 ? 'typeDetail.previewTelegramNoteConfirm' : 'typeDetail.previewTelegramNote')}</p>
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      ) : (
        <div data-f="F-05-013 F-05-021 F-05-022" className="flex flex-col gap-6">
          <SectionCard title={t('typeDetail.senderTitle')} description={t('typeDetail.senderHint')}>
            <div data-f="F-05-012" className="flex flex-wrap items-center gap-3">
              <Badge tone="primary" size="md">
                {senderName || '—'}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-muted">
              {t('typeDetail.sendLanguageNote', { language: NOTIFY_LANGUAGE_OPTIONS.find((o) => o.value === sendLang)?.label ?? sendLang })}{' '}
              <Link href="/biz/settings/system" className="font-medium text-primary-text hover:underline">
                {t('typeDetail.sendLanguageLink')}
              </Link>
            </p>
          </SectionCard>

          {/* Ув3: язык шаблона, который правим сейчас, — отдельно от языка отправки */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg">{t('typeDetail.editLanguage')}</span>
            <SegmentedControl
              aria-label={t('typeDetail.editLanguage')}
              value={lang}
              onValueChange={(v) => setEditLangChoice(v as NotifyLanguage)}
              options={NOTIFY_LANGUAGE_OPTIONS.filter((o) => NOTIFY_LANGUAGES.includes(o.value)).map((o) => ({
                value: o.value,
                label: o.value === sendLang ? `${o.label} · ${t('typeDetail.sendLanguageShort')}` : o.label,
              }))}
            />
          </div>

          <Accordion
            variant="card"
            items={type.availableChannels.map((channel) => {
              const connected = connectedSet.has(channel);
              const text = templateText(channel);
              const variants = smsVariants(templateText(channel) || type.templates[channel]?.ru || '');
              const variantLabels = [t('typeDetail.readyVariantFull'), t('typeDetail.readyVariantMedium'), t('typeDetail.readyVariantShort')];

              let content: ReactNode;
              if (!connected) {
                content = (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted">{t('typeDetail.templateLocked')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(channel === 'sms' ? '/biz/notifications/channels/sms' : '/biz/notifications/channels')}
                    >
                      {t('channelsTab.connect')}
                    </Button>
                  </div>
                );
              } else if (type.systemLocked && code === 7) {
                const variantIndex = SYSTEM_TYPE7_TEMPLATES.findIndex((v) => v.ru === (type.templates.sms?.ru ?? ''));
                content = (
                  <div className="flex flex-col gap-3">
                    <Select
                      options={SYSTEM_TYPE7_TEMPLATES.map((v, i) => ({ value: String(i), label: v[lang] }))}
                      value={String(variantIndex >= 0 ? variantIndex : 0)}
                      onValueChange={async (v) => {
                        const variant = SYSTEM_TYPE7_TEMPLATES[Number(v)];
                        try {
                          await save.mutate({ businessId: businessId!, code, patch: { templates: { sms: { ru: variant.ru, en: variant.en, hy: variant.hy } } } });
                        } catch {
                          toast.error(t('typeDetail.saveFailed'));
                        }
                      }}
                    />
                    <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
                      {renderTemplate(type.templates.sms?.[lang] ?? type.templates.sms?.ru ?? '', smsTestData)}
                    </p>
                  </div>
                );
              } else if (type.systemLocked) {
                content = <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">{renderTemplate(text, testData)}</p>;
              } else if (channel === 'email') {
                content = (
                  <div className="flex flex-col gap-4">
                    <div data-f="F-05-014">
                      <p className="mb-1 text-sm font-medium text-fg">{t('typeDetail.emailMainTitle')}</p>
                      <p className="mb-2 text-xs text-muted">{t('typeDetail.emailMainHint')}</p>
                      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">{emailMainText}</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => setPreviewOpen(true)}>
                        {t('typeDetail.emailPreviewButton')}
                      </Button>
                      {ATTENDANCE_TYPES_WITH_POLICY.has(code) && (
                        <p data-f="F-05-042" className="mt-2 text-xs text-muted">
                          {t('typeDetail.paymentPolicyNote')}
                        </p>
                      )}
                    </div>
                    <div data-f="F-05-016" className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3">
                      <p className="text-sm font-medium text-fg">{t('typeDetail.clientDataTitle')}</p>
                      <p className="text-xs text-muted">{t('typeDetail.clientDataHint')}</p>
                      <p className="mt-1 text-sm text-fg">
                        {testData.clientName} · {testData.clientPhone}
                      </p>
                    </div>
                    <div data-f="F-05-015" className="flex flex-col gap-3 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-fg">{t('typeDetail.emailExtraTitle')}</span>
                        <Checkbox
                          checked={emailExtra.enabled}
                          onCheckedChange={(enabled) => setDraftEmailExtra({ ...emailExtra, enabled })}
                          label={t('typeDetail.emailExtraToggle')}
                        />
                      </div>
                      {emailExtra.enabled && (
                        <>
                          <Checkbox
                            checked={emailExtra.indent}
                            onCheckedChange={(indent) => setDraftEmailExtra({ ...emailExtra, indent })}
                            label={t('typeDetail.emailExtraIndent')}
                          />
                          <div className="flex gap-1">
                            <IconButton
                              label={t('typeDetail.formatBold')}
                              icon={<Bold className="size-4" />}
                              size="sm"
                              onClick={() => wrapEmailExtraText('**')}
                            />
                            <IconButton
                              label={t('typeDetail.formatItalic')}
                              icon={<Italic className="size-4" />}
                              size="sm"
                              onClick={() => wrapEmailExtraText('_')}
                            />
                            <IconButton
                              label={t('typeDetail.formatUnderline')}
                              icon={<Underline className="size-4" />}
                              size="sm"
                              onClick={() => wrapEmailExtraText('__')}
                            />
                            <IconButton
                              label={t('typeDetail.formatStrike')}
                              icon={<Strikethrough className="size-4" />}
                              size="sm"
                              onClick={() => wrapEmailExtraText('~~')}
                            />
                          </div>
                          <Textarea
                            ref={emailExtraTextRef}
                            rows={3}
                            value={emailExtra.text}
                            onChange={(e) => setDraftEmailExtra({ ...emailExtra, text: e.target.value })}
                            placeholder={t('typeDetail.emailExtraTextPlaceholder')}
                          />
                          <ImageUpload
                            value={emailExtra.imageUrl ? [emailExtra.imageUrl] : []}
                            onValueChange={(urls) => setDraftEmailExtra({ ...emailExtra, imageUrl: urls[0] })}
                            max={1}
                            label={t('typeDetail.emailExtraImageLabel')}
                          />
                          <Input
                            value={emailExtra.videoUrl ?? ''}
                            onChange={(e) => setDraftEmailExtra({ ...emailExtra, videoUrl: e.target.value })}
                            placeholder={t('typeDetail.emailExtraVideoLabel')}
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              value={emailExtra.linkUrl ?? ''}
                              onChange={(e) => setDraftEmailExtra({ ...emailExtra, linkUrl: e.target.value })}
                              placeholder={t('typeDetail.emailExtraLinkUrlLabel')}
                            />
                            <Input
                              value={emailExtra.linkLabel ?? ''}
                              onChange={(e) => setDraftEmailExtra({ ...emailExtra, linkLabel: e.target.value })}
                              placeholder={t('typeDetail.emailExtraLinkLabelLabel')}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              } else {
                content = (
                  <div data-f="F-05-017 F-05-018 F-05-019 F-14-134" className="flex flex-col gap-3">
                    {variants.length > 1 && (
                      <Select
                        options={variants.map((v, i) => ({ value: String(i), label: variantLabels[i] ?? String(i + 1) }))}
                        placeholder={t('typeDetail.readyVariantLabel')}
                        value=""
                        onValueChange={(v) => setDraft(channel, variants[Number(v)])}
                      />
                    )}
                    <div className="flex items-center gap-1">
                      {EMOJI_LIST.map((e) => (
                        <button
                          key={e}
                          type="button"
                          aria-label={t('typeDetail.emoji')}
                          className="flex size-10 items-center justify-center rounded-md text-base hover:bg-surface-2"
                          onClick={() => insertToken(channel, e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      ref={(el) => {
                        textareaRefs.current[channel] = el;
                      }}
                      rows={3}
                      value={text}
                      onFocus={() => setActiveChannel(channel)}
                      onChange={(e) => setDraft(channel, e.target.value)}
                      placeholder={t('typeDetail.templatePlaceholder')}
                    />
                    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs font-medium text-muted">{t('typeDetail.previewAsClient')}</p>
                      <p className="whitespace-pre-wrap text-sm text-fg">{renderTemplate(text, channel === 'sms' ? smsTestData : testData)}</p>
                    </div>
                    {channel === 'sms' ? (
                      <SmsCounter text={renderTemplate(text, smsTestData)} />
                    ) : (
                      <p className="text-xs text-muted">{t('typeDetail.charCount', { count: renderTemplate(text, testData).length })}</p>
                    )}
                  </div>
                );
              }

              return {
                id: channel,
                title: (
                  <span className="flex items-center gap-2">
                    {channelLabel(channel, uiLocale)}
                    {!connected && (
                      <Badge tone="neutral" size="sm">
                        {t('typeDetail.channelNotConnected')}
                      </Badge>
                    )}
                  </span>
                ),
                defaultOpen: channel === type.availableChannels[0],
                content,
              };
            })}
          />

          {/* F-05-020: у системных шаблонов (7, 19, 43) нет поля, куда вставлять переменную, и нечего
              сохранять — каталог и «Сохранить» показывать некуда и незачем. */}
          {!type.systemLocked && (
            // data-f — на div, а не на SectionCard: SectionCardProps не пробрасывает произвольные атрибуты
            // на DOM (fids.mjs находит метку статическим разбором текста, а measure.mjs — только по DOM).
            <div data-f="F-05-022" className="flex flex-col gap-6">
              <SectionCard title={t('typeDetail.variablesTitle')} description={t('typeDetail.variablesHint')}>
                <Popover
                  trigger={(p) => (
                    <Button {...p} variant="outline" size="sm">
                      {t('typeDetail.addVariable')}
                    </Button>
                  )}
                  label={t('typeDetail.variablesTitle')}
                >
                  {({ close }) => (
                    <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-2">
                      {!activeChannel && <p className="px-2 py-1 text-xs text-muted">{t('typeDetail.noActiveField')}</p>}
                      {VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          disabled={!activeChannel}
                          className="rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2 disabled:opacity-40"
                          onClick={() => {
                            insertToken(activeChannel, `{${v.key}}`);
                            close();
                          }}
                        >
                          {variableLabel(v, uiLocale)} <span className="text-muted">{`{${v.key}}`}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Popover>
              </SectionCard>

              <div className="flex justify-end">
                <Button onClick={saveTemplates} loading={pendingSave} disabled={!templatesDirty}>
                  {t('typeDetail.save')}
                </Button>
              </div>
            </div>
          )}

          <div data-f="F-05-023">
            <SectionCard title={t('typeDetail.legacyTitle')} description={t('typeDetail.legacyHint')}>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {LEGACY_VARIABLES.map((v) => (
                  <p key={v.code} className="text-sm text-muted">
                    <span className="font-mono text-fg">{v.code}</span> — {variableLabel(v, uiLocale)}
                  </p>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      <Modal open={previewOpen} onOpenChange={setPreviewOpen} title={t('typeDetail.emailPreviewTitle')} size="sm">
        <div className="flex flex-col gap-3 text-sm text-fg">
          <p>{emailMainText}</p>
          {emailExtra.enabled && (
            <div className={emailExtra.indent ? 'border-l-2 border-border pl-3' : undefined}>
              {emailExtra.text && <p className="whitespace-pre-wrap">{renderFormattedText(emailExtra.text)}</p>}
              {emailExtra.imageUrl && (
                <span className="relative mt-2 block h-40 w-full overflow-hidden rounded-lg">
                  <Image src={emailExtra.imageUrl} alt="" fill sizes="400px" className="object-cover" unoptimized />
                </span>
              )}
              {emailExtra.videoUrl && <p className="mt-2 text-primary-text underline">{emailExtra.videoUrl}</p>}
              {emailExtra.linkUrl && <p className="mt-2 text-primary-text underline">{emailExtra.linkLabel || emailExtra.linkUrl}</p>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
