'use client';

/**
 * /biz/loyalty/promotions/[promotionId] — правка и удаление акции (F-06-050): те же поля мастера, все
 * секции сразу вместо шагов, «Сохранить» и «Удалить акцию» внизу.
 *
 * Внутренняя форма монтируется только после того, как акция загрузилась, поэтому черновик
 * инициализируется сразу нужными значениями — без эффекта, переносящего данные запроса в состояние.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Percent } from 'lucide-react';
import { deletePromotion, getPromotion, updatePromotion } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { validatePromotion, type Promotion } from '@/domain/loyalty';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useT } from '@/i18n/useT';
import {
  Section1NameType,
  Section2Kind,
  Section3Calc,
  Section4Rules,
  Section5Scope,
  useCardTypesList,
} from '@/areas/loyalty/promotions/PromotionFormSections';
import { draftFromPromotion, draftToInput, type PromotionDraft } from '@/areas/loyalty/promotions/promotionDraft';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useConfirm, useToast } from '@/ui/Toast';

export function PromotionEditScreen({ promotionId }: { promotionId: Id }) {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();

  const q = useApiQuery(['loyalty', 'promotion', businessId, promotionId], () => getPromotion(businessId!, promotionId), {
    enabled: ready && Boolean(businessId),
  });

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading || !ready) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  if (!q.data) return <EmptyState icon={<Percent aria-hidden />} title={t('promotionWizard.notFound')} />;

  return <PromotionEditBody key={promotionId} promotionId={promotionId} promotion={q.data} />;
}

function PromotionEditBody({ promotionId, promotion }: { promotionId: Id; promotion: Promotion }) {
  const t = useT('loyalty');
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { businessId } = useCurrent();
  const cardTypes = useCardTypesList();

  const updateMutation = useApiMutation((input: ReturnType<typeof draftToInput>) => updatePromotion(businessId!, promotionId, input));

  const [draft, setDraft] = useState<PromotionDraft>(() => draftFromPromotion(promotion));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(draftFromPromotion(promotion)));
  const [showErrors, setShowErrors] = useState(false);
  const patch = (p: Partial<PromotionDraft>) => setDraft((d) => ({ ...d, ...p }));
  // Л3: та же проверка, что в мастере и в api; ошибки видны после первой попытки сохранить
  const errors = validatePromotion(draftToInput(draft));
  const visibleErrors = showErrors ? errors : {};
  // Л15: несохранённые правки не теряются молча при уходе со страницы
  const dirty = JSON.stringify(draft) !== savedSnapshot;
  useUnsavedGuard(dirty);

  const save = async () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      toast.error(t('promotionWizard.errors.fixBeforeContinue'));
      return;
    }
    try {
      await updateMutation.mutate(draftToInput(draft));
      setSavedSnapshot(JSON.stringify(draft));
      toast.success(t('promotionWizard.saved'));
    } catch {
      toast.error(t('promotionWizard.saveFailed'));
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: t('promotionWizard.deleteConfirmTitle'), tone: 'danger', confirmLabel: t('promotionWizard.deleteConfirm') });
    if (!ok) return;
    try {
      await deletePromotion(businessId!, promotionId);
      toast.success(t('promotionWizard.deleted'));
      setSavedSnapshot(JSON.stringify(draft));
      router.push('/biz/loyalty/promotions');
    } catch {
      toast.error(t('promotionWizard.deleteFailed'));
    }
  };

  return (
    <div data-f="F-06-050" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={t('promotionWizard.editTitle', { name: promotion.name })} back={{ href: '/biz/loyalty/promotions' }} />

      <SectionCard title={`1. ${t('promotionWizard.steps.name')}`}>
        <Section1NameType draft={draft} patch={patch} locked errors={visibleErrors} />
      </SectionCard>
      <SectionCard title={`2. ${t('promotionWizard.steps.kind')}`}>
        <Section2Kind draft={draft} patch={patch} locked />
      </SectionCard>
      <SectionCard title={`3. ${t('promotionWizard.steps.calc')}`}>
        <Section3Calc draft={draft} patch={patch} errors={visibleErrors} />
      </SectionCard>
      <SectionCard title={`4. ${t('promotionWizard.steps.rules')}`}>
        <Section4Rules draft={draft} patch={patch} errors={visibleErrors} />
      </SectionCard>
      <SectionCard title={`5. ${t('promotionWizard.steps.scope')}`}>
        <Section5Scope draft={draft} patch={patch} cardTypes={cardTypes} excludePromotionId={promotionId} errors={visibleErrors} />
      </SectionCard>

      <StickyActionBar>
        <Button variant="danger" onClick={remove}>
          {t('promotionWizard.delete')}
        </Button>
        <Button onClick={save} loading={updateMutation.isPending}>
          {t('promotionWizard.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}
