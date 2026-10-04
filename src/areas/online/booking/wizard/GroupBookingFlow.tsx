'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createGroupOnlineBooking, getGroupBookingRules, listPublicGroupEvents, trackWidgetEvent, type PublicGroupEvent } from '@/api/online';
import { useApiQuery } from '@/api/request';
import type { BookingLink } from '@/domain/online';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { legalLinkTags } from '@/areas/client/legal/LegalDocLink';

/** Групповая запись: список событий, места, «Записаться ещё» (F-03-101, F-03-076, F-03-102) */
export function GroupBookingFlow({
  slug,
  businessId,
  locationId,
  link,
  formId,
  isMobile,
}: {
  slug: string;
  businessId: string;
  locationId: string | undefined;
  link: BookingLink | undefined;
  formId: string | undefined;
  isMobile: boolean;
}) {
  const t = useT('online');
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const locale = useLocale();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; consent?: string; code?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sentCode, setSentCode] = useState<string | undefined>(undefined);
  const [codeInput, setCodeInput] = useState('');
  // F-16-090: «оплатить абонементом», по умолчанию выключен (справка 1380)
  const [useMembership, setUseMembership] = useState(false);
  const [membershipError, setMembershipError] = useState<string | undefined>(undefined);

  const eventsQ = useApiQuery(['online-group-events', businessId], () => listPublicGroupEvents(businessId));
  // Не `link!.id`: React Compiler по «!» считает link не-null и выносит чтение поля в рендер.
  const rulesQ = useApiQuery(['online-group-flow-rules', link?.id], () => getGroupBookingRules(link?.id ?? ''), { enabled: Boolean(link) });
  const rules = rulesQ.data;

  if (eventsQ.isLoading) return <Skeleton variant="rect" className="h-64 rounded-2xl" />;
  if (eventsQ.isError) return <ErrorState onRetry={eventsQ.refetch} />;
  const events = (eventsQ.data ?? []).filter((e) => e.seatsLeft > 0);
  if (events.length === 0) {
    return <EmptyState title={t('booking.group.emptyTitle')} description={t('booking.group.emptyDescription')} />;
  }

  const maxMulti = rules?.allowMultiEvent ? rules.maxEventsPerBooking : 1;
  const maxSeats = rules?.allowExtraSeats ? rules.maxSeatsPerBooking : 1;
  const selectedEvents = events.filter((e) => selectedIds.includes(e.event.id));

  // F-16-089: «Записаться ещё» — только тот же мастер и та же услуга, что у первой выбранной даты
  // («даты другого тренера в блоке не предлагаются»); первая дата этим не ограничена.
  const first = selectedEvents[0];
  const matchesFirst = (e: PublicGroupEvent) => !first || (e.staff?.id === first.staff?.id && e.service?.id === first.service?.id);

  const toggle = (e: PublicGroupEvent) => {
    if (selectedIds.includes(e.event.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== e.event.id));
      return;
    }
    // F-16-093: клик по дате/событию в списке — своё событие аналитики, отдельное от индивидуального пути.
    void trackWidgetEvent(link?.id, businessId, 'group_events_date_clicked');
    if (!rules?.allowMultiEvent) {
      setSelectedIds([e.event.id]);
      return;
    }
    if (!matchesFirst(e)) {
      toast.error(t('booking.group.differentStaff'));
      return;
    }
    if (selectedIds.length >= maxMulti) {
      toast.error(t('booking.group.maxEventsReached', { count: maxMulti }));
      return;
    }
    setSelectedIds([...selectedIds, e.event.id]);
  };

  const eventRow = (e: PublicGroupEvent) => {
    const checked = selectedIds.includes(e.event.id);
    const disabledByStaff = !checked && rules?.allowMultiEvent && selectedEvents.length > 0 && !matchesFirst(e);
    return (
      <button
        key={e.event.id}
        type="button"
        data-f={disabledByStaff ? 'F-16-089' : undefined}
        disabled={disabledByStaff}
        onClick={() => toggle(e)}
        className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
          checked
            ? 'border-primary bg-primary-soft'
            : disabledByStaff
              ? 'cursor-not-allowed border-border bg-surface opacity-50'
              : 'border-border bg-surface hover:bg-surface-2'
        }`}
      >
        <span className="min-w-0">
          <span className="block font-medium text-fg">{e.service ? pickText(e.service.name, locale) : ''}</span>
          <span className="block text-sm text-muted">
            {format.dateTime(e.event.start)} · {e.staff?.name}
          </span>
        </span>
        <Badge tone={e.seatsLeft <= 2 ? 'warning' : 'neutral'} size="sm">
          {t('booking.group.seatsLeft', { count: e.seatsLeft })}
        </Badge>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5" data-f="F-03-101 F-16-086">
      <h1 className="text-xl font-semibold text-fg">{t('booking.group.title')}</h1>
      <div className="flex flex-col gap-2">{events.map(eventRow)}</div>

      {selectedEvents.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border pt-4" data-f="F-03-102 F-16-088 F-16-089">
          {rules?.allowMultiEvent && selectedEvents.length > 1 && (
            <p className="text-sm text-muted">{t('booking.group.multiSelected', { count: selectedEvents.length })}</p>
          )}
          {rules?.allowExtraSeats && (
            <div data-f="F-03-076">
              <FormField label={t('booking.group.seats')}>
                <SegmentedControl
                  value={String(seats)}
                  onValueChange={(v) => setSeats(Number(v))}
                  options={Array.from({ length: Math.min(maxSeats, selectedEvents[0]?.seatsLeft ?? maxSeats) }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                />
              </FormField>
            </div>
          )}
          <FormField label={t('booking.details.name')} required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={t('booking.details.phone')} required error={errors.phone}>
            <PhoneInput
              value={phone}
              onValueChange={(v) => {
                // О9: сменили номер — прежний код к нему не относится
                if (v !== phone) {
                  setPhoneVerified(false);
                  setSentCode(undefined);
                  setCodeInput('');
                }
                setPhone(v);
              }}
              invalid={Boolean(errors.phone)}
            />
          </FormField>
          <div
            className={`flex flex-col gap-2 rounded-xl border p-3 ${errors.code ? 'border-danger bg-danger/5' : 'border-border bg-surface-2'}`}
            data-f="F-03-077"
          >
            {phoneVerified ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">{t('booking.details.phoneVerified')}</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted">{t('booking.details.verifyPhoneHint')}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      const normalized = normalizePhone(phone);
                      if (!normalized) {
                        setErrors({ ...errors, phone: t('booking.details.phoneInvalid') });
                        return;
                      }
                      const code = String(1000 + Math.floor(Math.random() * 9000));
                      setSentCode(code);
                      toast.info(t('booking.details.codeSentDemo', { code }));
                    }}
                  >
                    {sentCode ? t('booking.details.resendCode') : t('booking.details.sendCode')}
                  </Button>
                </div>
                {sentCode && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="0000"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-24"
                      invalid={Boolean(errors.code)}
                    />
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => {
                        if (codeInput.trim() === sentCode) {
                          setPhoneVerified(true);
                          setErrors({ ...errors, code: undefined });
                          toast.success(t('booking.details.codeVerified'));
                          // F-16-093: код подтверждён — groupSmsCodeConfirmed, отдельное от индивидуального пути событие
                          void trackWidgetEvent(link?.id, businessId, 'group_sms_code_confirmed');
                        } else {
                          toast.error(t('booking.details.codeWrong'));
                        }
                      }}
                    >
                      {t('booking.details.verifyCode')}
                    </Button>
                  </div>
                )}
                {errors.code && <p className="text-sm text-danger">{errors.code}</p>}
              </>
            )}
          </div>

          {/*
           * Своя надстройка (не F-16-092 — там место действия строго Altegio.me, F-16-092 построена в
           * BookingDetailBody/BookingsScreen): чекаут тоже честно показывает цену по числу мест, а не
           * молчит о ней до записи — то же правило «цена одной услуги × занятых мест».
           */}
          {first?.service && (
            <p className="flex justify-between text-sm text-muted">
              <span>{t('booking.group.total')}</span>
              <span className="font-semibold text-fg">
                {format.money(first.service.priceMin * seats)}
                {seats > 1 && <span className="ml-1 font-normal">({format.money(first.service.priceMin)} × {seats})</span>}
              </span>
            </p>
          )}

          {/*
           * F-16-090 «Абонемент и предоплата при онлайн-записи на событие»: тумблер внизу чекаута,
           * по умолчанию выключен (справка 1380). Есть подходящий действующий абонемент на этот телефон —
           * запись проходит без оплаты; нет — понятный отказ вместо попытки списать деньги.
           */}
          <div data-f="F-16-090" className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg">{t('booking.group.payByMembership')}</span>
              <Switch
                checked={useMembership}
                onCheckedChange={(v) => {
                  setUseMembership(v);
                  setMembershipError(undefined);
                }}
              />
            </div>
            {useMembership && <p className="text-xs text-muted">{t('booking.group.payByMembershipHint')}</p>}
            {membershipError && <p className="text-sm text-danger">{membershipError}</p>}
          </div>

          <Checkbox checked={consent} onCheckedChange={setConsent} label={t.rich('booking.details.consent', legalLinkTags)} />
          {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}
          <Button
            fullWidth
            loading={submitting}
            onClick={async () => {
              const nameErr = name.trim() ? undefined : t('booking.details.nameRequired');
              const normalized = normalizePhone(phone);
              const phoneErr = normalized ? undefined : t('booking.details.phoneInvalid');
              const consentErr = consent ? undefined : t('booking.details.consentRequired');
              const codeErr = phoneVerified ? undefined : t('booking.details.codeRequired');
              if (nameErr || phoneErr || consentErr || codeErr) {
                setErrors({ name: nameErr, phone: phoneErr, consent: consentErr, code: codeErr });
                return;
              }
              // F-16-090: тумблер «оплатить абонементом» — проверяем ПОСЛЕ кода (1380), на телефон, с
              // которого идёт запись (1155); своей услуги первого выбранного события хватает — «Записаться
              // ещё» разрешает только тот же мастер и ту же услугу (F-16-089).
              if (useMembership && first?.service) {
                const { hasOnlineMembership } = await import('@/api/loyalty');
                const ok = await hasOnlineMembership(businessId, normalized!, first.service.id);
                if (!ok) {
                  setMembershipError(t('booking.group.membershipInvalid'));
                  return;
                }
              }
              setErrors({});
              setMembershipError(undefined);
              // F-16-093: данные клиента прошли проверку — событие отдельное от индивидуальной записи
              void trackWidgetEvent(link?.id, businessId, 'group_personal_data_filled');
              setSubmitting(true);
              try {
                let result: Awaited<ReturnType<typeof createGroupOnlineBooking>> | undefined;
                for (const e of selectedEvents) {
                  result = await createGroupOnlineBooking({
                    businessId,
                    locationId: locationId ?? businessId,
                    groupEventId: e.event.id,
                    seats,
                    clientName: name.trim(),
                    clientPhone: normalized!,
                    linkId: link?.id,
                    formId,
                    source: formId ? 'link' : 'widget',
                    device: isMobile ? 'mobile' : 'desktop',
                    phoneVerified: true,
                    payByMembership: useMembership,
                  });
                }
                if (result) {
                  // F-16-093: групповая запись создана — своё событие, отличное от индивидуальной `booked`
                  void trackWidgetEvent(link?.id, businessId, 'group_record_created');
                  router.push(`/b/${slug}/booking/${result.booking.id}?h=${result.accessHash}`);
                }
              } catch (e) {
                const code = (e as { code?: string } | undefined)?.code;
                toast.error(code === 'slot_taken' ? t('booking.slotTaken') : t('booking.createFailed'));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {t('booking.details.submit')}
          </Button>
        </div>
      )}
    </div>
  );
}
