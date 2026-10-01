'use client';

import { useState } from 'react';
import { AlertTriangle, Info, Plus, Wallet } from 'lucide-react';
import { useLocale } from 'next-intl';
import { getMyPrepaymentNeed, listUpcomingBookings, type MasterCard, type PublicService, type ShadeOption, type ShadeStepInfo } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { ShadeChoice } from '@/areas/client/book/ShadeChoice';
import type { BookDraft } from '@/areas/client/book/bookTypes';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { sphereHas } from '@/config/spheres';
import { useCurrent } from '@/demo/hooks';
import type { BookingForWhom, Workplace } from '@/domain/core';
import { canPayInFull, hasExactPrice, prepaymentAmount, prepaymentForEveryone } from '@/domain/rules';
import type { Membership } from '@/domain/client';
import { useT } from '@/i18n/useT';
import { addMinutes } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';

/** F-05-083: варианты напоминания клиенту при онлайн-записи — часы как в ручной правке (BookingWindow), плюс дни */
const REMINDER_HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 21, 24];
const REMINDER_DAY_OPTIONS_HOURS = [48, 72, 120, 168];

/**
 * Шаг «Подтверждение»: только то, что нужно решить сейчас (ux-r1 №31): оттенок (если услуга просит), адрес выезда,
 * «для кого» — в сферах, где это бывает (speed-k1 №10: «Питомец» на маникюре), предоплата словами ДО записи
 * (speed-k4 №3), абонемент — только подходящий (ux-best-c3 №1), пожелание мастеру — ссылкой «+ Добавить».
 */
export function ConfirmDetails({
  card,
  service,
  draft,
  workplace,
  onChange,
  shadeInfo,
  shade,
  membership,
  error,
}: {
  card: MasterCard;
  service: PublicService;
  draft: BookDraft;
  workplace?: Workplace;
  onChange: (patch: Partial<BookDraft>) => void;
  shadeInfo?: ShadeStepInfo;
  shade?: ShadeOption;
  membership?: Membership;
  error?: string;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const locale = useLocale();
  const [commentOpen, setCommentOpen] = useState(Boolean(draft.comment));
  // У клиента уже есть запись, которая пересекается с этим окном (сценарии 30.09: 17:00 у Эрика и массаж в 17:00) —
  // предупреждаем, но не запрещаем: бывает, что записывают другого человека или переносят сами
  const { ready, appUserId } = useCurrent();
  const upcomingQ = useApiQuery(['client', 'upcomingOverlap', appUserId ?? ''], () => listUpcomingBookings(appUserId!, 50), {
    enabled: ready && Boolean(appUserId),
  });
  const slotEnd = draft.slot ? addMinutes(draft.slot, service.durationMin) : undefined;
  const overlap =
    draft.slot && slotEnd
      ? upcomingQ.data?.find((b) => b.start < slotEnd && draft.slot! < addMinutes(b.start, b.durationMin))
      : undefined;
  const rule = card.staff.prepayment;
  // ⭐ Мастер берёт предоплату только с тех, кто уже не приходил: нужна ли она МНЕ — спрашиваем до записи
  // (счётчик у этого мастера, В-07); запись всё равно решает единый поток на сервере
  const riskOnly = Boolean(rule?.onlyAfterNoShows);
  const staffId = card.staff.id;
  const needQ = useApiQuery(['client', 'prepaymentNeed', appUserId ?? '', staffId], () => getMyPrepaymentNeed(appUserId ?? '', staffId), {
    enabled: ready && Boolean(appUserId) && riskOnly,
  });
  const noShowNeed = riskOnly ? needQ.data : undefined;
  const prepay = rule && (prepaymentForEveryone(rule) || noShowNeed) ? rule : undefined;
  // ⭐ Процент мастера — от цены услуги; «всю сумму сразу» предлагаем только при точной цене (не «от–до»)
  const prepayAmount = prepaymentAmount(prepay, service.priceMin);
  const offerFull = Boolean(prepay?.percent) && hasExactPrice([service]) && canPayInFull(prepay, service.priceMin);
  const dependents = sphereHas(service.sphereId, 'dependents');
  const forWhomOptions: { value: BookingForWhom; label: string }[] = [
    { value: 'self', label: t('book.forWhomSelf') },
    { value: 'child', label: t('book.forWhomChild') },
    ...(service.sphereId === 'general' ? [{ value: 'pet' as const, label: t('book.forWhomPet') }] : []),
  ];

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      {overlap && (
        <div role="status" className="flex items-start gap-3 rounded-xl bg-warning-soft/70 p-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-sm text-fg">
            {t('book.overlapWarning', {
              when: `${fmt.relativeDay(overlap.start)}, ${fmt.time(overlap.start)}`,
              service: overlap.service ? pickText(overlap.service.name, locale) : '',
              master: overlap.staff.name,
            })}
          </p>
        </div>
      )}

      {shadeInfo && (
        <ShadeChoice
          options={shadeInfo.options}
          required={shadeInfo.requirement === 'required'}
          value={shade?.value}
          onChange={(o) => onChange({ shade: o })}
        />
      )}

      {workplace === 'visit' && (
        <FormField label={t('book.visitAddressLabel')} hint={t('book.visitAddressHint')}>
          <Input value={draft.visitAddress} onChange={(e) => onChange({ visitAddress: e.target.value })} placeholder={t('book.visitAddressPlaceholder')} autoComplete="street-address" />
        </FormField>
      )}
      {workplace === 'home' && (
        <p className="flex items-start gap-2 text-sm text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('book.homeAddressLater')}
        </p>
      )}

      {prepay && prepayAmount > 0 && (
        <div data-f="F-00-097" className="flex flex-col gap-3 rounded-xl bg-warning-soft/70 p-3">
          <div className="flex items-start gap-3">
            <Wallet aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="flex flex-col gap-1">
              <p className="text-sm text-fg">
                {offerFull
                  ? t('book.prepayChoiceTitle', { percent: prepay.percent ?? 0, minutes: prepay.timeoutMin })
                  : t('book.prepaymentNotice', { amount: fmt.money(prepayAmount), minutes: prepay.timeoutMin })}
              </p>
              {noShowNeed && (
                <p className="text-sm text-muted" data-f="F-00-071">
                  {t('book.prepayNoShowsWhy', { count: noShowNeed.noShows, months: noShowNeed.months })}
                </p>
              )}
            </div>
          </div>
          {offerFull && (
            <ChoiceGroup
              aria-label={t('book.prepayChoiceLabel')}
              value={draft.payInFull ? 'full' : 'part'}
              onValueChange={(v) => onChange({ payInFull: v === 'full' })}
              options={[
                {
                  value: 'part',
                  title: t('book.prepayPartTitle', { amount: fmt.money(prepayAmount) }),
                  description: t('book.prepayPartHint', { rest: fmt.money(service.priceMin - prepayAmount) }),
                },
                { value: 'full', title: t('book.prepayFullTitle', { amount: fmt.money(service.priceMin) }), description: t('book.prepayFullHint') },
              ]}
            />
          )}
        </div>
      )}

      {membership && (
        <div data-f="F-14-165">
          <Checkbox
            checked={draft.useMembership}
            onCheckedChange={(v) => onChange({ useMembership: v })}
            label={t('book.membershipUse', { title: pickText(membership.title, locale) })}
            description={
              membership.visitsLeft === 1
                ? t('book.membershipLast')
                : t('book.membershipLeft', { left: membership.visitsLeft, total: membership.visitsTotal })
            }
          />
        </div>
      )}

      {dependents && (
        <section data-f="F-00-125" className="flex flex-col gap-3">
          <h2 className="font-semibold text-fg">{t('book.forWhomTitle')}</h2>
          <SegmentedControl
            value={draft.forWhom}
            onValueChange={(v) => onChange({ forWhom: v as BookingForWhom })}
            fullWidth
            options={forWhomOptions}
          />
          {draft.forWhom !== 'self' && (
            <FormField label={t('book.visitorNameLabel')} optional>
              <Input value={draft.visitorName} onChange={(e) => onChange({ visitorName: e.target.value })} placeholder={t('book.visitorNamePlaceholder')} />
            </FormField>
          )}
        </section>
      )}

      <div data-f="F-05-083">
        <FormField label={t('book.reminderLabel')}>
          <Select
            className="max-w-xs"
            aria-label={t('book.reminderLabel')}
            value={draft.reminderHours === null ? 'off' : String(draft.reminderHours)}
            onValueChange={(v) => onChange({ reminderHours: v === 'off' ? null : Number(v) })}
            options={[
              { value: 'off', label: t('book.reminderOff') },
              ...REMINDER_HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('book.reminderHours', { h }) })),
              ...REMINDER_DAY_OPTIONS_HOURS.map((h) => ({ value: String(h), label: t('book.reminderDays', { d: h / 24 }) })),
            ]}
          />
        </FormField>
      </div>

      {commentOpen ? (
        <FormField label={t('book.commentLabel')} optional>
          <Textarea value={draft.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder={t('book.commentPlaceholder')} autoResize />
        </FormField>
      ) : (
        <Button variant="ghost" size="sm" className="-ml-2 w-fit" leftIcon={<Plus aria-hidden />} onClick={() => setCommentOpen(true)}>
          {t('book.addComment')}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
