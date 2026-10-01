'use client';

/** «Шаблоны графика» (F-02-009): список, создание, правка, удаление с «Отменить» */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ScheduleTemplate } from '@/domain/schedule';
import { createTemplate, deleteTemplate, getTemplates } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { TemplateCard, TemplateCardSkeleton } from '@/areas/schedule/TemplateCard';
import { TemplateFormModal } from '@/areas/schedule/components/TemplateFormModal';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { useToast } from '@/ui/Toast';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { EmptyStateHint } from '@/ui/onboarding/EmptyStateHint';

export function TemplatesScreen() {
  const t = useT('schedule');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  // Шаблоны — общие для салона: правит тот, кто ведёт график всех (не мастер со своим графиком, ux-r2 m-22)
  const canEditSchedule = useCan('schedule.edit');
  const canSeeStaff = useCan('staff.view');
  const canEdit = canEditSchedule && canSeeStaff;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleTemplate | undefined>(undefined);

  const query = useApiQuery(['schedule', 'templates', businessId], () => getTemplates(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const remove = useApiMutation((tpl: ScheduleTemplate) => deleteTemplate(tpl.businessId, tpl.id));
  const restore = useApiMutation((tpl: ScheduleTemplate) => createTemplate(tpl));

  const doRemove = async (tpl: ScheduleTemplate) => {
    try {
      await remove.mutate(tpl);
      toast.show({
        title: t('templatesPage.deleted'),
        tone: 'success',
        durationMs: 5000,
        action: {
          label: t('panel.undo'),
          onClick: () =>
            void restore.mutate(tpl).then(
              () => toast.info(t('panel.undone')),
              () => toast.error(t('templates.saveFailed')),
            ),
        },
      });
    } catch {
      toast.error(t('templatesPage.deleteFailed'));
    }
  };

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const list = query.data ?? [];
  const loading = !ready || query.isLoading;
  // Сколько карточек рисовать при загрузке: как в прошлый раз, иначе типичный салон демо — 2 шаблона
  const skeletonCount = useSkeletonCount('templates', { loading, count: query.data?.length, fallback: 2, max: 9 });

  return (
    <div className="flex flex-col gap-6" data-f="F-02-009">
      <PageHeader
        title={t('templatesPage.title')}
        description={t('templatesPage.subtitle')}
        actions={
          canEdit &&
          (loading || list.length > 0) && (
            <Button leftIcon={<Plus aria-hidden />} onClick={openNew} disabled={loading}>
              {t('templates.create')}
            </Button>
          )
        }
      />

      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : loading ? (
        // Та же сетка карточек: первая — «по дням недели» (с кружками дней), остальные — «смены» (как в демо)
        <div aria-busy className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <TemplateCardSkeleton key={i} weekdays={i === 0} canEdit={canEdit} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyStateHint
          title={t('templatesPage.emptyTitle')}
          description={t('templatesPage.emptyText')}
          steps={[t('templatesPage.step1'), t('templatesPage.step2'), t('templatesPage.step3')]}
          action={
            canEdit ? (
              <Button leftIcon={<Plus aria-hidden />} onClick={openNew}>
                {t('templatesPage.emptyAction')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              canEdit={canEdit}
              onEdit={() => {
                setEditing(tpl);
                setFormOpen(true);
              }}
              onDelete={() => void doRemove(tpl)}
            />
          ))}
        </div>
      )}

      {businessId && <TemplateFormModal open={formOpen} onOpenChange={setFormOpen} businessId={businessId} editing={editing} />}
    </div>
  );
}
