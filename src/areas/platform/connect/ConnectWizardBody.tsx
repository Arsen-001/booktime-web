'use client';

/**
 * Шаги подключения на визите. Поля живут в состоянии экрана и уходят в черновик одним запросом на «Далее»;
 * «Подключить» — одна команда со всеми полями (одна транзакция на сервере). Главное действие — внизу у пальца.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { ApiError, useApiMutation } from '@/api/request';
import { deleteConnectDraft, finishConnectDraft, saveConnectDraft } from '@/api/platform';
import { CONNECT_ISSUE_STEP, connectIssues, type ConnectDraft, type ConnectIssue } from '@/domain/platform';
import { CONNECT_STEPS, MINUTES_LEFT, formOf, type ConnectForm, type StepErrors } from '@/areas/platform/connect/connectForm';
import { StepHours } from '@/areas/platform/connect/StepHours';
import { StepMasters } from '@/areas/platform/connect/StepMasters';
import { StepPhotos } from '@/areas/platform/connect/StepPhotos';
import { StepPlace } from '@/areas/platform/connect/StepPlace';
import { StepSalon } from '@/areas/platform/connect/StepSalon';
import { StepServices } from '@/areas/platform/connect/StepServices';
import { StepSummary } from '@/areas/platform/connect/StepSummary';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { Stepper } from '@/ui/Stepper';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useConfirm, useToast } from '@/ui/Toast';

const LAST = CONNECT_STEPS.length - 1;

/** Какое поле формы снимает какую ошибку */
const FIELD_ISSUE: Partial<Record<keyof ConnectForm, ConnectIssue>> = {
  name: 'name',
  sphereId: 'sphere',
  ownerPhone: 'ownerPhone',
  services: 'services',
  calendarMode: 'calendarMode',
};

/** Проблемы, которые решаются на этом шаге и раньше */
function issuesUpTo(form: ConnectForm, step: number): ConnectIssue[] {
  return connectIssues(form).filter((i) => CONNECT_ISSUE_STEP[i] <= step);
}

export function ConnectWizardBody({ draft }: { draft: ConnectDraft }) {
  const t = useT('platform');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [step, setStep] = useState(Math.min(draft.step, LAST));
  const [form, setForm] = useState<ConnectForm>(() => formOf(draft));
  const [errors, setErrors] = useState<StepErrors>({});
  const save = useApiMutation((patch: Partial<ConnectForm> & { step: number }) => saveConnectDraft(draft.id, patch));
  const finish = useApiMutation((patch: Partial<ConnectForm>) => finishConnectDraft(draft.id, patch));
  const remove = useApiMutation(deleteConnectDraft);

  const change = (patch: Partial<ConnectForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      (Object.keys(patch) as (keyof ConnectForm)[]).forEach((k) => {
        const issue = FIELD_ISSUE[k];
        if (issue) delete next[issue];
      });
      return next;
    });
  };

  const showIssues = (issues: ConnectIssue[]) => {
    setErrors(Object.fromEntries(issues.map((i) => [i, true])) as StepErrors);
    const first = issues[0];
    if (first !== undefined && CONNECT_ISSUE_STEP[first] < step) setStep(CONNECT_ISSUE_STEP[first]);
  };

  const goTo = async (target: number) => {
    if (target > step) {
      const issues = issuesUpTo(form, step);
      if (issues.length) return showIssues(issues);
    }
    try {
      const saved = await save.mutate({ ...form, step: target });
      // Сервер подставляет услуги новой сферы — берём их из ответа
      setForm((f) => ({ ...f, services: saved.services, calendarMode: saved.calendarMode }));
      setErrors({});
      setStep(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error(t('connect.saveFailed'));
    }
  };

  const doFinish = async () => {
    const issues = connectIssues(form);
    if (issues.length) {
      toast.error(t(`connect.issue.${issues[0]}`));
      return showIssues(issues);
    }
    try {
      const result = await finish.mutate(form);
      router.replace(`/platform/connect?done=${result.businessId}`);
    } catch (e) {
      const issue = e instanceof ApiError && e.code === 'connect_incomplete' ? (e.message.split(',')[0] as ConnectIssue) : undefined;
      toast.error(issue ? t(`connect.issue.${issue}`) : t('connect.finishFailed'));
    }
  };

  const doDelete = async () => {
    const ok = await confirm({
      title: t('connect.deleteConfirmTitle', { name: form.name || t('connect.untitled') }),
      description: t('connect.deleteConfirmText'),
      confirmLabel: t('connect.deleteDraft'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await remove.mutate(draft.id);
      toast.success(t('connect.deleted'));
      router.push('/platform/connect');
    } catch {
      toast.error(t('connect.saveFailed'));
    }
  };

  const stepId = CONNECT_STEPS[step];
  const pending = save.isPending || finish.isPending;

  return (
    <div data-f="F-00-176 F-02-100" className="flex flex-col gap-6">
      <PageHeader
        back={{ href: '/platform/connect', label: t('connect.allConnections') }}
        title={form.name.trim() || t('connect.untitled')}
        meta={
          <>
            <Badge tone="neutral">{t('connect.draftBadge')}</Badge>
            {draft.visitId && <Badge tone="info">{t('connect.fromVisit')}</Badge>}
            <span className="text-sm text-muted">{t('connect.minutesLeft', { n: MINUTES_LEFT[step] })}</span>
            {/* Удаление черновика — редкое и опасное: в меню «⋯», не рядом с «Далее» */}
            <DropdownMenu
              label={t('connect.moreActions')}
              trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('connect.moreActions')} size="sm" className="ml-auto" />}
              items={[{ id: 'delete', label: t('connect.deleteDraft'), icon: <Trash2 aria-hidden />, danger: true, onSelect: doDelete }]}
            />
          </>
        }
      />
      <Stepper
        steps={CONNECT_STEPS.map((s) => ({ id: s, label: t(`connect.stepShort.${s}`) }))}
        current={step}
        onStepClick={(i) => (i < step ? goTo(i) : undefined)}
      />

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-6" aria-live="polite">
        <div>
          {/* На телефоне название шага уже в строке «Шаг 5 из 7» над карточкой */}
          <h2 className="mb-1 text-lg font-semibold text-fg max-sm:sr-only">{t(`connect.step.${stepId}`)}</h2>
          <p className="text-sm text-muted">{t(`connect.stepHint.${stepId}`)}</p>
        </div>
        {stepId === 'salon' && <StepSalon form={form} errors={errors} onChange={change} />}
        {stepId === 'place' && <StepPlace form={form} onChange={change} />}
        {stepId === 'photos' && <StepPhotos form={form} onChange={change} />}
        {stepId === 'masters' && <StepMasters form={form} onChange={change} />}
        {stepId === 'services' && <StepServices form={form} errors={errors} onChange={change} onPickSphere={() => goTo(0)} />}
        {stepId === 'hours' && <StepHours form={form} errors={errors} onChange={change} />}
        {stepId === 'summary' && <StepSummary form={form} onChange={change} onFix={(i) => goTo(CONNECT_ISSUE_STEP[i])} />}
      </section>

      <StickyActionBar desktop="inline">
        {step > 0 && (
          <Button variant="outline" onClick={() => goTo(step - 1)} disabled={pending}>
            {t('connect.back')}
          </Button>
        )}
        {step < LAST ? (
          <Button onClick={() => goTo(step + 1)} loading={save.isPending}>
            {t('connect.next')}
          </Button>
        ) : (
          <Button onClick={doFinish} loading={finish.isPending}>
            {t('connect.finish')}
          </Button>
        )}
      </StickyActionBar>
    </div>
  );
}
