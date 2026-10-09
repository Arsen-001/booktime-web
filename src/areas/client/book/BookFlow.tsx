'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  bookAppointment,
  getBookingDays,
  getBookingMembershipOption,
  getClientProfile,
  getShadeOptions,
  listServicesFittingSlot,
  type BookAppointmentResult,
  type MasterCard,
} from '@/api/client';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { AcceptsNotice } from '@/areas/client/book/AcceptsNotice';
import { AddOnsCard, NO_ADD_ONS, addOnsKey, addOnsTotal } from '@/areas/client/book/AddOnsCard';
import { getUpsellOffers } from '@/api/services-upsell';
import type { BookingAddOns } from '@/domain/services';
import { BookingDone } from '@/areas/client/book/BookingDone';
import { BookSummary } from '@/areas/client/book/BookSummary';
import { ConfirmDetails } from '@/areas/client/book/ConfirmDetails';
import { GuestLogin } from '@/areas/client/book/GuestLogin';
import { PlaceChoice } from '@/areas/client/book/PlaceChoice';
import { ServiceChoices } from '@/areas/client/book/ServiceChoices';
import { SlotPicker } from '@/areas/client/book/SlotPicker';
import { EMPTY_DRAFT, type BookDraft, type BookStep } from '@/areas/client/book/bookTypes';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useApplyDemo, useCurrent } from '@/demo/hooks';
import type { AppUser, Id, ISODateTime } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { Stepper } from '@/ui/Stepper';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { forgetReferral, readReferral } from '@/lib/referralCapture';
import { appBookingSource, track, useTrackOnce } from '@/lib/analytics';

const ORDER: BookStep[] = ['service', 'place', 'slot', 'confirm'];

/**
 * Поток записи клиента (F-00-092): услуга → (где) → время → подтверждение → «Готово». Выбранное видно всегда
 * (карточка-итог), кнопка шага — у большого пальца (StickyActionBar), «Назад» один и ведёт на прошлый шаг
 * (ux-r2 улучшение 1). Услуга и время из ссылки окна пропускают свои шаги — запись в 2 нажатия (speed-k3/k4).
 */
export function BookFlow({
  card,
  initialSlot,
  initialServiceId,
  storyId,
}: {
  card: MasterCard;
  initialSlot?: ISODateTime;
  initialServiceId?: Id;
  storyId?: Id;
}) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyDemo();
  const { ready, appUserId } = useCurrent();
  // Пол клиента — чтобы не пугать окном «мастер принимает только женщин» ту, кому он подходит (F-00-069)
  const profileQ = useApiQuery(['client-profile', appUserId ?? ''], () => getClientProfile(appUserId!), { enabled: ready && Boolean(appUserId) });
  const { staff, services } = card;

  const [draft, setDraft] = useState<BookDraft>({
    ...EMPTY_DRAFT,
    serviceId: initialServiceId ?? (services.length === 1 ? services[0].id : undefined),
    slot: initialSlot,
  });
  const [forced, setForced] = useState<BookStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<BookAppointmentResult | undefined>(undefined);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const patch = (p: Partial<BookDraft>) => setDraft((d) => ({ ...d, ...p }));
  // Аналитика воронки (src/lib/analytics.ts): без имён и телефонов — бизнес, сфера, источник
  const sphere = staff.sphereIds[0];
  useTrackOnce('booking_started', { businessId: staff.businessId, sphere, source: appBookingSource(), slotPreselected: Boolean(initialSlot) });

  const service = services.find((s) => s.id === draft.serviceId);
  const offersVisit = Boolean(service?.workplaces.includes('visit'));
  const visitOnly = Boolean(service && service.workplaces.length === 1 && service.workplaces[0] === 'visit');
  const workplace = visitOnly ? 'visit' : draft.workplace;

  const visible: Record<BookStep, boolean> = {
    service: (!initialServiceId && services.length > 1) || forced.includes('service'),
    place: offersVisit && !visitOnly,
    slot: !initialSlot || forced.includes('slot'),
    confirm: true,
  };
  const steps = ORDER.filter((s) => visible[s]);
  const current = steps[Math.min(stepIndex, steps.length - 1)];
  const goTo = (step: BookStep) => {
    const nextForced = forced.includes(step) ? forced : [...forced, step];
    setForced(nextForced);
    const nextSteps = ORDER.filter((s) => (s === step ? true : visible[s] || nextForced.includes(s)));
    setStepIndex(nextSteps.indexOf(step));
  };
  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const serviceId = draft.serviceId ?? '';
  const daysQ = useApiQuery(clientKeys.bookingDays(staff.id, serviceId, workplace), () => getBookingDays(staff.id, serviceId, workplace), {
    enabled: Boolean(serviceId) && current === 'slot',
  });
  const fitQ = useApiQuery(['client', 'servicesFit', staff.id, draft.slot ?? ''], () => listServicesFittingSlot(staff.id, draft.slot ?? ''), {
    enabled: Boolean(draft.slot) && !forced.includes('slot') && current === 'service',
  });
  const shadeQ = useApiQuery(clientKeys.shade(serviceId), () => getShadeOptions(serviceId), { enabled: Boolean(serviceId) });
  const membershipQ = useApiQuery(
    clientKeys.membershipOption(appUserId ?? '', staff.businessId, serviceId),
    () => getBookingMembershipOption(appUserId ?? '', staff.businessId, serviceId),
    { enabled: ready && Boolean(appUserId) && Boolean(serviceId) },
  );
  const book = useApiMutation(bookAppointment);
  // ⭐ Допродажа: сопутствующие к услуге в выбранное время — считаются, как только выбрано время (к «Подтверждению» готовы)
  const offersQ = useApiQuery(addOnsKey(staff.id, serviceId, draft.slot), () => getUpsellOffers({ staffId: staff.id, serviceIds: [serviceId], start: draft.slot ?? '' }), {
    enabled: Boolean(serviceId && draft.slot),
  });
  const [addOnsState, setAddOnsState] = useState<{ key: string; value: BookingAddOns }>({ key: '', value: NO_ADD_ONS });
  // Сменили услугу или время — добавленное сбрасывается само (оно проверено под прежнее время)
  const addOnsFor = `${serviceId}|${draft.slot ?? ''}`;
  const addOns = addOnsState.key === addOnsFor ? addOnsState.value : NO_ADD_ONS;
  const added = addOnsTotal(offersQ.data, addOns);
  const addedCount = addOns.serviceIds.length + addOns.productIds.length;

  const shadeInfo = shadeQ.data && shadeQ.data.requirement !== 'none' ? shadeQ.data : undefined;
  const shade = draft.shade ?? (shadeInfo?.requirement === 'preferred' ? shadeInfo.options.find((o) => o.mode === 'master') : undefined);

  const confirm = async (forAppUserId: Id) => {
    if (!service || !draft.slot) return;
    if (shadeInfo?.requirement === 'required' && !shade) {
      setConfirmError(t('book.shadeRequiredError'));
      return;
    }
    if (workplace === 'visit' && !draft.visitAddress.trim()) {
      setConfirmError(t('book.visitAddressRequired'));
      return;
    }
    setConfirmError(undefined);
    try {
      const res = await book.mutate({
        appUserId: forAppUserId,
        staffId: staff.id,
        serviceId: service.id,
        start: draft.slot,
        workplace,
        visitAddress: workplace === 'visit' ? draft.visitAddress : undefined,
        comment: draft.comment.trim() || undefined,
        storyId,
        forWhom: draft.forWhom,
        visitorName: draft.forWhom !== 'self' ? draft.visitorName.trim() || undefined : undefined,
        shade: shade ? { mode: shade.mode, material: shade.material, requirement: shadeInfo?.requirement === 'required' ? 'required' : 'preferred' } : undefined,
        membershipId: membershipQ.data && draft.useMembership ? membershipQ.data.id : undefined,
        // «Пригласи подругу»: код из личной ссылки салона — привязку проверяет сервер
        referralCode: readReferral(card.business.slug),
        addOns: addedCount ? addOns : undefined,
      });
      forgetReferral(card.business.slug);
      track('booking_created', { businessId: staff.businessId, sphere: service.sphereId, source: appBookingSource(), prepayment: res.booking.status === 'awaiting_prepayment' });
      setResult(res);
      toast.success(
        res.booking.status === 'scheduled'
          ? t('book.successBooked')
          : res.booking.status === 'awaiting_prepayment'
            ? t('book.successPrepay')
            : t('book.success'),
      );
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === 'slot_taken') {
        patch({ slot: undefined });
        goTo('slot');
      }
      if (code === 'upsell_unavailable') setAddOnsState({ key: '', value: NO_ADD_ONS });
      toast.error(code ? tc(`bookingErrors.${code}` as 'bookingErrors.slot_taken') : t('book.failed'));
    }
  };

  const onGuestVerified = async (user: AppUser) => {
    // Вошёл новым номером — демо-контекст на этого пользователя, иначе «Мои записи» покажут чужие (e2e-q1 block)
    apply({ persona: 'client', appUser: user.id });
    await confirm(user.id);
  };

  if (result) return <BookingDone booking={result.booking} card={card} service={service} membershipLeft={result.membershipLeft} />;

  const summaryLine = service
    ? addedCount
      ? t('book.addOns.summary', {
          name: pickText(service.name, locale),
          count: addedCount,
          price: fmt.moneyRange(service.priceMin + added.min, (service.priceMax ?? service.priceMin) + added.max),
        })
      : `${pickText(service.name, locale)} · ${fmt.moneyRange(service.priceMin, service.priceMax)}`
    : t('book.pickServiceHint');

  return (
    <div data-f="F-00-004 F-00-007 F-00-031 F-00-108 F-00-092" className="flex flex-col gap-5">
      <AcceptsNotice
        accepts={staff.accepts}
        sphereId={staff.sphereIds[0]}
        staffName={nameOf(staff.name).split(' ')[0]}
        viewerGender={profileQ.data?.appUser.gender}
        pending={Boolean(appUserId) && !profileQ.data}
      />
      <div className="flex flex-col gap-3">
        {stepIndex > 0 ? (
          <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted" leftIcon={<ChevronLeft aria-hidden />} onClick={goBack}>
            {t('book.back')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted"
            leftIcon={<ChevronLeft aria-hidden />}
            onClick={() => router.push(`/masters/${staff.id}`)}
          >
            {t('book.back')}
          </Button>
        )}
        <PageHeader title={t('book.titleWith', { name: nameOf(staff.name).split(' ')[0] })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {steps.length > 1 && (
            <Stepper steps={steps.map((s) => ({ id: s, label: t(`book.step.${s}`) }))} current={Math.min(stepIndex, steps.length - 1)} />
          )}
          <div className="lg:hidden">
            <BookSummary
              card={card}
              service={service}
              slot={draft.slot}
              workplace={workplace}
              shade={current === 'confirm' ? shade : undefined}
              onChangeService={current !== 'service' && services.length > 1 ? () => goTo('service') : undefined}
              onChangeSlot={current !== 'slot' && draft.slot ? () => goTo('slot') : undefined}
            />
          </div>

          {current === 'service' && (
            <ServiceChoices
              services={services}
              value={draft.serviceId}
              fitting={fitQ.data}
              onPick={(id) => patch({ serviceId: id, shade: undefined })}
            />
          )}

          {current === 'place' && service && (
            <PlaceChoice
              workplaces={service.workplaces}
              value={draft.workplace}
              onChange={(w) => patch({ workplace: w, slot: forced.includes('slot') || !initialSlot ? undefined : draft.slot })}
            />
          )}

          {current === 'slot' && service && (
            <Card padding="md">
              <SlotPicker
                days={daysQ.data}
                loading={daysQ.isLoading}
                value={draft.slot}
                onSelect={(s) => {
                  track('slot_selected', { businessId: staff.businessId, source: appBookingSource() });
                  patch({ slot: s.start, workplace: workplace === 'visit' ? 'visit' : s.workplace });
                  goNext();
                }}
              />
            </Card>
          )}

          {current === 'confirm' && service && draft.slot && (
            <AddOnsCard
              staffId={staff.id}
              serviceId={service.id}
              start={draft.slot}
              value={addOns}
              onChange={(v) => setAddOnsState({ key: addOnsFor, value: v })}
            />
          )}

          {current === 'confirm' && service && draft.slot && (
            <ConfirmDetails
              card={card}
              service={service}
              draft={draft}
              workplace={workplace}
              onChange={patch}
              shadeInfo={shadeInfo}
              shade={shade}
              membership={membershipQ.data}
              error={confirmError}
            />
          )}

          {current === 'confirm' && ready && !appUserId && (
            <Card padding="lg" className="flex flex-col gap-4">
              <div>
                <h2 className="font-semibold text-fg">{t('book.guestTitle')}</h2>
                <p className="text-sm text-muted">{t('book.needLogin')}</p>
              </div>
              <GuestLogin submitLabel={t('book.confirm')} busy={book.isPending} onVerified={onGuestVerified} />
            </Card>
          )}
        </div>

        <aside className="sticky top-24 hidden flex-col gap-3 lg:flex">
          <BookSummary
            card={card}
            service={service}
            slot={draft.slot}
            workplace={workplace}
            shade={current === 'confirm' ? shade : undefined}
            onChangeService={current !== 'service' && services.length > 1 ? () => goTo('service') : undefined}
            onChangeSlot={current !== 'slot' && draft.slot ? () => goTo('slot') : undefined}
          />
        </aside>
      </div>

      {current === 'service' && (
        <StickyActionBar summary={summaryLine} desktop="inline" aria-label={t('book.title')}>
          <Button disabled={!service} onClick={goNext}>
            {t('book.continue')}
          </Button>
        </StickyActionBar>
      )}
      {current === 'place' && (
        <StickyActionBar summary={summaryLine} desktop="inline" aria-label={t('book.title')}>
          <Button disabled={!draft.workplace} onClick={goNext}>
            {t('book.continue')}
          </Button>
        </StickyActionBar>
      )}
      {current === 'confirm' && ready && appUserId && draft.slot && (
        <StickyActionBar
          summary={
            <>
              <b>{summaryLine}</b>
              <br />
              <span className="first-letter:uppercase">
                {fmt.relativeDay(draft.slot)}, {fmt.time(draft.slot)}
              </span>
            </>
          }
          desktop="inline"
          aria-label={t('book.title')}
        >
          <Button size="lg" className="h-auto min-h-12 max-w-[55vw] py-2 leading-tight whitespace-normal md:max-w-none" onClick={() => void confirm(appUserId)} loading={book.isPending}>
            {t('book.confirm')}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
