'use client';

/**
 * F-13-079/F-13-080: Google Analytics — управление связками «поток GA — форма записи». Одна форма — один
 * поток (F-13-079 «Готово, когда»); удаление убирает связь только у нас, в самом GA данные остаются.
 */
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { addGaStream, deleteGaStream, updateGaStream } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { AppInstall } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { useConfirm, useToast } from '@/ui/Toast';

/** F-13-079: «выбор формы онлайн-записи из списка» — формы виджета записи раздела «Онлайн-запись» */
const BOOKING_FORMS = [
  'Основная форма записи',
  'Виджет на сайте',
  'Ссылка в Instagram',
];

export function GaStreamsSettings({
  install,
  onChange,
}: {
  install: AppInstall;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const streams = install.gaStreams ?? [];
  const [editingId, setEditingId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [streamId, setStreamId] = useState('');
  const [formLabel, setFormLabel] = useState(BOOKING_FORMS[0]);

  const add = useApiMutation(() =>
    addGaStream(install.id, streamId, formLabel),
  );
  const update = useApiMutation((id: string) =>
    updateGaStream(install.id, id, streamId, formLabel),
  );
  const remove = useApiMutation((id: string) => deleteGaStream(install.id, id));

  const resetForm = () => {
    setAdding(false);
    setEditingId(undefined);
    setStreamId('');
    setFormLabel(BOOKING_FORMS[0]);
  };

  const startEdit = (id: string, current: { streamId: string; formLabel: string }) => {
    setAdding(true);
    setEditingId(id);
    setStreamId(current.streamId);
    setFormLabel(current.formLabel);
  };

  const onSubmit = async () => {
    try {
      if (editingId) await update.mutate(editingId);
      else await add.mutate(undefined);
      onChange();
      resetForm();
      toast.success(t('app.settings.ga.savedToast'));
    } catch {
      toast.error(t('app.settings.ga.validationError'));
    }
  };

  const onDelete = async (id: string) => {
    const ok = await confirm({
      title: t('app.settings.ga.deleteConfirmTitle'),
      description: t('app.settings.ga.deleteConfirmText'),
      tone: 'danger',
      confirmLabel: t('app.settings.ga.deleteCta'),
    });
    if (!ok) return;
    try {
      await remove.mutate(id);
      onChange();
      toast.success(t('app.settings.ga.deletedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-079 F-13-080" className="flex flex-col gap-4">
      <SectionCard
        title={t('app.settings.ga.title')}
        description={t('app.settings.ga.hint')}
        actions={
          !adding && (
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setAdding(true)}
            >
              {t('app.settings.ga.addCta')}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {streams.length === 0 && !adding ? (
            <EmptyState
              kind="default"
              compact
              title={t('app.settings.ga.emptyTitle')}
              description={t('app.settings.ga.emptyText')}
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  {t('app.settings.ga.addCta')}
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {streams.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-mono text-sm text-fg">{s.streamId}</p>
                    <p className="text-xs text-muted">{s.formLabel}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={t('app.settings.ga.editCta')}
                      size="sm"
                      variant="ghost"
                      icon={<Pencil className="h-4 w-4" aria-hidden />}
                      onClick={() => startEdit(s.id, s)}
                    />
                    <IconButton
                      label={t('app.settings.ga.deleteCta')}
                      size="sm"
                      variant="ghost"
                      className="text-error hover:text-error"
                      icon={<Trash2 className="h-4 w-4" aria-hidden />}
                      onClick={() => onDelete(s.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {adding && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <FormField
                label={t('app.settings.ga.streamIdLabel')}
                hint={t('app.settings.ga.streamIdHint')}
              >
                <Input
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
              </FormField>
              <FormField label={t('app.settings.ga.formLabel')}>
                <Select
                  value={formLabel}
                  onValueChange={setFormLabel}
                  options={BOOKING_FORMS.map((f) => ({ value: f, label: f }))}
                />
              </FormField>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={add.isPending || update.isPending}
                  disabled={!streamId.trim()}
                  onClick={onSubmit}
                >
                  {t('app.settings.ga.saveCta')}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  {t('app.settings.ga.cancelCta')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
