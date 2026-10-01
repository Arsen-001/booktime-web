'use client';

/** Идея: текст, автор, голоса; статус — выбором «Рассматриваем · В работе · Сделано». «Сделано» уведомляет автора — спросим. */
import { BellRing, ThumbsUp } from 'lucide-react';
import { setIdeaStatus } from '@/api/platform';
import { patchInList, useApiMutation } from '@/api/request';
import { IDEA_TONE } from '@/areas/platform/lib/tones';
import type { Idea, IdeaStatus } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { FormField } from '@/ui/FormField';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { useConfirm, useToast } from '@/ui/Toast';

const STATUSES: IdeaStatus[] = ['considering', 'inProgress', 'done'];

export function IdeaSheet({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const save = useApiMutation((a: { id: string; status: IdeaStatus }) => setIdeaStatus(a.id, a.status), {
    optimistic: patchInList(['platform', 'ideas'], (a: { id: string; status: IdeaStatus }) => ({ id: a.id, patch: { status: a.status } })),
  });

  const change = async (status: IdeaStatus) => {
    if (status === idea.status) return;
    if (status === 'done' && !idea.notifiedAt) {
      const ok = await confirm({ title: t('ideas.doneConfirmTitle'), description: t('ideas.doneConfirmText', { name: idea.authorName }), confirmLabel: t('ideas.doneConfirm'), tone: 'primary' });
      if (!ok) return;
    }
    try {
      await save.mutate({ id: idea.id, status });
      toast.success(status === 'done' ? t('ideas.notifiedAuthor', { name: idea.authorName }) : t('ideas.statusSaved', { status: t(`ideas.status.${status}`) }));
    } catch {
      toast.error(t('ideas.saveFailed'));
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={t('ideas.detailsTitle')} size="md">
      <div data-f="F-00-009" className="flex flex-col gap-5">
        <p className="text-lg leading-snug text-fg">{idea.text}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{idea.authorName}</span>
          <span aria-hidden>·</span>
          <span>{fmt.ago(idea.createdAt)}</span>
          <Badge tone="neutral" icon={<ThumbsUp aria-hidden />}>{t('ideas.votes', { n: idea.votes })}</Badge>
          <Badge tone={IDEA_TONE[idea.status]}>{t(`ideas.status.${idea.status}`)}</Badge>
        </div>
        <FormField label={t('ideas.changeStatus')}>
          <SegmentedControl fullWidth value={idea.status} onValueChange={(v) => void change(v as IdeaStatus)} options={STATUSES.map((s) => ({ value: s, label: t(`ideas.status.${s}`) }))} />
        </FormField>
        {idea.notifiedAt && (
          <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-fg">
            <BellRing aria-hidden className="size-4 text-success" />
            {t('ideas.notifiedNote', { date: fmt.date(idea.notifiedAt, 'dayMonth') })}
          </p>
        )}
      </div>
    </Sheet>
  );
}
