'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import {
  createPlanBookings,
  getBusinessRules,
  getClientFieldsConfig,
  getPublicBusinessData,
  getWidgetExtraFields,
  listPublicGroupEvents,
  listStaffRules,
  rememberedPhoneSkipsCode,
  sendOnlineBookingCode,
  trackWidgetEvent,
  type CreateOnlineBookingInput,
  type PlanLegSlot,
  type PlanQuery,
  type PublicBusinessData,
} from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { SlotPicker } from '@/areas/online/booking/SlotPicker';
import { ChainStaffStep } from '@/areas/online/booking/wizard/ChainStaffStep';
import { AddOnsBlock, NO_ADD_ONS, addedLines, fetchUpsellOffers, upsellOffersKey, type AddOnsTarget } from '@/areas/online/booking/wizard/AddOnsBlock';
import type { BookingAddOns } from '@/domain/services';
import { DetailsStep, EMPTY_DETAILS, type DetailsErrors, type DetailsForm } from '@/areas/online/booking/wizard/DetailsStep';
import type { WizardPrepayment } from '@/areas/online/booking/wizard/PrepaymentNotice';
import { GroupBookingFlow } from '@/areas/online/booking/wizard/GroupBookingFlow';
import type { CodeState } from '@/areas/online/booking/wizard/PhoneCodeBlock';
import { ServicesStep, ServicesStepSkeleton } from '@/areas/online/booking/wizard/ServicesStep';
import { StaffStep } from '@/areas/online/booking/wizard/StaffStep';
import { TypeChoiceStep } from '@/areas/online/booking/wizard/TypeChoiceStep';
import { WaitlistJoinButton } from '@/areas/online/booking/wizard/WaitlistJoinButton';
import { WizardHeader } from '@/areas/online/booking/wizard/WizardHeader';
import { WorkplaceStep } from '@/areas/online/booking/wizard/WorkplaceStep';
import { buildVisitPlan } from '@/areas/online/booking/wizard/plan';
import { rememberClient, useRememberedClient } from '@/areas/online/booking/wizard/rememberedClient';
import { useSpecialistTerms } from '@/areas/online/booking/wizard/specialistTerms';
import { ANY_STAFF, useWizardUrl, type Step } from '@/areas/online/booking/wizard/useWizardUrl';
import { ApplyWidgetTheme } from '@/areas/online/public/ApplyWidgetTheme';
import { UnpublishedNotice } from '@/areas/online/public/UnpublishedNotice';
import type { Staff, Workplace } from '@/domain/core';
import { hasExactPrice, hasPrepayment, normalizeNoShowRule, prepaymentAmount, prepaymentForEveryone } from '@/domain/rules';
import { DEFAULT_CLIENT_FIELDS, DEFAULT_MAX_DAYS_AHEAD, SHORT_STEPWISE_ORDER, STEP_KEYS, type ClientFieldsConfig, type StepKey } from '@/domain/online';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, addMinutes, diffMinutes, today } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { SkeletonText } from '@/ui/Skeleton';
import { Stepper } from '@/ui/Stepper';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { forgetReferral, readReferral } from '@/lib/referralCapture';

/** Публичный путь записи /b/<slug>/book (и /embed): услуги → мастер → время → детали (F-03-081…F-03-098) */
export function BookingWizard({ slug, formId }: { slug: string; formId?: string }) {
  const t = useT('online');
  const dataQ = useApiQuery(['online-widget-data', slug, formId], () => getPublicBusinessData(slug, formId));
  if (dataQ.isLoading) return <WizardSkeleton slug={slug} />;
  if (dataQ.isError || !dataQ.data) {
    const code = (dataQ.error as { code?: string } | undefined)?.code;
    if (code === 'not_published') return <UnpublishedNotice slug={slug} />;
    return code === 'not_found' ? <EmptyState title={t('public.notFound')} description={t('public.notFoundHint')} /> : <ErrorState onRetry={dataQ.refetch} />;
  }
  return <WizardBody slug={slug} data={dataQ.data} formId={formId} />;
}

/**
 * Скелетон мастера записи — та же страница, что первый шаг (DESIGN.md «The skeleton IS the page»): шапка с названием
 * и «Мой кабинет», шаги (услуги → специалист → время → детали), шаг «Услуги» строками, «Продолжить» внизу (выключена).
 */
export function WizardSkeleton({ slug }: { slug: string }) {
  const t = useT('online');
  const terms = useSpecialistTerms(undefined);
  const steps = [t('booking.steps.services'), t('booking.steps.staff', terms), t('booking.steps.time'), t('booking.steps.details')];
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <WizardHeader slug={slug} businessName={<SkeletonText width="14ch" />} />
      <div className="flex items-center gap-2">
        <Stepper steps={steps.map((label, i) => ({ id: String(i), label }))} current={0} className="flex-1" />
      </div>
      <ServicesStepSkeleton />
      {/* Без въезда: панель скелетона стоит на месте с первого кадра (въезжает уже панель шага) */}
      <StickyActionBar desktop="sticky" className="animate-none">
        <Button disabled>{t('booking.continue')}</Button>
      </StickyActionBar>
    </div>
  );
}

const STEP_BY_KEY: Record<StepKey, Step> = { service: 'services', staff: 'staff', time: 'time' };

/** О15: «утром в день визита» — в 9:00; если визит раньше 10:00 — за час */
function reminderMinutes(value: DetailsForm['reminder'], start: string): number | undefined {
  if (value === '0') return undefined;
  if (value === 'morning') {
    const morning = `${start.slice(0, 10)}T09:00`;
    const diff = diffMinutes(morning, start);
    return diff >= 60 ? diff : 60;
  }
  return Number(value);
}

function WizardBody({ slug, data, formId }: { slug: string; data: PublicBusinessData; formId: string | undefined }) {
  const t = useT('online');
  const terms = useSpecialistTerms(data.business.sphereIds);
  const format = useFormat({ hourCycle: data.hourCycle });
  const toast = useToast();
  const router = useRouter();
  const locale = useLocale();
  const isMobile = useIsMobile();
  const url = useWizardUrl();
  const sel = url.state;
  const { business, categories, services, staff, link } = data;

  const businessRulesQ = useApiQuery(['online-business-rules', business.id], () => getBusinessRules(business.id));
  const clientFieldsQ = useApiQuery(['online-client-fields-widget', business.id], () => getClientFieldsConfig(business.id));
  const clientFields: ClientFieldsConfig = clientFieldsQ.data ?? { businessId: business.id, ...DEFAULT_CLIENT_FIELDS };
  // F-03-074: поля сети — общие для всех локаций сети
  const networkFieldsQ = useApiQuery(['online-network-extra-fields', data.location?.id], () => getWidgetExtraFields(data.location?.id));
  const networkFields = networkFieldsQ.data ?? [];
  const staffRulesQ = useApiQuery(['online-staff-rules-widget', staff.map((s) => s.id).join(',')], () => listStaffRules(staff.map((s) => s.id)));
  // О10: выбор «индивидуальная / групповое» — только если у бизнеса есть групповые события в ближайшие 30 дней
  const mixed = link?.bookingType === 'mixed';
  const groupEventsQ = useApiQuery(['online-group-events', business.id], () => listPublicGroupEvents(business.id), { enabled: mixed && !sel.type });

  const [genderModalStaffId, setGenderModalStaffId] = useState<string | undefined>();
  const [genderAck, setGenderAck] = useState<string | undefined>();
  const [slotTaken, setSlotTaken] = useState(false);
  const [form, setForm] = useState<DetailsForm>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [codeState, setCodeState] = useState<CodeState>({ kind: 'idle' });
  const [codeFor, setCodeFor] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState<string | undefined>();
  const remembered = useRememberedClient();
  const [addOnsState, setAddOnsState] = useState<{ key: string; value: BookingAddOns }>({ key: '', value: NO_ADD_ONS });

  const bookMutation = useApiMutation((args: { base: Omit<CreateOnlineBookingInput, 'services' | 'staffId' | 'start' | 'exactTime' | 'chainGroupId'>; legs: PlanLegSlot[] }) =>
    createPlanBookings(args.base, args.legs),
  );
  const codeMutation = useApiMutation(sendOnlineBookingCode);

  // Дизайн ссылки (F-03-024): цвет кнопок — CSS-переменная на корень виджета, цвет как данные
  const widgetStyle = link
    ? ({ '--primary': link.widgetButtonColor, '--primary-hover': link.widgetButtonColor, '--focus': link.widgetButtonColor } as CSSProperties)
    : undefined;

  // ── Выбор услуг и мастеров ─────────────────────────────────────────────
  const pkg = data.packages.find((p) => p.id === sel.pkg);
  const selectedServices = (pkg ? pkg.serviceIds : sel.services).map((id) => services.find((s) => s.id === id)).filter((s): s is (typeof services)[number] => Boolean(s));
  // «Сотрудник для онлайн-записи» (F-03-070) главнее одиночной ссылки на мастера (F-03-005)
  const forcedStaffId = link?.staffForAllBookings ?? link?.staffId;
  const linkedStaff = forcedStaffId ? staff.find((s) => s.id === forcedStaffId) : undefined;
  const preselectedFromLink = link?.preselectedStaffId;
  const stepHiddenByLink = Boolean(link?.stepHidden?.staff && preselectedFromLink && preselectedFromLink !== ANY_STAFF);
  const skipStaffStep = Boolean(linkedStaff) || stepHiddenByLink;
  const anyPool = (list: Staff[]) => list.filter((s) => staffRulesQ.data?.[s.id]?.allowAnyStaffAssignment ?? true);
  // О8/О25: «Любой специалист» по умолчанию включён
  const anyStaffAllowed = (data.anyStaffAllowed ?? true) || preselectedFromLink === ANY_STAFF;

  // Порядок шагов из настроек ссылки (F-03-016); «Короткий пошаговый» — всегда фиксирован (F-03-015)
  const rawOrder = link?.bookingFlow === 'shortStepwise' ? SHORT_STEPWISE_ORDER : link?.stepOrder?.length ? link.stepOrder : STEP_KEYS;
  const order: Step[] = [...rawOrder.map((k) => STEP_BY_KEY[k]).filter((id) => id !== 'staff' || !skipStaffStep), 'details'];
  const timeBeforeStaff = order.indexOf('time') < order.indexOf('staff');
  const staffParam = sel.staff ?? preselectedFromLink ?? (timeBeforeStaff ? ANY_STAFF : undefined);
  const maxDate = addDays(today(), data.maxDaysAhead ?? DEFAULT_MAX_DAYS_AHEAD);

  const workplaceOf = (st: Staff | undefined): Workplace | undefined =>
    st ? (st.workplaces.length > 1 ? (sel.workplace && st.workplaces.includes(sel.workplace) ? sel.workplace : st.workplaces[0]) : st.workplaces[0]) : undefined;
  const planArgs = {
    services: selectedServices,
    staff,
    anyPool,
    pkg,
    staffParam,
    legStaff: sel.legStaff,
    businessId: business.id,
    slug: business.slug,
    locationId: data.location?.id,
    maxDate,
    forcedStaffId: linkedStaff?.id ?? (stepHiddenByLink ? preselectedFromLink : undefined),
  };
  const probe = buildVisitPlan({ ...planArgs, workplace: undefined });
  const singleStaff = probe.staffId ? staff.find((s) => s.id === probe.staffId) : undefined;
  const workplace = workplaceOf(singleStaff);
  const plan = buildVisitPlan({ ...planArgs, workplace });
  const planFor = (ids: string[]): PlanQuery | undefined =>
    selectedServices.length && ids.length
      ? {
          businessId: business.id,
          slug: business.slug,
          locationId: data.location?.id,
          maxDate,
          legs: [
            {
              serviceIds: selectedServices.map((s) => s.id),
              staffIds: ids,
              durationMin: selectedServices.reduce((a, s) => a + s.durationMin, 0),
              durationMax: selectedServices.reduce((a, s) => a + (s.durationMax ?? s.durationMin), 0),
            },
          ],
        }
      : undefined;

  // ── Выбранное окно → части визита (кто и когда) ────────────────────────
  const legs: PlanLegSlot[] | undefined = (() => {
    if (!plan.query || !sel.start || sel.start.slice(0, 10) !== sel.date) return undefined;
    if (sel.assigned.length !== plan.query.legs.length) return undefined;
    let at = sel.start;
    const out: PlanLegSlot[] = [];
    for (const [i, leg] of plan.query.legs.entries()) {
      const staffId = sel.assigned[i];
      if (!leg.staffIds.includes(staffId)) return undefined;
      const dur = Math.max(leg.durationMin, leg.durationMax ?? leg.durationMin);
      out.push({ staffId, serviceIds: leg.serviceIds, start: at, durationMin: dur });
      at = addMinutes(at, dur);
    }
    return out;
  })();
  const legStaff = legs?.map((l) => staff.find((s) => s.id === l.staffId)).filter((s): s is Staff => Boolean(s)) ?? [];
  // ⭐ Допродажа: сопутствующие к последней части визита (тот же мастер, сразу после) — считаются, как только выбрано время
  const lastLeg = legs?.[legs.length - 1];
  const addOnsTarget: AddOnsTarget = { staffId: lastLeg?.staffId ?? '', serviceIds: lastLeg?.serviceIds ?? [], start: lastLeg?.start ?? '', locationId: data.location?.id };
  const offersQ = useApiQuery(upsellOffersKey(addOnsTarget), () => fetchUpsellOffers(addOnsTarget), { enabled: Boolean(lastLeg) });
  const addOnsFor = upsellOffersKey(addOnsTarget).join('|');
  const addOns = addOnsState.key === addOnsFor ? addOnsState.value : NO_ADD_ONS;
  const added = addedLines(offersQ.data, addOns, locale);
  const addedCount = addOns.serviceIds.length + addOns.productIds.length;
  const travelFee = workplace === 'visit' && singleStaff ? (staffRulesQ.data?.[singleStaff.id]?.travelFee ?? 0) : 0;

  // ── Шаги ───────────────────────────────────────────────────────────────
  const done: Record<Step, boolean> = {
    services: selectedServices.length > 0,
    staff: Boolean(plan.query),
    time: Boolean(legs) && (workplace !== 'visit' || Boolean(sel.district)),
    details: false,
  };
  // Шаг из адреса, но не дальше первого незаконченного — пересланная ссылка без выбора не откроет пустые «Детали»
  const requested = sel.step && order.includes(sel.step) ? sel.step : order[0];
  const firstUndone = order.find((s) => !done[s] && order.indexOf(s) < order.indexOf(requested));
  const step: Step = firstUndone ?? requested;
  const stepIndex = order.indexOf(step);
  const stepLabel: Record<Step, string> = {
    services: link?.stepLabels?.service || t('booking.steps.services'),
    staff: link?.stepLabels?.staff || t('booking.steps.staff', terms),
    time: link?.stepLabels?.time || t('booking.steps.time'),
    details: t('booking.steps.details'),
  };
  const goNext = () => {
    const next = order[stepIndex + 1];
    if (next) url.push({ step: next });
  };
  const goTo = (s: Step) => url.push({ step: s });

  if (services.length === 0 || staff.length === 0) {
    return (
      <div data-f="F-03-134">
        <EmptyState title={t('booking.noAvailability.title')} description={t('booking.noAvailability.description')} />
        <div className="mt-4 text-center text-sm text-muted">{format.phone(business.phone)}</div>
      </div>
    );
  }

  // F-03-082 + О10: смешанная ссылка спрашивает тип, только если групповые занятия правда есть
  if (mixed && !sel.type) {
    if (groupEventsQ.isLoading) return <WizardSkeleton slug={slug} />;
    const horizon = addDays(today(), 30);
    const hasGroup = (groupEventsQ.data ?? []).some((e) => e.seatsLeft > 0 && e.event.start.slice(0, 10) <= horizon);
    if (hasGroup && link) {
      return (
        <TypeChoiceStep
          link={link}
          businessId={business.id}
          businessName={business.name || t('public.unnamedBusiness')}
          slug={slug}
          onChoose={(choice) => {
            void trackWidgetEvent(link.id, business.id, choice === 'individual' ? 'individual_booking_selected' : 'group_activity_selected');
            url.push({ type: choice });
          }}
        />
      );
    }
  }
  // F-03-101, F-03-076, F-03-102: групповая ссылка (или выбор «группового» на смешанной)
  if (link?.bookingType === 'group' || sel.type === 'group') {
    return <GroupBookingFlow slug={slug} businessId={business.id} locationId={data.location?.id} link={link} formId={formId} isMobile={isMobile} />;
  }

  // ── Действия ───────────────────────────────────────────────────────────
  const toggleService = (id: string) => {
    void trackWidgetEvent(link?.id, business.id, 'service_selected');
    const next = sel.services.includes(id) ? sel.services.filter((x) => x !== id) : [...sel.services, id];
    url.replace({ services: next, pkg: undefined, start: undefined, assigned: [], legStaff: {} });
  };

  const commitStaff = (id: string) => {
    void trackWidgetEvent(link?.id, business.id, 'master_selected');
    // Время уже выбрано раньше мастера («Меню») и его делает другой — время сбрасываем
    const keepTime = sel.start && sel.assigned.length === 1 && (id === ANY_STAFF || sel.assigned[0] === id);
    const patch = { staff: id, start: keepTime ? sel.start : undefined, assigned: keepTime ? sel.assigned : [] };
    const next = order[order.indexOf('staff') + 1];
    url.push({ ...patch, step: keepTime ? next : timeBeforeStaff ? 'time' : next });
  };
  const pickStaff = (id: string) => {
    const picked = staff.find((s) => s.id === id);
    // модалка «кого принимаю» перед тем, как продолжить (F-00-069)
    if (picked && picked.accepts !== 'all' && genderAck !== id) {
      setGenderModalStaffId(id);
      return;
    }
    commitStaff(id);
  };

  const normalized = normalizePhone(form.phone ?? remembered?.phone ?? '');
  const shownName = form.name ?? remembered?.name ?? '';
  const shownPhone = form.phone ?? remembered?.phone ?? '';
  const rememberedOk = Boolean(normalized && remembered?.phone === normalized && rememberedPhoneSkipsCode());
  const phoneVerified = Boolean(normalized && (verifiedPhone === normalized || rememberedOk));
  // О9: состояние кода относится к номеру, на который код ушёл — другой номер снова «Получить код»
  const shownCodeState: CodeState = codeFor && codeFor === normalized ? codeState : codeState.kind === 'sendFailed' ? codeState : { kind: 'idle' };

  const patchForm = (patch: Partial<DetailsForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (patch.phone !== undefined && normalizePhone(patch.phone) !== verifiedPhone) setErrors((e) => ({ ...e, phone: undefined }));
  };

  const verifyCode = (value: string, forPhone: string | undefined, demo?: string) => {
    if (!forPhone) return;
    // Мок: сверяем с кодом, который ушёл на ЭТОТ номер. Api: формат, настоящий код проверит сервер при записи (B2).
    const ok = demo ? value === demo : /^\d{4}$/.test(value);
    if (ok) {
      setVerifiedPhone(forPhone);
      setErrors((e) => ({ ...e, code: undefined }));
      rememberClient({ phone: forPhone, name: shownName.trim() || undefined });
    } else {
      setCodeState({ kind: 'wrong' });
      setCode('');
    }
  };

  const sendCode = async () => {
    if (!normalized) {
      setErrors((e) => ({ ...e, phone: t('booking.details.phoneInvalid') }));
      return;
    }
    setCodeState({ kind: 'sending' });
    setCodeFor(normalized);
    try {
      const { demoCode } = await codeMutation.mutate({ slug: business.slug, phone: normalized });
      setCodeState({ kind: 'sent', demoCode });
      // О16: демо-код — прямо в поле и сразу проверен, без всплывающего сообщения поверх формы
      if (demoCode) {
        setCode(demoCode);
        verifyCode(demoCode, normalized, demoCode);
      } else setCode('');
    } catch {
      setCodeState({ kind: 'sendFailed' });
    }
  };

  const submit = async () => {
    if (!legs) return;
    const nameErr = shownName.trim() ? undefined : t('booking.details.nameRequired');
    const phoneErr = normalized ? undefined : t('booking.details.phoneInvalid');
    const consentErr = form.consent ? undefined : t('booking.details.consentRequired');
    // ⭐ F-03-077: номер обязательно подтверждён — кодом или раньше в этом браузере (О14)
    const codeErr = phoneVerified ? undefined : t('booking.details.codeRequired');
    const missingField =
      (clientFields.commentRequired && !form.comment.trim()) ||
      (clientFields.emailRequired && !form.email.trim()) ||
      (clientFields.lastNameEnabled && clientFields.lastNameRequired && !form.lastName.trim()) ||
      [...clientFields.customFields, ...networkFields].some((f) => f.required && !(form.custom[f.id] ?? '').trim());
    const depositRules = staffRulesQ.data?.[legs[0].staffId];
    const depositErr = depositRules?.depositPolicyKind && !form.depositAgree ? t('booking.details.depositPolicy.agreeRequired') : undefined;
    const next: DetailsErrors = {
      name: nameErr,
      phone: phoneErr,
      consent: consentErr,
      code: codeErr,
      deposit: depositErr,
      fields: missingField ? t('booking.details.fillRequiredFields') : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    // F-06-128: «Онлайн-запись только по абонементу» — проверка по подтверждённому телефону, после кода
    const { getOnlineRequireMembership, hasOnlineMembership } = await import('@/api/loyalty');
    for (const sv of selectedServices) {
      if (!(await getOnlineRequireMembership(business.id, sv.id))) continue;
      if (!(await hasOnlineMembership(business.id, normalized!, sv.id))) {
        toast.error(t('booking.details.membershipRequired', { service: pickText(sv.name, locale) }));
        return;
      }
    }
    const base = {
      slug: business.slug,
      businessId: business.id,
      locationId: data.location?.id ?? business.locationIds[0],
      clientName: shownName.trim(),
      clientPhone: normalized!,
      // B2 + О9: сервер сверяет пару «номер + код»; номер, запомненный в браузере, кода не шлёт (мок)
      code: verifiedPhone === normalized && code.trim() ? code.trim() : undefined,
      comment: form.comment.trim() || undefined,
      linkId: link?.id,
      formId: formId ?? link?.formId,
      source: (formId ? 'link' : 'widget') as 'link' | 'widget',
      device: (isMobile ? 'mobile' : 'desktop') as 'mobile' | 'desktop',
      workplace: workplace ?? 'salon',
      visitDistrict: sel.district || undefined,
      visitAddress: workplace === 'visit' ? form.visitAddress.trim() || undefined : undefined,
      forWhom: form.forWhom,
      reminderMinutesBefore: reminderMinutes(form.reminder, legs[0].start),
      phoneVerified: true,
      anySpecialist: plan.anyStaff || (plan.mode === 'chain' && selectedServices.some((s) => (sel.legStaff[s.id] ?? ANY_STAFF) === ANY_STAFF)),
      email: form.email.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      patronymic: form.patronymic.trim() || undefined,
      customFieldValues: Object.keys(form.custom).length ? form.custom : undefined,
      payInFull: form.payInFull || undefined,
      // «Пригласи подругу»: код из личной ссылки (/b/<slug>?ref=…) — привязку проверяет сервер
      referralCode: readReferral(business.slug),
      // ⭐ Допродажа: к последней части визита; время, цену и остаток проверяет сервер
      addOns: addedCount ? addOns : undefined,
    };
    try {
      const results = await bookMutation.mutate({ base, legs });
      forgetReferral(business.slug);
      rememberClient({ phone: normalized!, name: shownName.trim() });
      void trackWidgetEvent(link?.id, business.id, 'booked');
      // Визит из нескольких записей: открываем ту, что ждёт предоплату (О5) — остальные части видны на ней же
      const first = results.find((r) => r.booking.status === 'awaiting_prepayment') ?? results[0];
      router.push(`/b/${slug}/booking/${first.booking.id}?h=${first.accessHash}`);
    } catch (e) {
      const errCode = (e as { code?: string } | undefined)?.code;
      if (errCode === 'slot_taken' || errCode === 'resource_unavailable') {
        setSlotTaken(true);
        url.push({ step: 'time', start: undefined, assigned: [] });
        toast.error(t('booking.slotTaken'));
      } else if (errCode === 'client_blocked') toast.error(t('booking.details.clientBlocked'));
      else if (errCode === 'online_paused') toast.error(t('booking.details.onlinePaused'));
      else if (errCode === 'staff_on_vacation') toast.error(t('booking.details.staffOnVacation', terms));
      else if (errCode === 'phone_not_verified' || errCode === 'code_required') setErrors((x) => ({ ...x, code: t('booking.details.codeRequired') }));
      else if (errCode === 'wrong_code' || errCode === 'code_expired' || errCode === 'code_attempts') {
        // Сервер не принял код (или номер сменили после кода, О9) — просим новый
        setVerifiedPhone(undefined);
        setCodeState({ kind: 'idle' });
        rememberClient(undefined);
        setErrors((x) => ({ ...x, code: t('booking.details.codeWrong') }));
      } else if (errCode === 'subscription_required') toast.error(t('booking.details.subscriptionInvalid'));
      else if (errCode === 'upsell_unavailable') {
        setAddOnsState({ key: '', value: NO_ADD_ONS });
        toast.error(t('booking.addOns.unavailable'));
      } else toast.error(t('booking.createFailed'));
    }
  };

  // О5: предоплата — до записи. Сумма по всем мастерам визита (процент — от цены своей части), условия — первого,
  // кто её берёт. ⭐ «Всё сразу» — только при точной цене всех услуг, иначе итог станет известен на визите.
  const prepayment = ((): WizardPrepayment | undefined => {
    const parts = (legs ?? []).flatMap((leg, i) => {
      const rule = legStaff.find((s) => s.id === leg.staffId)?.prepayment;
      // ⭐ Предоплата «только с тех, кто не приходил» до записи не считается: нужна ли она — решит запись (номер)
      if (!rule || !prepaymentForEveryone(rule)) return [];
      const svcs = leg.serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is (typeof services)[number] => Boolean(s));
      // ⭐ Добавленные услуги — часть последней записи (её сумма), товары оплачиваются на визите
      const extra = i === (legs?.length ?? 0) - 1 ? added.services.reduce((a, x) => a + x.min, 0) : 0;
      const total = svcs.reduce((a, s) => a + s.priceMin, 0) + (i === 0 ? travelFee : 0) + extra;
      return [{ rule, total, exact: hasExactPrice(svcs), amount: prepaymentAmount(rule, total) }];
    });
    if (!parts.length) return undefined;
    const amount = parts.reduce((a, p) => a + p.amount, 0);
    const full = parts.reduce((a, p) => a + p.total, 0);
    const offerFull = parts.every((p) => p.exact) && full > amount;
    return { amount, full: offerFull ? full : undefined, rule: parts[0].rule };
  })();

  // ⭐ Мастер берёт предоплату только с тех, кто не приходил, — честно предупреждаем заранее (без упрёка)
  const noShowRule = ((): { count: number; months: number } | undefined => {
    for (const leg of legs ?? []) {
      const rule = legStaff.find((s) => s.id === leg.staffId)?.prepayment;
      if (rule?.onlyAfterNoShows && hasPrepayment(rule)) return normalizeNoShowRule(rule.onlyAfterNoShows);
    }
    return undefined;
  })();

  const servicesSummary = selectedServices.length
    ? t('booking.servicesSummary', {
        count: selectedServices.length,
        price: format.moneyRange(
          selectedServices.reduce((a, s) => a + s.priceMin, 0),
          selectedServices.reduce((a, s) => a + (s.priceMax ?? s.priceMin), 0) || undefined,
        ),
      })
    : undefined;
  const continueDisabled = !done[step];

  return (
    <div className="flex flex-col gap-5" data-f="F-03-081 F-03-023 F-03-024 F-16-015" style={widgetStyle}>
      <ApplyWidgetTheme theme={link?.theme} />
      <WizardHeader slug={slug} businessName={business.name || t('public.unnamedBusiness')} />

      {stepIndex === 0 && link?.heroImageUrl && link.heroImageStatus === 'approved' && (
        <div className="-mx-4 -mt-1 overflow-hidden sm:mx-0 sm:rounded-xl" data-f="F-03-025">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL моковой загрузки */}
          <img src={link.heroImageUrl} alt="" className="aspect-video w-full object-cover" />
        </div>
      )}

      <div className="flex items-center gap-2">
        {stepIndex > 0 && <IconButton icon={<ChevronLeft aria-hidden />} label={t('booking.back')} onClick={() => goTo(order[stepIndex - 1])} />}
        <Stepper steps={order.map((id) => ({ id, label: stepLabel[id] }))} current={Math.max(stepIndex, 0)} className="flex-1" />
      </div>

      {step === 'services' && (
        <ServicesStep
          categories={categories}
          services={services}
          serviceConfigs={data.serviceConfigs}
          selectedIds={selectedServices.map((s) => s.id)}
          categoryDisplay={link?.categoryDisplay ?? 'tags'}
          hidePrice={link?.hidePrice}
          hideDuration={link?.hideDuration}
          onToggle={toggleService}
          packages={data.packages}
          selectedPackageId={sel.pkg}
          onSelectPackage={(p) => url.replace({ pkg: p.id, services: p.serviceIds, start: undefined, assigned: [], legStaff: {} })}
          onClearPackage={() => url.replace({ pkg: undefined, services: [], start: undefined, assigned: [], legStaff: {} })}
          chainNotice={plan.mode === 'chain' && !skipStaffStep}
        />
      )}

      {step === 'staff' &&
        (plan.mode === 'chain' ? (
          <ChainStaffStep
            perService={plan.perService}
            legStaff={sel.legStaff}
            onChange={(serviceId, staffId) => url.replace({ legStaff: { ...sel.legStaff, [serviceId]: staffId }, start: undefined, assigned: [] })}
            plan={plan.query}
            sphereIds={business.sphereIds}
            hourCycle={data.hourCycle}
          />
        ) : (
          <StaffStep
            staff={plan.allEligible}
            anyPool={anyPool(plan.allEligible)}
            selectedId={staffParam}
            anyStaffAllowed={anyStaffAllowed}
            onSelect={pickStaff}
            sphereIds={business.sphereIds}
            planFor={planFor}
            hourCycle={data.hourCycle}
          />
        ))}

      {step === 'time' && (
        <div className="flex flex-col gap-4">
          {singleStaff && singleStaff.workplaces.length > 1 && workplace && (
            <div data-f="F-00-078 F-00-081">
              <WorkplaceStep
                sphereIds={business.sphereIds}
                staff={singleStaff}
                workplace={workplace}
                onChange={(wp) => url.replace({ workplace: wp, start: undefined, assigned: [] })}
                district={sel.district ?? ''}
                onDistrictChange={(d) => url.replace({ district: d || undefined })}
                address={form.visitAddress}
                onAddressChange={(v) => patchForm({ visitAddress: v })}
              />
            </div>
          )}
          {slotTaken && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" data-f="F-03-093">
              {t('booking.slotTaken')}
            </p>
          )}
          <SlotPicker
            plan={plan.query}
            date={sel.date}
            onDateChange={(d, how) => {
              if (how === 'user') void trackWidgetEvent(link?.id, business.id, 'date_selected');
              url.replace(how === 'auto' ? { date: d } : { date: d, start: undefined, assigned: [] });
            }}
            selectedStart={sel.start}
            onSelect={(slot) => {
              void trackWidgetEvent(link?.id, business.id, 'time_selected');
              setSlotTaken(false);
              url.replace({ date: slot.date, start: slot.start, assigned: slot.legs.map((l) => l.staffId) });
            }}
            max={maxDate}
            hourCycle={data.hourCycle}
            emptyExtra={(d) =>
              singleStaff && selectedServices[0] ? (
                <WaitlistJoinButton businessId={business.id} locationId={data.location?.id} staffId={singleStaff.id} serviceId={selectedServices[0].id} date={d} />
              ) : null
            }
          />
        </div>
      )}

      {step === 'details' && legs && (
        <DetailsStep
          legs={legs}
          staff={staff}
          services={selectedServices}
          travelFee={travelFee}
          anySpecialist={plan.anyStaff}
          form={form}
          name={shownName}
          phone={shownPhone}
          onPatch={patchForm}
          errors={errors}
          codeState={shownCodeState}
          code={code}
          onCodeChange={(v) => {
            setCode(v);
            if (codeState.kind === 'wrong') setCodeState({ kind: 'sent' });
          }}
          phoneVerified={phoneVerified}
          phoneRemembered={rememberedOk && verifiedPhone !== normalized}
          onSendCode={sendCode}
          onVerifyCode={(v) => verifyCode(v, codeFor, codeState.kind === 'sent' ? codeState.demoCode : undefined)}
          onForgetPhone={() => {
            rememberClient(undefined);
            setVerifiedPhone(undefined);
            setForm((f) => ({ ...f, name: '', phone: '' }));
          }}
          prepayment={prepayment}
          noShowRule={prepayment ? undefined : noShowRule}
          consentText={businessRulesQ.data ? pickText(businessRulesQ.data.consentText, locale) : undefined}
          widgetText={clientFields.widgetText ? pickText(clientFields.widgetText, locale) : undefined}
          clientFields={clientFields}
          networkFields={networkFields}
          workplace={workplace ?? 'salon'}
          submitting={bookMutation.isPending}
          onSubmit={submit}
          onEditTime={() => goTo('time')}
          onEditServices={() => goTo('services')}
          hourCycle={data.hourCycle}
          sphereIds={business.sphereIds}
          summaryExtras={[...added.services, ...added.products]}
          extraMinutes={added.minutes}
          addOns={
            lastLeg ? (
              <AddOnsBlock target={addOnsTarget} value={addOns} onChange={(v) => setAddOnsState({ key: addOnsFor, value: v })} hourCycle={data.hourCycle} />
            ) : undefined
          }
        />
      )}

      {step !== 'details' && !(step === 'staff' && plan.mode === 'single') && (
        <StickyActionBar
          desktop="sticky"
          summary={
            step === 'time' && legs
              ? format.date(legs[0].start, 'weekday') + ', ' + format.time(legs[0].start)
              : step === 'services'
                ? servicesSummary
                : undefined
          }
        >
          <Button onClick={goNext} disabled={continueDisabled}>
            {t('booking.continue')}
          </Button>
        </StickyActionBar>
      )}

      <Modal
        open={Boolean(genderModalStaffId)}
        onOpenChange={(open) => !open && setGenderModalStaffId(undefined)}
        title={t('booking.genderModal.title', terms)}
        footer={
          <div className="flex w-full gap-2">
            <Button variant="secondary" fullWidth onClick={() => setGenderModalStaffId(undefined)}>
              {t('booking.genderModal.pickAnother')}
            </Button>
            <Button
              fullWidth
              onClick={() => {
                const id = genderModalStaffId;
                setGenderAck(id);
                setGenderModalStaffId(undefined);
                if (id) commitStaff(id);
              }}
            >
              {t('booking.genderModal.ok')}
            </Button>
          </div>
        }
      >
        {(() => {
          const s = staff.find((x) => x.id === genderModalStaffId);
          if (!s) return null;
          return <p className="text-sm text-fg">{t(s.accepts === 'women' ? 'booking.genderModal.womenOnly' : 'booking.genderModal.menOnly', { name: s.name })}</p>;
        })()}
      </Modal>
    </div>
  );
}
