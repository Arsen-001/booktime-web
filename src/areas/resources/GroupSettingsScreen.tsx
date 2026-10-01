'use client';

/**
 * /biz/groups/settings — настройки групповых событий: категории событий (F-16-043) и «несколько мест
 * для одного клиента» (F-16-049). Раздел «resources» (свой путь под /biz/groups).
 */
import { useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import {
  createEventCategory,
  deleteEventCategory,
  getGroupSeatsSettings,
  listEventCategories,
  saveGroupSeatsSettings,
  updateEventCategory,
  type EventCategory,
} from '@/api/resources';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ColorPicker } from '@/ui/ColorPicker';
import { ColorSwatch } from '@/ui/ColorSwatch';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

interface CategoryDraft {
  id?: string;
  name: string;
  colorIndex: number;
}

export function GroupSettingsScreen() {
  const t = useT('resources');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canManage = useCan('resources.manage');

  const categoriesQ = useApiQuery(['resources', 'event-categories', businessId], () => listEventCategories(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const seatsQ = useApiQuery(['resources', 'group-seats-settings', businessId], () => getGroupSeatsSettings(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });

  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EventCategory | null>(null);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const create = useApiMutation((args: { name: string; colorIndex: number }) => createEventCategory(businessId ?? '', args.name, args.colorIndex));
  const update = useApiMutation((args: { id: string; name: string; colorIndex: number }) =>
    updateEventCategory(args.id, { name: args.name, colorIndex: args.colorIndex }),
  );
  const remove = useApiMutation((id: string) => deleteEventCategory(id));

  const [allowMultiSeat, setAllowMultiSeat] = useState(true);
  const [maxSeats, setMaxSeats] = useState(6);
  const [loadedSeatsFor, setLoadedSeatsFor] = useState<string | null>(null);
  if (seatsQ.data && loadedSeatsFor !== businessId) {
    setAllowMultiSeat(seatsQ.data.allowMultiSeat);
    setMaxSeats(seatsQ.data.maxSeats);
    setLoadedSeatsFor(businessId ?? null);
  }
  const saveSeats = useApiMutation(() => saveGroupSeatsSettings(businessId ?? '', { allowMultiSeat, maxSeats }));
  const seatsDirty = seatsQ.data && (seatsQ.data.allowMultiSeat !== allowMultiSeat || seatsQ.data.maxSeats !== maxSeats);

  const categories = categoriesQ.data ?? [];

  const submitCategory = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setNameError(t('categories.form.nameRequired'));
      return;
    }
    try {
      if (draft.id) await update.mutate({ id: draft.id, name: draft.name, colorIndex: draft.colorIndex });
      else await create.mutate({ name: draft.name, colorIndex: draft.colorIndex });
      toast.success(t('form.updated'));
      setDraft(null);
      categoriesQ.refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? t('form.saveFailed') : t('form.saveFailed'));
    }
  };

  return (
    <div data-f="F-16-049 F-16-043 F-16-087 F-15-126" className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <PageHeader title={t('groups.settingsTitle')} back={{ href: '/biz/groups' }} />

      <SectionCard title={t('groups.seatsSettingTitle')} description={t('groups.seatsSettingDescription')} classNames={{ body: 'flex flex-col gap-4' }}>
        {seatsQ.isLoading ? (
          <Skeleton lines={2} />
        ) : (
          <>
            <Checkbox disabled={!canManage} checked={allowMultiSeat} onCheckedChange={setAllowMultiSeat} label={t('groups.allowMultiSeat')} />
            {allowMultiSeat && (
              <FormField label={t('groups.maxSeats')} className="max-w-xs">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => setMaxSeats((n) => Math.max(1, n - 1))}
                    aria-label={t('event.form.capacityMinus')}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center text-base font-semibold tabular-nums text-fg">{maxSeats}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => setMaxSeats((n) => n + 1)}
                    aria-label={t('event.form.capacityPlus')}
                  >
                    +
                  </Button>
                </div>
              </FormField>
            )}
            {canManage && (
              <Button
                className="self-start"
                loading={saveSeats.isPending}
                disabled={!seatsDirty}
                onClick={async () => {
                  try {
                    await saveSeats.mutate(undefined);
                    toast.success(t('form.updated'));
                    seatsQ.refetch();
                  } catch {
                    toast.error(t('form.saveFailed'));
                  }
                }}
              >
                {t('form.save')}
              </Button>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title={t('categories.title')}
        description={t('categories.description')}
        actions={
          canManage ? (
            <Button
              size="sm"
              leftIcon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setNameError(undefined);
                setDraft({ name: '', colorIndex: 1 });
              }}
            >
              {t('categories.add')}
            </Button>
          ) : undefined
        }
      >
        {categoriesQ.isError ? (
          <ErrorState onRetry={categoriesQ.refetch} />
        ) : categoriesQ.isLoading ? (
          <Skeleton lines={3} />
        ) : categories.length === 0 ? (
          <EmptyState
            compact
            icon={<Tags aria-hidden />}
            title={t('categories.emptyTitle')}
            description={t('categories.emptyText')}
            action={
              canManage ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setNameError(undefined);
                    setDraft({ name: '', colorIndex: 1 });
                  }}
                >
                  {t('categories.add')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {categories.map((c) => (
              <li key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2">
                <Badge tone="neutral" variant="outline" icon={<ColorSwatch colorIndex={c.colorIndex} label={c.name} size="sm" />}>
                  {c.name}
                </Badge>
                {canManage && (
                  <div className="ml-auto flex gap-1">
                    <IconButton
                      icon={<Pencil aria-hidden />}
                      label={t('categories.edit')}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNameError(undefined);
                        setDraft({ id: c.id, name: c.name, colorIndex: c.colorIndex });
                      }}
                    />
                    <IconButton
                      icon={<Trash2 aria-hidden />}
                      label={t('categories.delete')}
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => setConfirmDelete(c)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Modal
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('categories.editTitle') : t('categories.addTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('form.cancel')}
            </Button>
            <Button loading={create.isPending || update.isPending} onClick={submitCategory}>
              {t('form.save')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <FormField label={t('categories.form.name')} error={nameError} required>
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t('categories.form.namePlaceholder')}
              />
            </FormField>
            <ColorPicker
              value={draft.colorIndex}
              onValueChange={(colorIndex) => setDraft({ ...draft, colorIndex })}
              label={t('categories.form.color')}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        tone="danger"
        title={confirmDelete ? t('categories.confirmDeleteTitle', { name: confirmDelete.name }) : ''}
        description={t('categories.confirmDeleteText')}
        confirmLabel={t('categories.delete')}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await remove.mutate(confirmDelete.id);
            toast.success(t('form.updated'));
            setConfirmDelete(null);
            categoriesQ.refetch();
          } catch {
            toast.error(t('form.saveFailed'));
          }
        }}
      />
    </div>
  );
}
