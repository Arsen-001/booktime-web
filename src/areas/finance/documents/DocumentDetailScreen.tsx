'use client';

/**
 * /biz/finance/documents/[documentId] — страница документа (F-07-024): просмотр и правка комментария,
 * ссылки на связанную операцию и визит.
 */
import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { getDocument, updateDocument } from '@/api/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useCan, useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { KeyValueList } from '@/ui/KeyValueList';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export interface DocumentDetailScreenProps {
  documentId: Id;
}

export function DocumentDetailScreen({ documentId }: DocumentDetailScreenProps) {
  const t = useT('finance');
  const tc = useT('common');
  const format = useFormat();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');

  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');

  const docQ = useApiQuery(['finance', 'documents', businessId, 'one', documentId], () => getDocument(businessId!, documentId), {
    enabled: ready && Boolean(businessId),
  });
  const saveMutation = useApiMutation((input: { note?: string }) => updateDocument(businessId!, documentId, input));

  if (docQ.isError) return <ErrorState onRetry={docQ.refetch} title={t('documents.detail.notFound')} />;
  if (docQ.isLoading || !docQ.data) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 p-4">
        <Skeleton lines={8} />
      </div>
    );
  }

  const doc = docQ.data;

  const startEdit = () => {
    setNote(doc.note ?? '');
    setEditing(true);
  };

  const save = async () => {
    try {
      await saveMutation.mutate({ note: note.trim() || undefined });
      toast.success(t('documents.detail.saved'));
      setEditing(false);
    } catch {
      toast.error(t('documents.detail.saveFailed'));
    }
  };

  return (
    <div data-f="F-07-024 F-08-122" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        back={{ href: '/biz/finance/documents' }}
        title={doc.number}
        description={`${format.date(doc.date, 'short')}, ${format.time(doc.date)}`}
        meta={<Badge tone="neutral">{t(`documents.type.${doc.type}`)}</Badge>}
        actions={
          canEdit &&
          !editing && (
            <Button variant="secondary" leftIcon={<Pencil aria-hidden />} onClick={startEdit}>
              {t('documents.detail.edit')}
            </Button>
          )
        }
      />

      <SectionCard title={t('documents.detail.title')}>
        <KeyValueList
          columns={2}
          items={[
            { label: t('documents.detail.type'), value: t(`documents.type.${doc.type}`) },
            { label: t('documents.detail.content'), value: doc.contentKind ? t(`documents.contentKind.${doc.contentKind}`) : '—' },
            { label: t('documents.detail.amount'), value: <span className="font-semibold text-fg">{format.money(doc.amount)}</span> },
            { label: t('documents.detail.date'), value: `${format.date(doc.date, 'short')}, ${format.time(doc.date)}` },
            doc.refOperationId
              ? {
                  label: t('documents.detail.openOperation'),
                  value: (
                    <Link
                      href={`/biz/finance/operations/${doc.refOperationId}`}
                      className="inline-flex items-center gap-1 text-primary-text underline decoration-border-strong underline-offset-2"
                    >
                      {t('documents.detail.openOperation')} <ExternalLink aria-hidden className="size-3.5" />
                    </Link>
                  ),
                }
              : undefined,
            doc.refBookingId
              ? {
                  label: t('documents.detail.openVisit'),
                  value: (
                    <Link
                      href={`/biz/journal?booking=${doc.refBookingId}`}
                      className="inline-flex items-center gap-1 text-primary-text underline decoration-border-strong underline-offset-2"
                    >
                      {t('documents.detail.openVisit')} <ExternalLink aria-hidden className="size-3.5" />
                    </Link>
                  ),
                }
              : undefined,
          ].filter((x): x is NonNullable<typeof x> => Boolean(x))}
        />
      </SectionCard>

      <SectionCard title={t('documents.detail.note')}>
        {editing ? (
          <div className="flex flex-col gap-4">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t('documents.detail.notePlaceholder')} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={save} loading={saveMutation.isPending}>
                {tc('actions.save')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg">{doc.note || <span className="text-muted">{t('documents.detail.noteEmpty')}</span>}</p>
        )}
      </SectionCard>
    </div>
  );
}
