'use client';

/**
 * /biz/loyalty/promotions/new — мастер «Создание акции», 5 шагов (F-06-032…F-06-036), назад без потери
 * ввода (весь черновик живёт в одном useState), «Отмена» закрывает мастер без создания акции.
 *
 * recheck-c3 (25.09.2026): по прямому адресу мастер открывался и без единого типа карты, и позволял
 * создать акцию с `cardTypeIds: []` — «применится никому», но тихо оседала в базе и не видна в списке
 * (список закрыт EmptyState'ом, пока нет типов). Плюс двойной клик по «Добавить акцию» успевал создать
 * акцию дважды: `mutation.isPending` гаснет сразу после ответа мока, ДО завершения `router.push` —
 * в этом окне кнопка снова кликабельна. Чиним оба: EmptyState вместо мастера при нуле типов карт +
 * локальный флаг `submitted`, который не гаснет обратно (в отличие от `isPending`).
 */
import { useState } from 'react';
import { validatePromotion, type PromotionValidationErrors, type PromotionValidationField } from '@/domain/loyalty';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useRouter } from 'next/navigation';
import { Percent, Plus } from 'lucide-react';
import { createPromotion, listCardTypes } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import {
  Section1NameType,
  Section2Kind,
  Section3Calc,
  Section4Rules,
  Section5Scope,
} from '@/areas/loyalty/promotions/PromotionFormSections';
import { defaultDraft, draftToInput, type PromotionDraft } from '@/areas/loyalty/promotions/promotionDraft';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Stepper } from '@/ui/Stepper';
import { useToast } from '@/ui/Toast';

const STEP_IDS = ['name', 'kind', 'calc', 'rules', 'scope'] as const;

/** Л3: какие поля проверяются на каком шаге — «Продолжить» не пускает дальше с ошибкой на текущем */
const STEP_FIELDS: PromotionValidationField[][] = [['name'], [], ['value', 'thresholds', 'conditionCount', 'applyFrequency'], ['days'], ['validTo']];

function pick(errors: PromotionValidationErrors, fields: PromotionValidationField[]): PromotionValidationErrors {
  return Object.fromEntries(fields.filter((f) => errors[f]).map((f) => [f, errors[f]]));
}

export function PromotionWizardScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const typesQ = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const cardTypes = typesQ.data ?? [];

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PromotionDraft>(defaultDraft);
  const [pristine] = useState(() => JSON.stringify(defaultDraft()));
  /** Шаги, на которых уже пробовали «Продолжить» — ошибки показываем только там, не с первого символа */
  const [shownSteps, setShownSteps] = useState<number[]>([]);
  // F-06-004/recheck-c3: не полагаемся на mutation.isPending одной для гейта кнопки — оно гаснет ДО
  // завершения router.push, и второй клик в этом окне успевает создать вторую акцию.
  const [submitted, setSubmitted] = useState(false);
  const patch = (p: Partial<PromotionDraft>) => setDraft((d) => ({ ...d, ...p }));

  const mutation = useApiMutation((input: ReturnType<typeof draftToInput>) => createPromotion(businessId!, input));

  const steps = STEP_IDS.map((id) => ({ id, label: t(`promotionWizard.steps.${id}`) }));

  const allErrors = validatePromotion(draftToInput(draft));
  const stepErrors = (i: number) => pick(allErrors, STEP_FIELDS[i]);
  const visibleErrors: PromotionValidationErrors = Object.assign({}, ...shownSteps.map(stepErrors));
  const canContinue = step !== 0 || draft.name.trim().length > 0;
  // Л15: мастер не уходит молча — наш вопрос «Уйти без сохранения?» на ссылках, «Назад» в шапке и «Отмена»
  const { confirmLeave } = useUnsavedGuard(!submitted && JSON.stringify(draft) !== pristine);

  const next = () => {
    if (Object.keys(stepErrors(step)).length > 0) {
      setShownSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
      toast.error(t('promotionWizard.errors.fixBeforeContinue'));
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const cancel = async () => {
    if (await confirmLeave()) router.push('/biz/loyalty/promotions');
  };

  // Без единого типа карты акция «применится никому» — Section5Scope уже пишет это в подсказке (F-06-036),
  // а не блокирует: пустой cardTypeIds — рабочий путь для акции, которую заведут ТОЛЬКО для рефералки
  // (F-06-082, showReferralWarning) — она намеренно ни к одному типу не привязана.
  const submit = async () => {
    if (submitted) return;
    if (Object.keys(allErrors).length > 0) {
      // ошибка на пройденном шаге — вернуть туда, где её видно
      const firstBad = STEP_FIELDS.findIndex((fields) => fields.some((f) => allErrors[f]));
      setShownSteps(STEP_FIELDS.map((_, i) => i));
      if (firstBad >= 0) setStep(firstBad);
      toast.error(t('promotionWizard.errors.fixBeforeContinue'));
      return;
    }
    setSubmitted(true);
    try {
      await mutation.mutate(draftToInput(draft));
      toast.success(t('promotionWizard.created'));
      router.push('/biz/loyalty/promotions');
    } catch {
      setSubmitted(false);
      toast.error(t('promotionWizard.createFailed'));
    }
  };

  // F-06-004: без единого типа карты у бизнеса акция никому не применится — тот же тупик, что и список
  // «Акции» (PromotionsScreen), с той же подсказкой и кнопкой «Добавить тип карты», а не рабочий мастер.
  if (typesQ.isLoading) {
    return (
      <div data-f="F-06-032" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton lines={6} />
      </div>
    );
  }
  if (!cardTypes.length) {
    return (
      <div data-f="F-06-032 F-06-004" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('promotionWizard.title')} description={t('promotionWizard.subtitle')} back={{ href: '/biz/loyalty/promotions' }} />
        <EmptyState
          icon={<Percent aria-hidden />}
          title={t('promotions.needCardTypeTitle')}
          description={t('promotions.needCardTypeText')}
          action={
            <LinkButton href="/biz/loyalty/card-types/new" leftIcon={<Plus aria-hidden />}>
              {t('cardTypes.add')}
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div data-f="F-06-032" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={t('promotionWizard.title')} description={t('promotionWizard.subtitle')} back={{ href: '/biz/loyalty/promotions' }} />

      <Stepper steps={steps} current={step} onStepClick={(i) => i < step && setStep(i)} />

      <SectionCard title={steps[step].label}>
        {step === 0 && <Section1NameType draft={draft} patch={patch} errors={visibleErrors} />}
        {step === 1 && <Section2Kind draft={draft} patch={patch} />}
        {step === 2 && <Section3Calc draft={draft} patch={patch} errors={visibleErrors} />}
        {step === 3 && <Section4Rules draft={draft} patch={patch} errors={visibleErrors} />}
        {step === 4 && <Section5Scope draft={draft} patch={patch} cardTypes={cardTypes} errors={visibleErrors} />}
      </SectionCard>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={back}>
              {t('promotionWizard.back')}
            </Button>
          )}
          <Button variant="ghost" onClick={cancel}>
            {t('promotionWizard.cancel')}
          </Button>
        </div>
        {step < steps.length - 1 ? (
          <Button onClick={next} disabled={!canContinue}>
            {t('promotionWizard.continue')}
          </Button>
        ) : (
          <Button onClick={submit} loading={mutation.isPending || submitted}>
            {t('promotionWizard.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
