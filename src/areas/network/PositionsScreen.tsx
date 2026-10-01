'use client';

/**
 * /biz/network/staff/positions — сетевые должности: список, форма (окно) с требованиями и услугами (F-11-104…106).
 */
import { useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  deleteNetworkPosition,
  listNetworkLocations,
  listNetworkPositionEntities,
  listServiceMigrationRows,
  saveNetworkPosition,
  type NetworkPositionInput,
} from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useLocale } from 'next-intl';
import { pickText } from '@/lib/text';
import type { Id } from '@/domain/core';
import type { NetworkPosition } from '@/domain/network';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { LocationsPicker } from '@/areas/network/lib/LocationsPicker';
import { useNetwork } from '@/areas/network/lib/useNetwork';

const EMPTY_INPUT: NetworkPositionInput = {
  name: '',
  description: '',
  requirements: [],
  networkOnly: false,
  businessIds: [],
  servicesMode: 'off',
  serviceIds: [],
  keepPriceAndDuration: true,
};

export function PositionsScreen() {
  const t = useT('network');
  const locale = useLocale() as 'ru' | 'en' | 'hy';
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(['network', 'positionEntities', networkId], () => listNetworkPositionEntities(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const servicesQ = useApiQuery(['network', 'servicesMigration', networkId], () => listServiceMigrationRows(networkId!), {
    enabled: ready && Boolean(networkId),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkPosition | null>(null);
  const [input, setInput] = useState<NetworkPositionInput>(EMPTY_INPUT);
  const [error, setError] = useState<string | undefined>();
  const [seenFormKey, setSeenFormKey] = useState<string | null>(null);

  const formKey = open ? (editing?.id ?? 'new') : null;
  if (formKey !== seenFormKey) {
    setInput(
      editing
        ? {
            name: editing.name,
            description: editing.description ?? '',
            requirements: editing.requirements,
            networkOnly: editing.networkOnly,
            businessIds: editing.businessIds,
            servicesMode: editing.servicesMode,
            serviceIds: editing.serviceIds,
            keepPriceAndDuration: editing.keepPriceAndDuration,
          }
        : EMPTY_INPUT,
    );
    setError(undefined);
    setSeenFormKey(formKey);
  }

  const saveMutation = useApiMutation((_: void) => saveNetworkPosition(networkId!, input, editing?.id));
  const deleteMutation = useApiMutation((id: Id) => deleteNetworkPosition(networkId!, id));

  if (isError || q.isError) return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (p: NetworkPosition) => {
    setEditing(p);
    setOpen(true);
  };

  const save = async () => {
    if (!input.name.trim()) {
      setError(t('staff.positions.nameRequired'));
      return;
    }
    try {
      await saveMutation.mutate();
      toast.success(t('staff.positions.saved'));
      setOpen(false);
      q.refetch();
    } catch {
      toast.error(t('staff.positions.saveFailed'));
    }
  };

  const remove = async (p: NetworkPosition) => {
    const ok = await confirm({ title: t('staff.positions.deleteConfirmTitle'), description: t('staff.positions.deleteConfirmBody'), tone: 'danger' });
    if (!ok) return;
    await deleteMutation.mutate(p.id);
    toast.success(t('staff.positions.deleted'));
    q.refetch();
  };

  const networkedServices = (servicesQ.data ?? []).filter((r) => r.availableIn.length >= 2);

  return (
    <div data-f="F-11-104 F-10-052" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('staff.positions.title')}
        description={t('staff.positions.subtitle')}
        actions={
          <NetworkPageActions
            titleKey="help.staff.title"
            bodyKey="help.staff.body"
            extra={
              <Button size="sm" leftIcon={<Plus aria-hidden />} onClick={openNew}>
                {t('staff.positions.add')}
              </Button>
            }
          />
        }
      />
      <LinkButton href="/biz/network/staff" variant="ghost" size="sm" className="w-fit">
        ← {t('staff.title')}
      </LinkButton>

      {!ready || q.isLoading ? (
        <Skeleton lines={4} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Briefcase aria-hidden />}
          title={t('staff.positions.empty')}
          action={
            <Button leftIcon={<Plus aria-hidden />} onClick={openNew}>
              {t('staff.positions.add')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {t('staff.positions.locationsTitle')}: {p.businessIds.length}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  icon={<Pencil aria-hidden />}
                  variant="ghost"
                  size="sm"
                  label={t('staff.positions.editTitle')}
                  onClick={() => openEdit(p)}
                />
                <IconButton
                  icon={<Trash2 aria-hidden />}
                  variant="ghost"
                  size="sm"
                  label={t('staff.positions.deleteConfirmTitle')}
                  onClick={() => remove(p)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? t('staff.positions.editTitle') : t('staff.positions.newTitle')}
        size="md"
        footer={
          <Button loading={saveMutation.isPending} onClick={save} className="w-full">
            {t('staff.positions.save')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t('staff.positions.nameLabel')} required error={error}>
            <Input value={input.name} onChange={(e) => setInput((p) => ({ ...p, name: e.target.value }))} autoFocus />
          </FormField>
          <FormField label={t('staff.positions.descriptionLabel')} optional>
            <Textarea value={input.description} onChange={(e) => setInput((p) => ({ ...p, description: e.target.value }))} rows={2} />
          </FormField>
          <div data-f="F-11-105">
            <FormField label={t('staff.positions.requirementsLabel')} optional hint={t('staff.positions.requirementsPlaceholder')}>
              <TagInput value={input.requirements} onValueChange={(v) => setInput((p) => ({ ...p, requirements: v }))} />
            </FormField>
          </div>
          <Switch
            checked={input.networkOnly}
            onCheckedChange={(v) => setInput((p) => ({ ...p, networkOnly: v }))}
            label={t('staff.positions.networkOnlyLabel')}
          />
          <FormField label={t('staff.positions.locationsTitle')}>
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={input.businessIds}
              onChange={(v) => setInput((p) => ({ ...p, businessIds: v }))}
            />
          </FormField>
          <div data-f="F-11-106">
            <FormField label={t('staff.positions.servicesModeLabel')}>
              <SegmentedControl
                options={[
                  { value: 'off', label: t('staff.positions.servicesModeOff') },
                  { value: 'strict', label: t('staff.positions.servicesModeStrict') },
                ]}
                value={input.servicesMode}
                onValueChange={(v) => setInput((p) => ({ ...p, servicesMode: v as NetworkPositionInput['servicesMode'] }))}
              />
            </FormField>
            {input.servicesMode === 'strict' && (
              <>
                <FormField label={t('staff.positions.servicesLabel')}>
                  <ul className="main-scrollbar flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                    {networkedServices.map((r) => {
                      const key = r.service.name.ru || r.service.id;
                      return (
                        <li key={r.service.id}>
                          <Checkbox
                            checked={input.serviceIds.includes(key)}
                            onCheckedChange={(checked) =>
                              setInput((p) => ({ ...p, serviceIds: checked ? [...p.serviceIds, key] : p.serviceIds.filter((k) => k !== key) }))
                            }
                            label={pickText(r.service.name, locale)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </FormField>
                <Switch
                  checked={input.keepPriceAndDuration}
                  onCheckedChange={(v) => setInput((p) => ({ ...p, keepPriceAndDuration: v }))}
                  label={t('staff.positions.keepPriceLabel')}
                />
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
