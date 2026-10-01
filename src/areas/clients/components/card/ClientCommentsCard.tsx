'use client';

/**
 * История комментариев (F-04-070, F-04-197). Поле ввода — своим состоянием здесь, а не в экране карточки (§18 п. 9).
 * Удаление — сразу и с «Отменить» в тосте, без «Вы уверены?» (§0 «мелкое обратимое», ux-r2 №10).
 */
import { useState } from 'react';
import { MessageSquareText, Trash2 } from 'lucide-react';
import { addComment, deleteComment, listComments } from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { ClientComment } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export interface ClientCommentsCardProps {
  clientId: Id;
  staffId: Id | undefined;
  authorName: string;
  canView: boolean;
  canAdd: boolean;
  canDeleteOwn: boolean;
  canDeleteOthers: boolean;
}

export function ClientCommentsCard({ clientId, staffId, authorName, canView, canAdd, canDeleteOwn, canDeleteOthers }: ClientCommentsCardProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const toast = useToast();
  const [text, setText] = useState('');
  const commentsQ = useApiQuery(['clients', 'comments', clientId], () => listComments(clientId), { enabled: canView });
  const add = useApiMutation(addComment);
  const remove = useApiMutation((args: { clientId: Id; commentId: Id }) => deleteComment(args.clientId, args.commentId));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(commentsQ.data ?? []);

  const submit = async () => {
    if (!text.trim()) return;
    try {
      await add.mutate({ clientId, authorId: staffId ?? 'unknown', authorName, text });
      setText('');
    } catch {
      toast.error(t('card.commentFailed'));
    }
  };

  const removeWithUndo = async (c: ClientComment) => {
    try {
      await remove.mutate({ clientId, commentId: c.id });
      toast.success(t('cardView.commentDeleted'), {
        action: {
          label: t('cardView.undo'),
          onClick: () => {
            add.mutate({ clientId, authorId: c.authorId, authorName: c.authorName, text: c.text }).catch(() => toast.error(t('card.commentFailed')));
          },
        },
      });
    } catch {
      toast.error(t('cardView.commentDeleteFailed'));
    }
  };

  if (!canView && !canAdd) return null;
  const comments = commentsQ.data ?? [];

  return (
    <div data-f="F-04-070 F-04-197">
      <SectionCard title={t('card.comments')}>
        <div className="flex flex-col gap-4">
          {canView &&
            (commentsQ.isLoading ? (
              <Skeleton lines={2} />
            ) : comments.length === 0 ? (
              <EmptyState variant="inline" icon={<MessageSquareText aria-hidden />} title={t('card.noComments')} description={t('cardView.noCommentsText')} />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {pageItems.map((c) => {
                  const canDelete = c.authorId === staffId ? canDeleteOwn : canDeleteOthers;
                  return (
                    <li key={c.id} className="rounded-xl bg-surface-2 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-fg">{c.authorName}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-sm text-muted">{fmt.ago(c.createdAt)}</span>
                          {canDelete && (
                            <IconButton
                              icon={<Trash2 aria-hidden />}
                              label={t('card.deleteComment')}
                              size="sm"
                              variant="ghost"
                              onClick={() => removeWithUndo(c)}
                            />
                          )}
                        </span>
                      </div>
                      <p className="text-base text-fg">{c.text}</p>
                    </li>
                  );
                })}
              </ul>
            ))}
          {canView && pager}
          {canAdd && (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
              <Textarea className="flex-1" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('card.newComment')} />
              <Button className="self-end" loading={add.isPending} disabled={!text.trim()} onClick={submit}>
                {t('card.addComment')}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
