'use client';

/** Пункт «до постройки» в раскрытом виде: статус, решение, заметка; «Сохранить» — только если что-то поменяли. */
import { useState } from 'react';
import { savePrelaunchItem } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import type { PrelaunchItem, PrelaunchStatus } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const STATUSES: PrelaunchStatus[] = ['open', 'decided', 'done'];

export function PrelaunchItemForm({ item, hint }: { item: PrelaunchItem; hint: string }) {
  const t = useT('platform');
  const toast = useToast();
  const save = useApiMutation((a: { id: string; patch: Partial<Pick<PrelaunchItem, 'status' | 'decision' | 'note'>> }) => savePrelaunchItem(a.id, a.patch));
  const [status, setStatus] = useState(item.status);
  const [decision, setDecision] = useState(item.decision);
  const [note, setNote] = useState(item.note);
  const dirty = status !== item.status || decision !== item.decision || note !== item.note;

  const submit = async () => {
    try {
      await save.mutate({ id: item.id, patch: { status, decision, note } });
      toast.success(t('plan.saved'));
    } catch {
      toast.error(t('plan.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{hint}</p>
      <SegmentedControl fullWidth size="sm" value={status} onValueChange={(v) => setStatus(v as PrelaunchStatus)} options={STATUSES.map((s) => ({ value: s, label: t(`plan.prelaunchStatus.${s}`) }))} />
      <FormField label={t('plan.decision')} optional>
        <Input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder={t('plan.decisionPlaceholder')} />
      </FormField>
      <FormField label={t('plan.note')} optional>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </FormField>
      {dirty && (
        <Button size="sm" className="self-start" onClick={submit} loading={save.isPending}>
          {t('plan.save')}
        </Button>
      )}
    </div>
  );
}
