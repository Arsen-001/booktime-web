'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RegisterBusinessType } from '@/api/client';
import { registerBusiness } from '@/api/client';
import { HttpApiError, isApiMode } from '@/api/http';
import { useApiMutation } from '@/api/request';
import { SESSION_KEY } from '@/api/session';
import { useApplyDemo } from '@/demo/hooks';
import { SPHERE_IDS } from '@/config/spheres';
import type { SphereId } from '@/domain/core';
import { ONBOARDING_GOAL_IDS, saveOnboardingGoals, startIntroTrial, type OnboardingGoalId } from '@/api/settings';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { startBusinessMilestones, track, useTrackOnce } from '@/lib/analytics';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { RadioGroup } from '@/ui/Radio';
import { Stepper } from '@/ui/Stepper';
import { useToast } from '@/ui/Toast';

type WizardStep = 0 | 1 | 2 | 3 | 4;

/**
 * Регистрация бизнеса: тип → сфера(ы) → промокод → название и телефон (F-00-035). Демо без
 * бэкенда — после успеха переключает демо-персону на владельца/индивидуала и ведёт в быстрый старт.
 */
export function RegisterBusinessScreen() {
  const t = useT('client');
  const tc = useT('common');
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyDemo();

  const [step, setStep] = useState<WizardStep>(0);
  const [type, setType] = useState<RegisterBusinessType>('salon');
  const [spheres, setSpheres] = useState<SphereId[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [sphereError, setSphereError] = useState<string | undefined>(undefined);
  const [goals, setGoals] = useState<OnboardingGoalId[]>([]);

  const submit = useApiMutation(registerBusiness, { invalidates: [SESSION_KEY] });
  // Аналитика воронки салона (src/lib/analytics.ts): анкета открыта → бизнес создан
  useTrackOnce('business_signup_started', {});

  const steps = [
    { id: 'type', label: t('registerBusiness.stepType') },
    { id: 'sphere', label: t('registerBusiness.stepSphere') },
    { id: 'promo', label: t('registerBusiness.stepPromo') },
    { id: 'contact', label: t('registerBusiness.stepContact') },
    { id: 'goals', label: t('registerBusiness.stepGoals') },
  ];

  const toggleGoal = (id: OnboardingGoalId) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const toggleSphere = (id: SphereId) => {
    setSphereError(undefined);
    setSpheres((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const goNext = () => {
    if (step === 1 && spheres.length === 0) {
      setSphereError(t('registerBusiness.errorSphere'));
      return;
    }
    setStep((s) => (s < 4 ? ((s + 1) as WizardStep) : s));
  };
  const goBack = () => setStep((s) => (s > 0 ? ((s - 1) as WizardStep) : s));

  const phoneValid = Boolean(normalizePhone(phone));
  const canSubmit = Boolean(name.trim()) && phoneValid && spheres.length > 0;

  const handleSubmit = async () => {
    try {
      const result = await submit.mutate({ type, sphereIds: spheres, promoCode: promoCode || undefined, name, phone });
      track('business_signup_completed', { businessId: result.businessId, sphere: spheres[0], type });
      startBusinessMilestones(result.businessId, type);
      // F-00-019: регистрация = пробный период. Живой сайт открывает его сам при POST /v1/biz; на моке — здесь, явно
      if (!isApiMode()) await startIntroTrial(result.businessId).catch(() => undefined);
      // F-15-007: цели не обязательны и не должны сорвать регистрацию — бизнес уже создан выше
      try {
        await saveOnboardingGoals({ businessId: result.businessId, goals });
      } catch {
        /* цели — необязательная деталь анкеты, ошибка их сохранения не должна ломать успешную регистрацию */
      }
      // Демо: зарегистрированный бизнес — это «пустой» салон/мастер (registerBusiness заполняет BIZ.empty/emptySolo);
      // без empty:'1' кабинет открывал чужой демо-салон (qa 30.09). В режиме api бизнес берётся из сессии.
      apply({ persona: result.persona, sphere: spheres[0], ...(isApiMode() ? {} : { empty: '1' as const }) });
      toast.success(t('registerBusiness.success'));
      router.push('/biz/onboarding');
    } catch (error) {
      // Живой сайт: регистрировать бизнес может только вошедший по коду (F-00-035) — сначала вход, потом сюда же
      if (error instanceof HttpApiError && error.status === 401) {
        router.push('/login?next=/register-business');
        return;
      }
      toast.error(t('registerBusiness.errorGeneric'));
    }
  };

  return (
    <div
      data-f="F-00-035 F-14-081 F-15-002 F-15-010"
      className="mx-auto flex max-w-sm flex-col gap-5 py-6"
    >
      {/*
       * F-15-002 «Экран регистрации (веб)»: наша модель заменяет их «телефон+почта» на
       * тип→сфера(и)→промокод→имя+телефон (F-00-011/020/035); подтверждение номера — на LoginScreen
       * после Sign up (F-00-032/033), см. data-f="F-15-003/004" там.
       * F-15-010 «Регистрация в мобильном приложении»: у нас нет отдельного нативного мастера
       * регистрации — кабинет бизнеса это один и тот же адаптивный веб-интерфейс и в браузере телефона,
       * и в вебе (F-00-001/007), поэтому этот же экран и есть регистрация «из приложения».
       */}
      <PageHeader title={t('registerBusiness.title')} description={t('registerBusiness.subtitle')} />
      <Stepper steps={steps} current={step} onStepClick={(i) => setStep(i as WizardStep)} />

      <Card padding="lg" className="flex flex-col gap-4">
        {step === 0 ? (
          <RadioGroup
            aria-label={t('registerBusiness.stepType')}
            value={type}
            onValueChange={(v) => setType(v as RegisterBusinessType)}
            options={[
              { value: 'individual', label: t('registerBusiness.typeIndividual'), description: t('registerBusiness.typeIndividualHint') },
              { value: 'salon', label: t('registerBusiness.typeSalon'), description: t('registerBusiness.typeSalonHint') },
            ]}
          />
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-2" data-f="F-00-147">
            <p className="text-sm text-muted">{t('registerBusiness.sphereHint')}</p>
            <div className="flex flex-wrap gap-2">
              {SPHERE_IDS.map((id) => (
                <Chip key={id} selected={spheres.includes(id)} onClick={() => toggleSphere(id)}>
                  {tc(`spheres.${id}`)}
                </Chip>
              ))}
            </div>
            {sphereError ? <p className="text-sm text-danger">{sphereError}</p> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <FormField label={t('registerBusiness.promoLabel')} hint={t('registerBusiness.promoOptional')}>
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder={t('registerBusiness.promoPlaceholder')}
            />
          </FormField>
        ) : null}

        {step === 3 ? (
          <>
            <FormField label={t('registerBusiness.nameLabel')} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('registerBusiness.namePlaceholder')} />
            </FormField>
            {/*
             * F-15-006 «скрытый шаг анкеты»: у Altegio неизвестно, что именно он спрашивает — по косвенным
             * признакам (вывод в ТЗ) это имя владельца и/или размер команды. Мы уже спрашиваем размер команды
             * на шаге «Тип» (F-00-035) и не заводим отдельный шаг/маршрут под догадку — имя владельца
             * добавлено сюда же, в шаг «Контакты» (assumed).
             */}
            <div data-f="F-15-006">
              <FormField label={t('registerBusiness.ownerNameLabel')} hint={t('registerBusiness.ownerNameHint')}>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={t('registerBusiness.ownerNamePlaceholder')}
                />
              </FormField>
            </div>
            <FormField label={t('registerBusiness.phoneLabel')} required>
              <PhoneInput value={phone} onValueChange={setPhone} />
            </FormField>
          </>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-2" data-f="F-15-007">
            <p className="text-sm text-muted">{t('registerBusiness.goalsHint')}</p>
            <div className="flex flex-wrap gap-2">
              {ONBOARDING_GOAL_IDS.map((id) => (
                <Chip key={id} selected={goals.includes(id)} onClick={() => toggleGoal(id)}>
                  {t(`registerBusiness.goal.${id}`)}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between gap-3" data-f="F-15-008">
          <Button variant="ghost" onClick={goBack} disabled={step === 0}>
            {t('registerBusiness.back')}
          </Button>
          {step < 4 ? (
            <Button onClick={goNext} disabled={step === 3 && !canSubmit}>
              {t('registerBusiness.next')}
            </Button>
          ) : (
            <Button onClick={() => void handleSubmit()} loading={submit.isPending} disabled={!canSubmit}>
              {t('registerBusiness.submit')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
