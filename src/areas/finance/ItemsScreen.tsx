'use client';

/** /biz/finance/items — статьи платежей (F-07-007…009): справочник по умолчанию, создание, правка. */
import { financeItemGroup } from '@/domain/finance';
import { useState } from 'react';
import { AlertTriangle, Info, Lock, Plus, Tag } from 'lucide-react';
import { listItems } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { ItemFormModal } from '@/areas/finance/items/ItemFormModal';
import { useCan, useCurrent } from '@/demo/hooks';
import type { FinanceItem } from '@/domain/finance';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';

/**
 * Имя системной статьи «Списание штрафа» (F-07-175) — как записано в сиде (`SYSTEM_ITEMS`,
 * src/mock/slices/finance.ts). Статьи в этом разделе хранят название буквальным текстом, не ключом
 * перевода (см. qa/build/finance-g1-1.md — «не переписывал текст: риск повлиять на код/тесты»), поэтому
 * триггер сводки штрафов узнаёт свою строку по нему, а не заводит новое поле в FinanceItem.
 */
const PENALTY_ITEM_NAME = 'Списание штрафа';

/** Виды штрафов и куда уходят деньги (F-07-175) — сводка таблицы из ТЗ 07-finance-payments.md. */
const PENALTY_ROWS = ['manual', 'depositPolicy', 'cardGuarantee', 'membership', 'staff'] as const;

const ITEM_SKELETON_WIDTHS = ['16ch', '19ch', '15ch', '13ch', '18ch', '20ch', '14ch', '17ch'];

/** Скелетон строки статьи — та же рамка и высота: название, группа, плашка «системная» */
function ItemRowSkeleton({ width }: { width: string }) {
  const t = useT('finance');
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="min-h-10 min-w-0 flex-1 py-1">
        <span className="block truncate text-sm font-semibold text-fg">
          <SkeletonText width={width} />
        </span>
        <span className="block truncate text-xs text-muted">
          <SkeletonText width="10ch" />
        </span>
      </span>
      <Badge tone="neutral" variant="outline" size="sm" icon={<Lock aria-hidden />}>
        {t('items.system')}
      </Badge>
    </li>
  );
}

export function ItemsScreen() {
  const t = useT('finance');
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');
  const [editing, setEditing] = useState<FinanceItem | 'new' | null>(null);
  const [penaltyInfoOpen, setPenaltyInfoOpen] = useState(false);

  const q = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: ready && Boolean(businessId) });

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const items = q.data ?? [];
  const income = items.filter((i) => i.kind === 'income');
  const expense = items.filter((i) => i.kind === 'expense');

  return (
    <div data-f="F-07-007" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('items.title')}
        description={t('items.subtitle')}
        actions={
          canEdit && (
            <Button data-f="F-07-008 F-08-121" leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
              {t('items.add')}
            </Button>
          )
        }
      />

      {q.isLoading ? (
        // Скелетон — те же две группы строк, что в демо у бизнеса: по 8 статей прихода и расхода
        <div className="flex flex-col gap-6">
          {[t('items.incomeGroup'), t('items.expenseGroup')].map((label) => (
            <section key={label} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted">{label}</h2>
              <ul className="flex flex-col gap-2">
                {ITEM_SKELETON_WIDTHS.map((w, i) => (
                  <ItemRowSkeleton key={i} width={w} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Tag aria-hidden />}
          title={t('items.emptyTitle')}
          action={
            canEdit ? (
              <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
                {t('items.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {(
            [
              ['income', income, t('items.incomeGroup')],
              ['expense', expense, t('items.expenseGroup')],
            ] as const
          ).map(([, group, label]) =>
            group.length === 0 ? null : (
              <section key={label} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-muted">{label}</h2>
                <ul className="flex flex-col gap-2">
                  {group.map((item) => (
                    <li
                      key={item.id}
                      data-f="F-07-009"
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => canEdit && setEditing(item)}
                        disabled={!canEdit}
                        className="min-h-10 min-w-0 flex-1 py-1 text-left disabled:cursor-default"
                      >
                        <span
                          className={
                            canEdit
                              ? 'block truncate text-sm font-semibold text-fg underline decoration-border-strong underline-offset-2'
                              : 'block truncate text-sm font-semibold text-fg'
                          }
                        >
                          {item.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {t(`items.group.${financeItemGroup(item)}`)}
                          {item.comment ? ` · ${item.comment}` : ''}
                        </span>
                      </button>
                      {item.system && (
                        <Badge tone="neutral" variant="outline" size="sm" icon={<Lock aria-hidden />}>
                          {t('items.system')}
                        </Badge>
                      )}
                      {item.name === PENALTY_ITEM_NAME && (
                        <IconButton
                          data-f="F-07-175"
                          icon={<Info aria-hidden className="size-4" />}
                          label={t('penaltyInfo.trigger')}
                          onClick={() => setPenaltyInfoOpen(true)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <ItemFormModal
        key={editing === 'new' || editing === null ? 'new' : editing.id}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing && editing !== 'new' ? editing : undefined}
      />

      {/* F-07-175 — сводка «какие бывают штрафы и куда идут деньги» */}
      <Modal open={penaltyInfoOpen} onOpenChange={setPenaltyInfoOpen} title={t('penaltyInfo.title')} description={t('penaltyInfo.subtitle')}>
        <ul className="flex flex-col gap-3">
          {PENALTY_ROWS.map((kind) => (
            <li key={kind} className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-sm font-semibold text-fg">{t(`penaltyInfo.kind.${kind}.who`)}</p>
              <p className="mt-0.5 text-xs text-muted">{t(`penaltyInfo.kind.${kind}.how`)}</p>
              <p className="mt-1 text-xs font-medium text-fg">{t(`penaltyInfo.kind.${kind}.moves`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-fg">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-info" />
          {t('penaltyInfo.notSalary')}
        </p>
      </Modal>
    </div>
  );
}
