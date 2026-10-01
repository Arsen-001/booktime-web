'use client';

/**
 * /biz/network/staff/migration — перенос и объединение сотрудников филиала в сеть (F-11-102, F-11-103).
 */
import { useState } from 'react';
import { UserCog } from 'lucide-react';
import { listNetworkLocations, listNetworkStaff, mergeNetworkStaff, migrateStaffToNetwork } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import type { Id } from '@/domain/core';
import type { Staff } from '@/domain/core';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';
import { useNetwork } from '@/areas/network/lib/useNetwork';

export function StaffMigrationScreen() {
  const t = useT('network');
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, networkId, isError, refetch } = useNetwork();
  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const [businessId, setBusinessId] = useState<Id | ''>('');
  const staffQ = useApiQuery(
    ['network', 'staff', networkId, 'all', businessId],
    () => listNetworkStaff(networkId!, { status: 'all', fired: 'all' }),
    { enabled: ready && Boolean(networkId) },
  );
  const [selected, setSelected] = useState<Id[]>([]);
  const [mergePrimary, setMergePrimary] = useState<Id | ''>('');

  const moveMutation = useApiMutation((ids: Id[] | 'all') => migrateStaffToNetwork(networkId!, businessId as Id, ids));
  const mergeMutation = useApiMutation((input: { keys: string[]; primaryKey: string }) =>
    mergeNetworkStaff(networkId!, input.keys, input.primaryKey),
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: branchStaffPage, pager } = usePagedList((staffQ.data ?? []).filter((s) => s.businessId === businessId), { resetKey: businessId });

  if (isError || staffQ.isError || locationsQ.isError) return <ErrorState onRetry={() => refetch()} />;

  const locations = locationsQ.data ?? [];
  const branchStaff = (staffQ.data ?? []).filter((s) => s.businessId === businessId);
  const selectedStaff = branchStaff.filter((s) => selected.includes(s.id));

  const toggle = (id: Id, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)));
  };

  const moveAll = async () => {
    if (!businessId) return;
    const ok = await confirm({ title: t('staff.migrationScreen.moveConfirmTitle'), description: t('staff.migrationScreen.moveConfirmBody') });
    if (!ok) return;
    try {
      const res = await moveMutation.mutate('all');
      toast.success(t('staff.migrationScreen.moveDone', { count: res.moved }));
      staffQ.refetch();
    } catch {
      toast.error(t('staff.migrationScreen.actionFailed'));
    }
  };

  const moveSelected = async () => {
    if (!businessId || !selected.length) return;
    const ok = await confirm({ title: t('staff.migrationScreen.moveConfirmTitle'), description: t('staff.migrationScreen.moveConfirmBody') });
    if (!ok) return;
    try {
      const res = await moveMutation.mutate(selected);
      toast.success(t('staff.migrationScreen.moveDone', { count: res.moved }));
      setSelected([]);
      staffQ.refetch();
    } catch {
      toast.error(t('staff.migrationScreen.actionFailed'));
    }
  };

  const mergeSelected = async () => {
    if (!mergePrimary || selected.length < 2) return;
    const primary = selectedStaff.find((s) => s.id === mergePrimary);
    if (!primary) return;
    const ok = await confirm({
      title: t('staff.migrationScreen.mergeConfirmTitle'),
      description: t('staff.migrationScreen.mergeConfirmBody'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await mergeMutation.mutate({ keys: selectedStaff.map((s) => s.name), primaryKey: primary.name });
      toast.success(t('staff.migrationScreen.mergeDone'));
      setSelected([]);
      setMergePrimary('');
      staffQ.refetch();
    } catch {
      toast.error(t('staff.migrationScreen.actionFailed'));
    }
  };

  return (
    <div data-f="F-11-102 F-10-139" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('staff.migrationScreen.title')} description={t('staff.migrationScreen.subtitle')} />
      <LinkButton href="/biz/network/staff" variant="ghost" size="sm" className="w-fit">
        ← {t('staff.title')}
      </LinkButton>

      <SectionCard title={t('staff.migrationScreen.sourceLabel')}>
        <Select
          options={locations.map((l) => ({ value: l.business.id, label: l.business.name }))}
          value={businessId}
          onValueChange={(v) => {
            setBusinessId(v as Id);
            setSelected([]);
            setMergePrimary('');
          }}
          placeholder={t('staff.migrationScreen.sourceLabel')}
        />
      </SectionCard>

      {!businessId ? null : !ready || staffQ.isLoading ? (
        <Skeleton lines={4} />
      ) : !branchStaff.length ? (
        <EmptyState compact icon={<UserCog aria-hidden />} title={t('staff.migrationScreen.empty')} />
      ) : (
        <>
          <SectionCard
            title={t('staff.migrationScreen.branchStaffTitle')}
            actions={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={moveAll} loading={moveMutation.isPending}>
                  {t('staff.migrationScreen.moveAll')}
                </Button>
                <Button size="sm" variant="secondary" disabled={!selected.length} onClick={moveSelected} loading={moveMutation.isPending}>
                  {t('staff.migrationScreen.moveSelected')}
                </Button>
              </div>
            }
          >
            <ul className="flex flex-col gap-1.5">
              {branchStaffPage.map((s: Staff) => (
                <li key={s.id}>
                  <Checkbox checked={selected.includes(s.id)} onCheckedChange={(checked) => toggle(s.id, checked)} label={s.name} />
                </li>
              ))}
            </ul>
            {pager && <div className="mt-4">{pager}</div>}
          </SectionCard>

          <SectionCard title={t('staff.migrationScreen.mergeTitle')}>
            <div className="flex flex-col gap-3" data-f="F-11-103">
              <Select
                options={selectedStaff.map((s) => ({ value: s.id, label: s.name }))}
                value={mergePrimary}
                onValueChange={(v) => setMergePrimary(v as Id)}
                placeholder={t('staff.migrationScreen.mergePrimaryLabel')}
                disabled={selectedStaff.length < 2}
              />
              <Button
                variant="secondary"
                disabled={selectedStaff.length < 2 || !mergePrimary}
                onClick={mergeSelected}
                loading={mergeMutation.isPending}
              >
                {t('staff.migrationScreen.mergeTitle')}
              </Button>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
