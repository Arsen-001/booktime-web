'use client';

/**
 * /biz/onboarding/quick-start — «Настройка локации» (F-15-017…020): мастер из 3 шагов, которые реально создают
 * данные в ядре (услуга → coreCreate('services'), сотрудник → api/staff.addStaff или назначение владельцу,
 * график → api/schedule.addWorkDays на 4 недели). Готово — checklist на /biz/onboarding сам отметит шаги
 * «сделано» (getOnboardingChecklist читает те же коллекции), здесь ничего не помечаем вручную.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Scissors, Users, CalendarClock } from 'lucide-react';
import { coreCreate, coreList, coreUpdate, useCoreGet, useCoreList } from '@/api/core';
import { addStaff } from '@/api/staff';
import { addWorkDays } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import type { ServiceCategory, Service } from '@/domain/core';
import { useCurrent, useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { dayjs, today, addDays } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { normalizePhone } from '@/lib/phone';
import { SectionCard } from '@/ui/SectionCard';
import { Stepper } from '@/ui/Stepper';
import { useToast } from '@/ui/Toast';
import { WeekdayPicker } from '@/ui/WeekdayPicker';
import { QUICK_START_TEMPLATES } from '@/areas/settings/quickStartTemplates';

const HOUR_PRESETS = [
  { id: '09-18', from: '09:00', to: '18:00' },
  { id: '10-19', from: '10:00', to: '19:00' },
  { id: '10-20', from: '10:00', to: '20:00' },
  { id: '10-22', from: '10:00', to: '22:00' },
] as const;

function useActorName(): string {
  const { staffId } = useCurrent();
  const own = useCoreGet('staff', staffId);
  return own.data?.name ?? '';
}

function datesForWeekdays(days: number[], weeks = 4): string[] {
  const start = today();
  const dates: string[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const monIdx = (dayjs(d).day() + 6) % 7; // 0 = понедельник, как в WeekdayPicker
    if (days.includes(monIdx)) dates.push(d);
  }
  return dates;
}

export function QuickStartScreen() {
  const t = useT('settings');
  const router = useRouter();
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const { sphere } = useDemo();
  const actorName = useActorName();

  const businessQ = useCoreGet('businesses', businessId, { enabled: ready && Boolean(businessId) });
  const servicesQ = useCoreList('services', { businessId }, { enabled: ready && Boolean(businessId) });
  const staffQ = useCoreList('staff', { businessId }, { enabled: ready && Boolean(businessId) });

  const [step, setStep] = useState(0);
  const templates = QUICK_START_TEMPLATES[sphere] ?? [];

  // Шаг 1 — услуга
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState<number | undefined>(undefined);
  const [serviceDuration, setServiceDuration] = useState<'30' | '60' | '90'>('60');
  const [createdServiceId, setCreatedServiceId] = useState<string | undefined>();
  const [serviceTouched, setServiceTouched] = useState(false);

  // Шаг 2 — сотрудник
  const isSalon = businessQ.data?.kind === 'salon';
  const [staffName, setStaffName] = useState('');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>();
  const [staffTouched, setStaffTouched] = useState(false);

  // Шаг 3 — график
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [hoursPreset, setHoursPreset] = useState<(typeof HOUR_PRESETS)[number]['id']>('10-22');
  const [scheduleTouched, setScheduleTouched] = useState(false);

  const createService = useApiMutation(async () => {
    if (!businessId) throw new Error('no business');
    const categories = await coreList('serviceCategories', { businessId });
    let category: ServiceCategory | undefined = categories[0];
    if (!category) {
      category = await coreCreate('serviceCategories', { businessId, name: { ru: t('quickStart.defaultCategory') }, order: 0 });
    }
    const durationMin = Number(serviceDuration) as 30 | 60 | 90;
    const service: Service = await coreCreate('services', {
      businessId,
      categoryId: category.id,
      sphereId: sphere,
      name: { ru: serviceName.trim() },
      kind: 'individual',
      durationMin,
      priceMin: servicePrice ?? 0,
      photos: [],
      materials: [],
      staffIds: [],
      workplaces: ['salon'],
      onlineBookable: true,
      active: true,
      order: 0,
    });
    return service;
  });

  const addStaffMutation = useApiMutation(async () => {
    if (!businessId) throw new Error('no business');
    const locationIds = businessQ.data?.locationIds ?? [];
    const created = await addStaff({
      businessId,
      locationIds,
      name: staffName.trim(),
      role: 'master',
      phone: staffPhone.trim() || undefined,
      position: staffPosition.trim() || undefined,
      sphereIds: [sphere],
    });
    return created;
  });

  const assignService = useApiMutation(async (targetStaffId: string) => {
    if (!createdServiceId || !businessId) return;
    const svc = await coreList('services', { businessId });
    const found = svc.find((s) => s.id === createdServiceId);
    if (!found || found.staffIds.includes(targetStaffId)) return;
    await coreUpdate('services', createdServiceId, { staffIds: [...found.staffIds, targetStaffId] });
  });

  const saveSchedule = useApiMutation(async () => {
    if (!selectedStaffId) throw new Error('no staff');
    const preset = HOUR_PRESETS.find((p) => p.id === hoursPreset) ?? HOUR_PRESETS[3];
    const dates = datesForWeekdays(weekdays);
    if (dates.length === 0) return;
    await addWorkDays(selectedStaffId, dates, actorName || t('quickStart.you'), [{ from: preset.from, to: preset.to }]);
  });

  const submitService = async () => {
    setServiceTouched(true);
    if (!serviceName.trim()) return;
    try {
      const created = await createService.mutate(undefined);
      setCreatedServiceId(created?.id);
      toast.success(t('quickStart.step1.saved'));
      setStep(1);
    } catch {
      toast.error(t('quickStart.saveFailed'));
    }
  };

  // Мастер салона без телефона не создаётся (api/staff.addStaff: «phone required» для роли master) — раньше поле
  // было подписано «необязательно», а «Далее» молча ничего не делал (QA 30.09): теперь обязательно и с ошибкой под полем
  const staffPhoneInvalid = isSalon && !normalizePhone(staffPhone);

  const submitStaff = async () => {
    setStaffTouched(true);
    if (isSalon && (!staffName.trim() || staffPhoneInvalid)) return;
    try {
      let targetId = selectedStaffId;
      if (isSalon) {
        const created = await addStaffMutation.mutate(undefined);
        targetId = created?.id;
      } else {
        targetId = businessQ.data?.ownerStaffId;
      }
      setSelectedStaffId(targetId);
      if (targetId) await assignService.mutate(targetId);
      // Индивидуал никого не добавляет — услуга просто назначена ему самому (QA 30.09: был тост «Сотрудник добавлен»)
      toast.success(t(isSalon ? 'quickStart.step2.saved' : 'quickStart.step2.savedSelf'));
      setStep(2);
    } catch {
      toast.error(t('quickStart.saveFailed'));
    }
  };

  const submitSchedule = async () => {
    setScheduleTouched(true);
    if (weekdays.length === 0) return;
    try {
      await saveSchedule.mutate(undefined);
      toast.success(t('quickStart.step3.saved'));
      router.push('/biz/onboarding/tour');
    } catch {
      toast.error(t('quickStart.saveFailed'));
    }
  };

  // Шаг 1 от данных не зависит (шаблоны — по сфере демо): страница сразу настоящая, без скелетона; пока бизнес
  // не загрузился, выключена только кнопка «Далее» (создать услугу ещё некуда)
  const loading = !ready || businessQ.isLoading || servicesQ.isLoading || staffQ.isLoading;

  const steps = [
    { id: 'service', label: t('quickStart.step1.title') },
    { id: 'staff', label: t('quickStart.step2.title') },
    { id: 'schedule', label: t('quickStart.step3.title') },
  ];

  return (
    // ⭐ F-15-025 «первичная настройка с телефона»: своего мобильного приложения у нас нет, кабинет и есть
    // адаптивный веб (F-00-001/007) — этот же 3-шаговый чек-лист на 390×844 и есть путь «от регистрации до
    // первой записи с одного устройства» (assumed).
    <div data-f="F-15-017 F-15-025 F-14-083" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('quickStart.title')}
        description={t('quickStart.description')}
        back={{ href: '/biz/onboarding', label: t('quickStart.close') }}
      />

      <Stepper steps={steps} current={step} onStepClick={(i) => i < step && setStep(i)} />

      {step === 0 && (
        <div data-f="F-15-018">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Scissors aria-hidden className="size-4 shrink-0 text-muted" />
                {t('quickStart.step1.title')}
              </span>
            }
            description={t('quickStart.step1.description')}
          >
            {templates.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setServiceName(t(`quickStart.template.${sphere}.${tpl.nameKey}` as never));
                      setServicePrice(tpl.priceMin);
                      setServiceDuration(String(tpl.durationMin) as '30' | '60' | '90');
                    }}
                    className="flex min-h-10 items-center rounded-full border border-border bg-bg-subtle px-3.5 text-sm text-fg transition hover:border-primary hover:text-primary-text"
                  >
                    {t(`quickStart.template.${sphere}.${tpl.nameKey}` as never)}
                  </button>
                ))}
              </div>
            )}

            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitService();
              }}
            >
              <FormField
                label={t('quickStart.step1.nameLabel')}
                error={serviceTouched && !serviceName.trim() ? t('quickStart.required') : undefined}
                required
              >
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder={t('quickStart.step1.namePlaceholder')}
                  invalid={serviceTouched && !serviceName.trim()}
                />
              </FormField>
              <FormField label={t('quickStart.step1.priceLabel')}>
                <MoneyInput value={servicePrice} onValueChange={setServicePrice} />
              </FormField>
              <FormField label={t('quickStart.step1.durationLabel')}>
                <ChoiceGroup
                  columns={1}
                  value={serviceDuration}
                  onValueChange={(v) => setServiceDuration(v as '30' | '60' | '90')}
                  options={[
                    { value: '30', title: t('quickStart.step1.duration30') },
                    { value: '60', title: t('quickStart.step1.duration60') },
                    { value: '90', title: t('quickStart.step1.duration90') },
                  ]}
                />
              </FormField>
              <Button type="submit" loading={createService.isPending} disabled={loading} className="self-start">
                {t('quickStart.next')}
              </Button>
            </form>
          </SectionCard>
        </div>
      )}

      {step === 1 && (
        <div data-f="F-15-019 F-10-004">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Users aria-hidden className="size-4 shrink-0 text-muted" />
                {t('quickStart.step2.title')}
              </span>
            }
            description={t('quickStart.step2.description')}
          >
            {isSalon ? (
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitStaff();
                }}
              >
                <FormField
                  label={t('quickStart.step2.nameLabel')}
                  error={staffTouched && !staffName.trim() ? t('quickStart.required') : undefined}
                  required
                >
                  <Input
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder={t('quickStart.step2.namePlaceholder')}
                    invalid={staffTouched && !staffName.trim()}
                  />
                </FormField>
                <FormField label={t('quickStart.step2.positionLabel')}>
                  <Input
                    value={staffPosition}
                    onChange={(e) => setStaffPosition(e.target.value)}
                    placeholder={t('quickStart.step2.positionPlaceholder')}
                  />
                </FormField>
                <FormField
                  label={t('quickStart.step2.phoneLabel')}
                  hint={t('quickStart.step2.phoneHint')}
                  error={staffTouched && staffPhoneInvalid ? t('quickStart.step2.phoneError') : undefined}
                  required
                >
                  <PhoneInput value={staffPhone} onValueChange={setStaffPhone} invalid={staffTouched && staffPhoneInvalid} />
                </FormField>
                <Button type="submit" loading={addStaffMutation.isPending} className="self-start">
                  {t('quickStart.next')}
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted">{t('quickStart.step2.individualNote')}</p>
                <Button onClick={() => void submitStaff()} loading={assignService.isPending} className="self-start" leftIcon={<Check />}>
                  {t('quickStart.next')}
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {step === 2 && (
        <div data-f="F-15-020 F-02-018">
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <CalendarClock aria-hidden className="size-4 shrink-0 text-muted" />
                {t('quickStart.step3.title')}
              </span>
            }
            description={t('quickStart.step3.description')}
          >
            <form
              noValidate
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submitSchedule();
              }}
            >
              <FormField
                label={t('quickStart.step3.daysLabel')}
                error={scheduleTouched && weekdays.length === 0 ? t('quickStart.required') : undefined}
                required
              >
                <WeekdayPicker value={weekdays} onValueChange={setWeekdays} invalid={scheduleTouched && weekdays.length === 0} />
              </FormField>
              <FormField label={t('quickStart.step3.hoursLabel')}>
                <ChoiceGroup
                  columns={2}
                  value={hoursPreset}
                  onValueChange={(v) => setHoursPreset(v as (typeof HOUR_PRESETS)[number]['id'])}
                  options={HOUR_PRESETS.map((p) => ({ value: p.id, title: `${p.from}–${p.to}` }))}
                />
              </FormField>
              <Button type="submit" loading={saveSchedule.isPending} className="self-start" leftIcon={<Check />}>
                {t('quickStart.finish')}
              </Button>
            </form>
          </SectionCard>
        </div>
      )}

      <LinkButton href="/biz/onboarding" variant="ghost" size="sm" className="self-start">
        {t('quickStart.close')}
      </LinkButton>
    </div>
  );
}
