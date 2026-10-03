'use client';

/**
 * Карточка места: статус и система записи, сведения, ссылки (новая вкладка), источники, визиты, заметка.
 * Главное действие внизу — «Записать визит» (открывает визит с уже заполненным местом). В «⋯» — изменить и удалить.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useProspect } from '@/areas/platform/hooks/usePlatformData';
import { ProspectBody, ProspectBodySkeleton } from '@/areas/platform/prospects/ProspectBody';
import { ProspectForm } from '@/areas/platform/prospects/ProspectForm';
import { ProspectMenu } from '@/areas/platform/prospects/ProspectMenu';
import { visitPrefillFromProspect, type VisitInput } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';

export function ProspectSheet({ id, onClose, onRecordVisit }: { id: string; onClose: () => void; onRecordVisit: (prefill: Partial<VisitInput>) => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const q = useProspect(id);
  const [editing, setEditing] = useState(false);
  const p = q.data;

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={p ? p.name : <SkeletonText width="14ch" />}
      description={
        p ? [t(`prospects.category.${p.category}`), p.district === 'unknown' ? t('prospects.districtUnknown') : tc(`districts.${p.district}`)].join(' · ') : <SkeletonText width="20ch" />
      }
      size="md"
      headerActions={p && !editing ? <ProspectMenu prospect={p} onEdit={() => setEditing(true)} onDeleted={onClose} /> : undefined}
      footer={
        !editing && (
          <Button fullWidth leftIcon={<Plus aria-hidden />} disabled={!p} onClick={() => p && onRecordVisit(visitPrefillFromProspect(p))}>
            {t('prospects.recordVisit')}
          </Button>
        )
      }
    >
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !p ? (
        <ProspectBodySkeleton />
      ) : editing ? (
        <ProspectForm key={p.version} prospect={p} onDone={() => setEditing(false)} />
      ) : (
        <ProspectBody key={p.version} prospect={p} />
      )}
    </Sheet>
  );
}
