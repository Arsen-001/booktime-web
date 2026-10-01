'use client';

/**
 * /biz/notifications/mailings/new — новая рассылка: канал (F-05-093 приложение салона, F-05-094 наше
 * приложение, механизм SMS — F-05-092), отбор получателей (F-05-096), правила сети (F-05-097),
 * согласие на ответственность (F-05-098), лимит пушей подписчикам (F-05-095, ⭐ F-00-114).
 */
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WEEKLY_PUSH_LIMIT,
  countAudience,
  countRecentAppPushes,
  createMailing,
  fillMailingText,
  listChannels,
  sendTestMailing,
} from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCoreGet } from '@/api/core';
import { SmsCounter } from '@/areas/notify/components/SmsCounter';
import { MailingSegmentFields, type MailingSegment } from '@/areas/notify/mailings/MailingSegmentFields';
import { toISODate, dayjs } from '@/lib/date';
import { Chip } from '@/ui/Chip';
import { Collapse } from '@/ui/Collapse';
import { DatePicker } from '@/ui/DatePicker';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TimePicker } from '@/ui/TimePicker';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import type { AudienceFilter } from '@/api/notify';
import type { MailingChannel } from '@/domain/notify';
import { NETWORK_SMS_RATE_AMD } from '@/domain/notify';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { Radio } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/** Периоды для фильтра «получал/не получал рассылку» (F-05-096) */
const RECEIVED_PERIOD_DAYS = [30, 90, 180] as const;
type ReceivedStatus = 'any' | 'received' | 'notReceived';

/** Переменные, которые можно вставить в текст рассылки (Ув13) — подставляются каждому получателю */
const MAILING_VARIABLES = ['clientName', 'companyName', 'bookingLink'] as const;

export function NewMailingScreen() {
  const t = useT('notify');
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const { ready, businessId, businessIds, networkId } = useCurrent();

  const [channel, setChannel] = useState<MailingChannel>('pushClientApp');
  const [text, setText] = useState('');
  const [onlyWithApp, setOnlyWithApp] = useState(false);
  const [onlyBirthday, setOnlyBirthday] = useState(false);
  const [network, setNetwork] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [receivedStatus, setReceivedStatus] = useState<ReceivedStatus>('any');
  const [receivedDays, setReceivedDays] = useState<number>(RECEIVED_PERIOD_DAYS[0]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [segment, setSegment] = useState<MailingSegment>({});
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState<string>(() => toISODate(dayjs().add(1, 'day')));
  const [scheduleTime, setScheduleTime] = useState<string>('11:00');
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  // Ув9: начатая рассылка не теряется молча при уходе по меню/«Назад»
  useUnsavedGuard(text.trim().length > 0);

  const channelsQ = useApiQuery(['notify', 'channels', businessId], () => listChannels(businessId!), { enabled: ready && !!businessId });
  const limitQ = useApiQuery(['notify', 'appPushLimit', businessId], () => countRecentAppPushes(businessId!), { enabled: ready && !!businessId });

  const filter: AudienceFilter = useMemo(
    () => ({
      onlyWithApp: onlyWithApp || channel !== 'sms',
      onlyBirthdayMonth: onlyBirthday,
      receivedMailing: receivedStatus === 'any' ? undefined : { status: receivedStatus, days: receivedDays },
      ...segment,
    }),
    [onlyWithApp, onlyBirthday, channel, receivedStatus, receivedDays, segment],
  );
  const targetBusinessIds = network && networkId ? businessIds : businessId ? [businessId] : [];
  const audienceQ = useApiQuery(
    ['notify', 'audience', targetBusinessIds, filter, channel],
    () => countAudience({ businessIds: targetBusinessIds, filter }),
    { enabled: ready && targetBusinessIds.length > 0 },
  );
  // F-05-096: разбивка «получат N, у M нет приложения» для push-каналов — считаем тех же клиентов по
  // тем же фильтрам CRM, но БЕЗ вынужденного onlyWithApp, чтобы узнать, скольких фильтр CRM нашёл всего.
  const isPushChannel = channel === 'pushClientApp' || channel === 'pushOwnApp';
  const totalMatchQ = useApiQuery(
    ['notify', 'audience-total', targetBusinessIds, filter.onlyBirthdayMonth, filter.receivedMailing, segment, channel],
    () => countAudience({ businessIds: targetBusinessIds, filter: { ...filter, onlyWithApp: false } }),
    { enabled: ready && targetBusinessIds.length > 0 && isPushChannel },
  );

  // F-05-118: сетевая SMS-рассылка идёт по тарифу SMS-агрегатора (F-05-068) — как и обычный SMS-канал.
  // Снято №11 / В-08 б: раньше это списывалось с отдельного «сетевого баланса уведомлений», которого мы
  // не продаём — цена показывается как справка, отправка ничем не блокируется.
  const isNetworkSms = network && channel === 'sms';

  const send = useApiMutation(createMailing);
  const sendTest = useApiMutation(sendTestMailing);
  const businessQ = useCoreGet('businesses', businessId, { enabled: ready && !!businessId });

  if (channelsQ.isError) return <ErrorState onRetry={channelsQ.refetch} />;
  if (!ready || channelsQ.isLoading) {
    return (
      <div aria-hidden className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton variant="rect" className="h-40 w-full rounded-2xl" />
        <Skeleton variant="rect" className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  const business = businessQ.data;
  // Предпросмотр и счётчик — на тексте, как его получит клиент (с подставленными переменными)
  const sampleVars = {
    clientName: t('newMailing.sampleClientName'),
    clientLastName: '',
    companyName: business?.brandName || business?.name || '',
    bookingLink: business?.slug ? `booktime.am/b/${business.slug}/book` : '',
    companyPhone: business?.phone ?? '',
  };
  const previewText = fillMailingText(text.trim(), sampleVars);
  const scheduledAt = when === 'later' && scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : undefined;
  const scheduleInPast = !!scheduledAt && scheduledAt <= dayjs().format('YYYY-MM-DDTHH:mm');

  const insertVariable = (key: string) => {
    const token = `{${key}}`;
    const el = textRef.current;
    if (!el) {
      setText((v) => v + token);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const runTest = async () => {
    try {
      const { phone } = await sendTest.mutate({ businessId: businessId!, channel, text: text.trim() });
      toast.success(t('newMailing.testSent', { phone: format.phone(phone) }));
    } catch {
      toast.error(t('newMailing.sendFailed'));
    }
  };

  const connected = new Set((channelsQ.data ?? []).filter((c) => c.connected).map((c) => c.channel));
  const smsAvailable = connected.has('sms');
  const brandedAvailable = connected.has('brandedApp');
  const recipients = audienceQ.data ?? 0;
  const pushLimitReached = channel === 'pushClientApp' && (limitQ.data ?? 0) >= WEEKLY_PUSH_LIMIT;
  const needsLegal = channel === 'sms';
  const networkSmsCostAmd = isNetworkSms ? recipients * NETWORK_SMS_RATE_AMD : 0;
  const canSend =
    text.trim().length > 0 &&
    recipients > 0 &&
    (!needsLegal || legalAccepted) &&
    !pushLimitReached &&
    (channel !== 'sms' || smsAvailable) &&
    (channel !== 'pushOwnApp' || brandedAvailable) &&
    !scheduleInPast;

  const audienceLabel = () => {
    const parts: string[] = [];
    if (network) parts.push(t('newMailing.audience.network'));
    // F-05-092: метка должна отражать фактически применённый фильтр, а не сырое состояние
    // чекбокса — для push-каналов «только с приложением» форсируется всегда (filter.onlyWithApp).
    if (filter.onlyWithApp) parts.push(t('newMailing.audience.withApp'));
    if (onlyBirthday) parts.push(t('newMailing.audience.birthday'));
    if (filter.receivedMailing) {
      const key = filter.receivedMailing.status === 'received' ? 'receivedYesLabel' : 'receivedNoLabel';
      parts.push(t(`newMailing.audience.${key}`, { days: filter.receivedMailing.days }));
    }
    if (segment.lastVisitOlderThanDays) parts.push(t('newMailing.segment.lastVisitDays', { days: segment.lastVisitOlderThanDays }));
    if (segment.visitKind) parts.push(t(segment.visitKind === 'new' ? 'newMailing.segment.new' : 'newMailing.segment.returning'));
    return parts.length ? parts.join(', ') : t('newMailing.audience.all');
  };

  const submit = async () => {
    try {
      await send.mutate({
        businessId: businessId!,
        businessIds: targetBusinessIds,
        channel,
        text: text.trim(),
        audienceLabel: audienceLabel(),
        filter,
        network: network || undefined,
        scheduledAt,
      });
      toast.success(
        scheduledAt ? t('newMailing.scheduled', { count: recipients, when: format.dateTime(scheduledAt) }) : t('newMailing.sent', { count: recipients }),
      );
      router.push('/biz/notifications/mailings');
    } catch {
      toast.error(t('newMailing.sendFailed'));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-4">
      <PageHeader back={{ href: '/biz/notifications/mailings', label: t('mailings.title') }} title={t('newMailing.title')} />

      <div data-f="F-05-092">
        <SectionCard title={t('newMailing.channelTitle')}>
          <div className="flex flex-col" role="radiogroup" aria-label={t('newMailing.channelTitle')}>
            <Radio
              data-f="F-05-094"
              name="mailing-channel"
              label={
                <span className="flex items-center gap-2">
                  {t('newMailing.channel.pushClientApp')}{' '}
                  <Badge tone="success" size="sm">
                    {t('channelsTab.free')}
                  </Badge>
                </span>
              }
              description={t('newMailing.channel.pushClientAppHint')}
              checked={channel === 'pushClientApp'}
              onChange={() => setChannel('pushClientApp')}
            />
            <Radio
              data-f="F-05-093"
              name="mailing-channel"
              label={t('newMailing.channel.pushOwnApp')}
              description={brandedAvailable ? undefined : t('newMailing.channel.brandedLocked')}
              checked={channel === 'pushOwnApp'}
              disabled={!brandedAvailable}
              onChange={() => setChannel('pushOwnApp')}
            />
            <Radio
              name="mailing-channel"
              label={t('newMailing.channel.sms')}
              description={smsAvailable ? undefined : t('newMailing.channel.smsLocked')}
              checked={channel === 'sms'}
              disabled={!smsAvailable}
              onChange={() => setChannel('sms')}
            />
          </div>
        </SectionCard>
      </div>

      <div data-f="F-05-096 F-05-097 F-14-076">
        <SectionCard title={t('newMailing.audienceTitle')}>
          <div className="flex flex-col gap-3">
            <Checkbox
              label={t('newMailing.audience.withApp')}
              checked={onlyWithApp || channel !== 'sms'}
              disabled={channel !== 'sms'}
              onCheckedChange={setOnlyWithApp}
            />
            <Checkbox label={t('newMailing.audience.birthday')} checked={onlyBirthday} onCheckedChange={setOnlyBirthday} />
            {networkId && (
              <>
                <Checkbox label={t('newMailing.audience.network')} checked={network} onCheckedChange={setNetwork} />
                {isNetworkSms && (
                  <div data-f="F-05-118" className="flex flex-col gap-1">
                    <p className="text-xs text-muted">{t('newMailing.audience.networkSmsRateHint')}</p>
                    <p className="text-xs text-muted">{t('newMailing.audience.networkSmsCost', { cost: format.money(networkSmsCostAmd) })}</p>
                  </div>
                )}
              </>
            )}
            <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end">
              <FormField label={t('newMailing.audience.receivedTitle')} className="w-full sm:w-56">
                <Select
                  options={[
                    { value: 'any', label: t('newMailing.audience.receivedAny') },
                    { value: 'received', label: t('newMailing.audience.receivedYes') },
                    { value: 'notReceived', label: t('newMailing.audience.receivedNo') },
                  ]}
                  value={receivedStatus}
                  onValueChange={(v) => setReceivedStatus(v as ReceivedStatus)}
                />
              </FormField>
              {receivedStatus !== 'any' && (
                <FormField label={t('newMailing.audience.receivedPeriod')} className="w-full sm:w-40">
                  <Select
                    options={RECEIVED_PERIOD_DAYS.map((d) => ({ value: String(d), label: t('newMailing.audience.periodDays', { days: d }) }))}
                    value={String(receivedDays)}
                    onValueChange={(v) => setReceivedDays(Number(v))}
                  />
                </FormField>
              )}
            </div>
            <MailingSegmentFields value={segment} onChange={setSegment} />
            <p className="text-sm text-muted">
              {audienceQ.isLoading && audienceQ.data === undefined
                ? t('newMailing.audienceCounting')
                : t('newMailing.audienceCount', { count: recipients })}
            </p>
            {/* F-05-096: разбивка для push-каналов — сколько из тех, кто подошёл по фильтрам CRM, не получат
                рассылку из-за отсутствия приложения. */}
            {isPushChannel && !totalMatchQ.isLoading && (totalMatchQ.data ?? 0) > recipients && (
              <p className="text-xs text-warning">{t('newMailing.audience.noAppBreakdown', { without: (totalMatchQ.data ?? 0) - recipients })}</p>
            )}
          </div>
        </SectionCard>
      </div>

      <div data-f="F-05-099">
        <SectionCard title={t('newMailing.textTitle')} description={t('newMailing.textHint', { clientName: '{clientName}' })}>
          <div className="flex flex-col gap-3">
            <Textarea ref={textRef} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('newMailing.textPlaceholder')} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">{t('newMailing.insertVariable')}</span>
              {MAILING_VARIABLES.map((key) => (
                <Chip key={key} onClick={() => insertVariable(key)}>
                  {t(`newMailing.variables.${key}`)}
                </Chip>
              ))}
            </div>
            {channel === 'sms' && text.trim() && <SmsCounter text={previewText} recipients={recipients} />}
          </div>
        </SectionCard>
      </div>

      {/* F-05-092/093: превью того, что реально уйдёт получателю, до отправки */}
      {text.trim() && (
        <div data-f="F-05-092 F-05-093">
          <SectionCard title={t('newMailing.previewTitle')}>
            <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
              <p className="mb-2 text-xs text-muted">{t(`newMailing.channel.${channel}`)}</p>
              <p className="whitespace-pre-wrap text-fg">{previewText}</p>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={runTest} loading={sendTest.isPending}>
              {t('newMailing.sendTest')}
            </Button>
          </SectionCard>
        </div>
      )}

      <SectionCard title={t('newMailing.whenTitle')}>
        <div className="flex flex-col gap-3">
          <SegmentedControl
            aria-label={t('newMailing.whenTitle')}
            value={when}
            onValueChange={(v) => setWhen(v as 'now' | 'later')}
            options={[
              { value: 'now', label: t('newMailing.whenNow') },
              { value: 'later', label: t('newMailing.whenLater') },
            ]}
          />
          <Collapse open={when === 'later'}>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <FormField label={t('newMailing.whenDate')}>
                <DatePicker value={scheduleDate} min={toISODate(dayjs())} onValueChange={(d) => setScheduleDate(d ?? '')} />
              </FormField>
              <FormField label={t('newMailing.whenTime')} error={scheduleInPast ? t('newMailing.whenPast') : undefined}>
                <TimePicker step={15} value={scheduleTime} onValueChange={setScheduleTime} />
              </FormField>
            </div>
          </Collapse>
        </div>
      </SectionCard>

      {needsLegal && (
        <div data-f="F-05-098">
          <Checkbox label={t('newMailing.legalLabel')} checked={legalAccepted} onCheckedChange={setLegalAccepted} />
        </div>
      )}

      {pushLimitReached && <p className="text-sm text-danger">{t('newMailing.limitReached', { total: WEEKLY_PUSH_LIMIT })}</p>}

      <StickyActionBar summary={<>{t('newMailing.audienceCount', { count: recipients })}</>}>
        <Button onClick={() => setConfirmOpen(true)} disabled={!canSend} loading={send.isPending}>
          {when === 'later' ? t('newMailing.schedule') : t('newMailing.send')}
        </Button>
      </StickyActionBar>

      {/* F-05-092/093: подтверждение перед отправкой — необратимое массовое действие */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('newMailing.confirmTitle')}
        description={t('newMailing.confirmText', { count: recipients })}
        confirmLabel={t('newMailing.send')}
        onConfirm={async () => {
          await submit();
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
