'use client';

/** Справочник причин отказа — настройки, а не состояние очереди: открывается из шапки, строки можно переименовать и скрыть. */
import { useState } from 'react';
import { EyeOff, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useLocale } from 'next-intl';
import { hideRejectReason, saveRejectReason } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useRejectReasons } from '@/areas/platform/hooks/usePlatformData';
import type { LocaleCode } from '@/domain/core';
import type { RejectReason } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Sheet } from '@/ui/Sheet';
import { SkeletonList } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function ReasonsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT('platform');
  const toast = useToast();
  const locale = useLocale() as LocaleCode;
  const q = useRejectReasons();
  const save = useApiMutation(saveRejectReason);
  const hide = useApiMutation(hideRejectReason);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const add = async () => {
    if (!text.trim()) return;
    try {
      await save.mutate({ label: { ru: text.trim(), en: text.trim() }, active: true, order: (q.data?.length ?? 0) + 1 });
      setText('');
      toast.success(t('moderation.reasonAdded'));
    } catch {
      toast.error(t('moderation.actionFailed'));
    }
  };
  const rename = async (r: RejectReason) => {
    if (!editing?.text.trim()) return;
    try {
      await save.mutate({ ...r, label: { ...r.label, [locale]: editing.text.trim() } });
      setEditing(null);
      toast.success(t('moderation.reasonSaved'));
    } catch {
      toast.error(t('moderation.actionFailed'));
    }
  };
  const doHide = async (r: RejectReason) => {
    try {
      await hide.mutate(r.id);
      toast.success(t('moderation.reasonHidden'), { action: { label: t('common.undo'), onClick: () => void save.mutate({ ...r, active: true }) } });
    } catch {
      toast.error(t('moderation.actionFailed'));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('moderation.reasonsTitle')} description={t('moderation.reasonsHint')} size="md">
      <div data-f="F-00-170" className="flex flex-col gap-5">
        <form
          noValidate
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('moderation.reasonNamePlaceholder')} className="flex-1" aria-label={t('moderation.addReason')} />
          <Button type="submit" variant="outline" leftIcon={<Plus aria-hidden />} loading={save.isPending && !editing} disabled={!text.trim()}>
            {t('moderation.addReasonShort')}
          </Button>
        </form>
        {q.isError ? (
          <ErrorState compact onRetry={q.refetch} />
        ) : q.isLoading ? (
          <SkeletonList rows={4} avatar={false} />
        ) : !q.data?.length ? (
          <EmptyState variant="section" title={t('moderation.reasonsEmpty')} description={t('moderation.reasonsEmptyHint')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {q.data.map((r) => (
              <li key={r.id} className="flex min-h-14 items-center gap-2 px-3 py-2">
                {editing?.id === r.id ? (
                  <form
                    noValidate
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename(r);
                    }}
                  >
                    <Input value={editing.text} onChange={(e) => setEditing({ id: r.id, text: e.target.value })} className="flex-1" aria-label={t('moderation.renameReason')} autoFocus />
                    <Button type="submit" size="sm" loading={save.isPending}>
                      {t('moderation.save')}
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-base text-fg">{pickText(r.label, locale)}</span>
                    <DropdownMenu
                      label={t('moderation.reasonActions')}
                      trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('moderation.reasonActions')} size="sm" />}
                      items={[
                        { id: 'rename', label: t('moderation.renameReason'), icon: <Pencil aria-hidden />, onSelect: () => setEditing({ id: r.id, text: pickText(r.label, locale) }) },
                        { id: 'hide', label: t('moderation.hideReason'), icon: <EyeOff aria-hidden />, onSelect: () => void doHide(r) },
                      ]}
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
