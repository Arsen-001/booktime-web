'use client';

/**
 * F-13-172: конструктор промоблоков виджета записи — вместо общей вкладки «Настройки». Список, добавление,
 * правка, включение/отключение, удаление; предпросмотр «ровно один блок на экран» для «Выбор услуги».
 */
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  createPromoBlock,
  deletePromoBlock,
  listPromoBlocks,
  setPromoBlockEnabled,
  updatePromoBlock,
} from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import { CATEGORY_ICON } from '@/areas/integrations/catalog';
import { PromoBlockModal } from '@/areas/integrations/components/settings/PromoBlockModal';
import { useCurrent } from '@/demo/hooks';
import {
  promoBlockForPlacement,
  type PromoBlock,
  type PromoBlockDraft,
} from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useConfirm, useToast } from '@/ui/Toast';

export function PromoBlockSettings() {
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const {
    businessId,
    locationId: selectedLocationId,
    locationIds,
    ready,
  } = useCurrent();
  const currentLocationId =
    selectedLocationId && selectedLocationId !== 'all'
      ? selectedLocationId
      : locationIds[0];
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromoBlock | undefined>();

  const blocksQ = useApiQuery(
    ['integrations', 'promoBlocks', businessId],
    () => listPromoBlocks(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  const create = useApiMutation((draft: PromoBlockDraft) =>
    createPromoBlock({
      businessId: businessId!,
      locationId: currentLocationId!,
      draft,
    }),
  );
  const update = useApiMutation(
    ({ id, draft }: { id: string; draft: PromoBlockDraft }) =>
      updatePromoBlock(id, draft),
  );
  const toggle = useApiMutation(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      setPromoBlockEnabled(id, enabled),
  );
  const remove = useApiMutation((id: string) => deletePromoBlock(id));

  const blocks = blocksQ.data ?? [];
  const CategoryIcon = CATEGORY_ICON.marketing;

  const openAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };
  const openEdit = (block: PromoBlock) => {
    setEditing(block);
    setModalOpen(true);
  };

  const onSubmit = async (draft: PromoBlockDraft) => {
    try {
      if (editing) await update.mutate({ id: editing.id, draft });
      else await create.mutate(draft);
      setModalOpen(false);
      blocksQ.refetch();
      toast.success(t('app.settings.promo.savedToast'));
    } catch {
      toast.error(t('app.settings.promo.validationError'));
    }
  };

  const onToggle = async (block: PromoBlock, enabled: boolean) => {
    try {
      await toggle.mutate({ id: block.id, enabled });
      blocksQ.refetch();
      toast.success(t('app.settings.promo.toggledToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onDelete = async (block: PromoBlock) => {
    const ok = await confirm({
      title: t('app.settings.promo.deleteConfirmTitle'),
      description: t('app.settings.promo.deleteConfirmText'),
      tone: 'danger',
      confirmLabel: t('app.settings.promo.deleteCta'),
    });
    if (!ok) return;
    try {
      await remove.mutate(block.id);
      blocksQ.refetch();
      toast.success(t('app.settings.promo.deletedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const previewBlock = promoBlockForPlacement(blocks, 'serviceSelect');

  return (
    <div data-f="F-13-172" className="flex flex-col gap-4">
      <SectionCard
        title={t('app.settings.promo.title')}
        description={t('app.settings.promo.hint')}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={openAdd}
          >
            {t('app.settings.promo.addCta')}
          </Button>
        }
      >
        {blocksQ.isLoading ? (
          <Skeleton lines={3} />
        ) : blocks.length === 0 ? (
          <EmptyState
            compact
            title={t('app.settings.promo.emptyTitle')}
            description={t('app.settings.promo.emptyText')}
            action={
              <Button size="sm" onClick={openAdd}>
                {t('app.settings.promo.addCta')}
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text"
                  aria-hidden
                >
                  <CategoryIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {block.headline}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {block.description}
                  </p>
                </div>
                <Badge
                  tone={block.enabled ? 'success' : 'neutral'}
                  variant="soft"
                >
                  {block.enabled
                    ? t('app.settings.promo.enabledBadge')
                    : t('app.settings.promo.disabledBadge')}
                </Badge>
                <Switch
                  checked={block.enabled}
                  onCheckedChange={(v) => onToggle(block, v)}
                  aria-label={
                    block.enabled
                      ? t('app.settings.promo.disableCta')
                      : t('app.settings.promo.enableCta')
                  }
                />
                <IconButton
                  icon={<Pencil className="h-4 w-4" aria-hidden />}
                  label={t('app.settings.promo.editCta')}
                  onClick={() => openEdit(block)}
                  variant="ghost"
                  size="sm"
                />
                <IconButton
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  label={t('app.settings.promo.deleteCta')}
                  onClick={() => onDelete(block)}
                  variant="ghost"
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Card className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('app.settings.promo.previewTitle')}
        </p>
        {previewBlock ? (
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="text-sm font-medium text-fg">
              {previewBlock.headline}
            </p>
            {previewBlock.description && (
              <p className="text-xs text-muted">{previewBlock.description}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            {t('app.settings.promo.previewEmpty')}
          </p>
        )}
        <p className="text-xs text-muted">
          {t('app.settings.promo.previewNote')}
        </p>
      </Card>

      <PromoBlockModal
        key={editing?.id ?? 'new'}
        open={modalOpen}
        onOpenChange={setModalOpen}
        initial={
          editing
            ? {
                headline: editing.headline,
                description: editing.description,
                hasImage: editing.hasImage,
                icon: editing.icon,
                buttonText: editing.buttonText ?? '',
                buttonHref: editing.buttonHref ?? '',
                placements: editing.placements,
              }
            : undefined
        }
        submitting={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />
    </div>
  );
}
