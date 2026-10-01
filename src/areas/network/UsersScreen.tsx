'use client';

/**
 * /biz/network/settings/users — «Пользователи» сети (F-11-024): список, приглашение по телефону
 * (F-11-025) и создание без аккаунта (F-11-026) — оба закрыты, пока в сети нет оплаченного филиала
 * (F-11-027, F-11-036). Карточка пользователя (F-11-028) хранит вкладку «Права» — группы прав сети
 * (F-11-029…035) со «Снять все / Дать все» на каждую группу и глобально.
 */
import { useState } from 'react';
import { CircleAlert, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import {
  createNetworkUser,
  getNetworkUserPricing,
  inviteNetworkUser,
  listNetworkLocations,
  listNetworkUsers,
  removeNetworkUser,
  setNetworkUserPermissions,
  updateNetworkUser,
  type CreateNetworkUserInput,
} from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import type { Id } from '@/domain/core';
import type { NetworkPermissionKey, NetworkUser } from '@/domain/network';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { Table, type TableColumn } from '@/ui/Table';
import { useConfirm, useToast } from '@/ui/Toast';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { useNetwork } from '@/areas/network/lib/useNetwork';

/** F-11-029…035: группы прав сети — группировка 16 флагов из ALL_NETWORK_PERMISSIONS по разделам меню */
type PermissionGroupId = 'overview' | 'analytics' | 'settingsGroup' | 'loyaltyGroup' | 'servicesGoods' | 'telephonyGroup' | 'clientsGroup';

/**
 * F-09-097 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md
 * 2026-09-26): «payroll» добавлен в группу настроек рядом с «staff» (тот же раздел меню «Сотрудники»,
 * куда входит «Расчёт зарплат», /biz/network/staff/payroll).
 */
const PERMISSION_GROUPS: { id: PermissionGroupId; keys: NetworkPermissionKey[] }[] = [
  { id: 'overview', keys: ['records'] },
  { id: 'analytics', keys: ['analytics', 'plans'] },
  { id: 'settingsGroup', keys: ['settings', 'users', 'staff', 'payroll', 'subdivisions', 'fields'] },
  { id: 'loyaltyGroup', keys: ['loyalty', 'accounts', 'onlineSales'] },
  { id: 'servicesGoods', keys: ['services', 'goods', 'migrations'] },
  { id: 'telephonyGroup', keys: ['telephony'] },
  { id: 'clientsGroup', keys: ['clients'] },
];

function InviteModal({
  open,
  onOpenChange,
  networkId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  networkId: Id;
  onDone: () => void;
}) {
  const t = useT('network');
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const mutation = useApiMutation((p: string) => inviteNetworkUser(networkId, p));

  const submit = async () => {
    if (phone.replace(/\D/g, '').length < 11) {
      setError(t('settingsUsers.phoneRequired'));
      return;
    }
    try {
      await mutation.mutate(phone);
      toast.success(t('settingsUsers.inviteSent'));
      onOpenChange(false);
      setPhone('');
      onDone();
    } catch {
      toast.error(t('settingsUsers.inviteFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('settingsUsers.inviteTitle')}
      size="sm"
      footer={
        <Button loading={mutation.isPending} onClick={submit} className="w-full">
          {t('settingsUsers.inviteAction')}
        </Button>
      }
    >
      <FormField label={t('settingsUsers.phoneLabel')} required error={error}>
        <PhoneInput value={phone} onValueChange={(v) => setPhone(v)} autoFocus />
      </FormField>
    </Modal>
  );
}

function CreateModal({
  open,
  onOpenChange,
  networkId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  networkId: Id;
  onDone: () => void;
}) {
  const t = useT('network');
  const toast = useToast();
  const [input, setInput] = useState<CreateNetworkUserInput>({ name: '', phone: '', login: '', password: '' });
  const [error, setError] = useState<string | undefined>();
  const mutation = useApiMutation((v: CreateNetworkUserInput) => createNetworkUser(networkId, v));

  const submit = async () => {
    if (!input.name.trim() || !input.login.trim() || !input.password) {
      setError(t('settingsUsers.createFieldsRequired'));
      return;
    }
    try {
      await mutation.mutate(input);
      toast.success(t('settingsUsers.created'));
      onOpenChange(false);
      setInput({ name: '', phone: '', login: '', password: '' });
      onDone();
    } catch {
      toast.error(t('settingsUsers.createFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('settingsUsers.createTitle')}
      size="sm"
      footer={
        <Button loading={mutation.isPending} onClick={submit} className="w-full">
          {t('settingsUsers.createAction')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('settingsUsers.nameLabel')} required error={error}>
          <Input value={input.name} onChange={(e) => setInput((p) => ({ ...p, name: e.target.value }))} autoFocus />
        </FormField>
        <FormField label={t('settingsUsers.phoneLabel')} optional>
          <PhoneInput value={input.phone} onValueChange={(v) => setInput((p) => ({ ...p, phone: v }))} />
        </FormField>
        <FormField label={t('settingsUsers.loginLabel')} required>
          <Input value={input.login} onChange={(e) => setInput((p) => ({ ...p, login: e.target.value }))} />
        </FormField>
        <FormField label={t('settingsUsers.passwordLabel')} required>
          <Input type="password" value={input.password} onChange={(e) => setInput((p) => ({ ...p, password: e.target.value }))} />
        </FormField>
      </div>
    </Modal>
  );
}

function UserCardModal({
  networkId,
  user,
  onOpenChange,
  onChanged,
}: {
  networkId: Id;
  user: NetworkUser | null;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const t = useT('network');
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'info' | 'permissions'>('info');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<NetworkPermissionKey[]>([]);
  const [branchIds, setBranchIds] = useState<Id[]>([]);
  const [seenId, setSeenId] = useState<Id | null>(null);
  const locationsQ = useApiQuery(['network', 'locations', networkId], () => listNetworkLocations(networkId), {
    enabled: Boolean(user) && !user?.isOwner,
  });
  const allBranchIds = (locationsQ.data ?? []).map((r) => r.business.id);
  const savedBranchIds = user?.businessIds ?? allBranchIds;

  if (user && user.id !== seenId) {
    setName(user.name);
    setPhone(user.phone ?? '');
    setEmail(user.email ?? '');
    setPermissions(user.permissions);
    setBranchIds(user.businessIds ?? []);
    setSeenId(user.id);
    setTab('info');
  }
  // Пока список филиалов не пришёл, «все филиалы» = пусто; как пришёл — заполняем черновик сохранённым
  const branchDraft = branchIds.length ? branchIds : savedBranchIds;

  const userId = user?.id;
  const saveInfo = useApiMutation((_: void) => updateNetworkUser(networkId, userId ?? '', { name, phone, email }));
  const savePermissions = useApiMutation((next: { permissions: NetworkPermissionKey[]; businessIds: Id[] }) =>
    setNetworkUserPermissions(networkId, userId ?? '', next.permissions, next.businessIds),
  );
  const removeMutation = useApiMutation((_: void) => removeNetworkUser(networkId, userId ?? ''));

  if (!user) return null;

  const submitInfo = async () => {
    if (!name.trim()) return;
    try {
      await saveInfo.mutate();
      toast.success(t('settingsUsers.saved'));
      onChanged();
    } catch {
      toast.error(t('settingsUsers.saveFailed'));
    }
  };

  // Сеть7: галочки и «Дать все» — черновик; в базу уходят только по «Сохранить», «Отмена» возвращает сохранённое
  const toggleGroup = (keys: NetworkPermissionKey[], on: boolean) => {
    setPermissions(on ? Array.from(new Set([...permissions, ...keys])) : permissions.filter((p) => !keys.includes(p)));
  };

  const toggleOne = (key: NetworkPermissionKey, on: boolean) => {
    setPermissions(on ? Array.from(new Set([...permissions, key])) : permissions.filter((p) => p !== key));
  };

  const sameSet = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x) => b.includes(x));
  const permissionsDirty = !sameSet(permissions, user.permissions) || !sameSet(branchDraft, savedBranchIds);

  const submitPermissions = async () => {
    if (!branchDraft.length) {
      toast.error(t('settingsUsers.branchesRequired'));
      return;
    }
    try {
      await savePermissions.mutate({ permissions, businessIds: branchDraft });
      toast.success(t('settingsUsers.saved'));
      onChanged();
    } catch {
      toast.error(t('settingsUsers.saveFailed'));
    }
  };

  const resetPermissions = () => {
    setPermissions(user.permissions);
    setBranchIds(user.businessIds ?? []);
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('settingsUsers.removeConfirmTitle'),
      description: t('settingsUsers.removeConfirmBody', { name: user.name }),
      tone: 'danger',
    });
    if (!ok) return;
    await removeMutation.mutate();
    toast.success(t('settingsUsers.removed'));
    onOpenChange(false);
    onChanged();
  };

  return (
    <Modal
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title={user.name}
      size="md"
      // Кнопки прав — в подвале окна: «липкая» полоса внутри прокрутки пропускала строки под собой (30.09)
      footer={
        !user.isOwner && tab === 'permissions' ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={!permissionsDirty} onClick={resetPermissions}>
              {t('settingsUsers.cancel')}
            </Button>
            <Button loading={savePermissions.isPending} disabled={!permissionsDirty} onClick={() => void submitPermissions()}>
              {t('settingsUsers.save')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div data-f="F-11-028" className="flex flex-col gap-4">
        {!user.isOwner && (
          <Tabs
            items={[
              { value: 'info', label: t('settingsUsers.tabInfo') },
              { value: 'permissions', label: t('settingsUsers.tabPermissions') },
            ]}
            value={tab}
            onValueChange={(v) => setTab(v as 'info' | 'permissions')}
          />
        )}

        {(user.isOwner || tab === 'info') && (
          <div className="flex flex-col gap-3">
            {user.isOwner && (
              <Badge tone="accent" size="sm" className="self-start">
                {t('settingsUsers.fullAccess')}
              </Badge>
            )}
            <FormField label={t('settingsUsers.nameLabel')} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label={t('settingsUsers.phoneLabel')} optional>
              <PhoneInput value={phone} onValueChange={(v) => setPhone(v)} />
            </FormField>
            <FormField label={t('settingsUsers.emailLabel')} optional>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <div className="flex gap-2">
              <Button loading={saveInfo.isPending} onClick={submitInfo}>
                {t('settingsUsers.save')}
              </Button>
              {!user.isOwner && (
                <Button variant="danger" leftIcon={<Trash2 aria-hidden />} loading={removeMutation.isPending} onClick={remove}>
                  {t('settingsUsers.removeAction')}
                </Button>
              )}
            </div>
          </div>
        )}

        {!user.isOwner && tab === 'permissions' && (
          <div data-f="F-11-029 F-11-030 F-11-031 F-11-032 F-11-033 F-11-034 F-11-035 F-08-134 F-04-205 F-09-097 F-06-177" className="flex flex-col gap-4">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggleGroup(ALL_KEYS, true)}>
                {t('settingsUsers.giveAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggleGroup(ALL_KEYS, false)}>
                {t('settingsUsers.clearAll')}
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-fg">{t('settingsUsers.branchesTitle')}</p>
              <p className="text-xs text-muted">{t('settingsUsers.branchesHint')}</p>
              {locationsQ.isLoading ? (
                <Skeleton lines={2} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {(locationsQ.data ?? []).map((row) => (
                    <Checkbox
                      key={row.business.id}
                      checked={branchDraft.includes(row.business.id)}
                      onCheckedChange={(v) =>
                        setBranchIds(v ? Array.from(new Set([...branchDraft, row.business.id])) : branchDraft.filter((id) => id !== row.business.id))
                      }
                      label={row.business.name}
                    />
                  ))}
                </div>
              )}
            </div>
            {PERMISSION_GROUPS.map((group) => {
              const allOn = group.keys.every((k) => permissions.includes(k));
              return (
                <div key={group.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-fg">{t(`settingsUsers.group.${group.id}` as const)}</p>
                    <Button variant="ghost" size="sm" onClick={() => toggleGroup(group.keys, !allOn)}>
                      {allOn ? t('settingsUsers.clearAll') : t('settingsUsers.giveAll')}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.keys.map((key) => (
                      <Checkbox
                        key={key}
                        checked={permissions.includes(key)}
                        onCheckedChange={(v) => toggleOne(key, v)}
                        label={t(`settingsUsers.permission.${key}` as const)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

const ALL_KEYS: NetworkPermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.keys);

export function UsersScreen() {
  const t = useT('network');
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(['network', 'users', networkId], () => listNetworkUsers(networkId!), { enabled: ready && Boolean(networkId) });
  const pricingQ = useApiQuery(['network', 'userPricing', networkId], () => getNetworkUserPricing(networkId!), {
    enabled: ready && Boolean(networkId),
  });
  const [openUser, setOpenUser] = useState<NetworkUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  if (isError || q.isError) return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const canAdd = pricingQ.data?.hasPaidLocation ?? false;

  const columns: TableColumn<NetworkUser>[] = [
    {
      id: 'name',
      header: t('settingsUsers.colName'),
      // Ширины колонок заданы, текст — в одну строку многоточием: строки одной высоты, скелетон и данные одной ширины
      width: '16rem',
      skeletonWidth: '14ch',
      cell: (u) => (
        <span className="flex max-w-[14rem] items-center gap-2 whitespace-nowrap">
          <span className="min-w-0 truncate">{u.name}</span>
          {u.pending && (
            <Badge tone="warning" size="sm">
              {t('settingsUsers.pendingBadge')}
            </Badge>
          )}
        </span>
      ),
      mobile: 'title',
    },
    {
      id: 'contacts',
      header: t('settingsUsers.colContacts'),
      cell: (u) => <span className="block max-w-[12rem] truncate">{u.phone ?? u.email ?? '—'}</span>,
      mobile: 'subtitle',
      width: '14rem',
      skeletonWidth: '15ch',
    },
    {
      id: 'access',
      header: t('settingsUsers.colAccess'),
      width: '18rem',
      skeletonWidth: '20ch',
      cell: (u) => (
        <span className="block max-w-[16rem] truncate">
          {u.isOwner
            ? t('settingsUsers.fullAccess')
            : u.permissions.length
              ? u.permissions.map((p) => t(`settingsUsers.permission.${p}` as const)).join(', ') +
                (u.businessIds ? ` · ${t('settingsUsers.branchesCount', { count: u.businessIds.length })}` : '')
              : t('settingsUsers.noAccess')}
        </span>
      ),
      mobile: 'meta',
    },
    {
      id: 'lastVisit',
      header: t('settingsUsers.colLastVisit'),
      cell: (u) => <span className="whitespace-nowrap">{u.lastVisitAt ? format.date(u.lastVisitAt.slice(0, 10)) : '—'}</span>,
      mobile: 'aside',
      width: '10rem',
      skeletonWidth: '10ch',
    },
  ];

  return (
    <div data-f="F-11-024 F-11-025 F-11-026 F-11-027 F-11-036 F-10-118 F-10-140 F-10-141" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('settingsUsers.title')}
        description={t('settingsUsers.subtitle')}
        actions={
          <NetworkPageActions
            titleKey="help.settingsUsers.title"
            bodyKey="help.settingsUsers.body"
            extra={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" leftIcon={<UserPlus aria-hidden />} disabled={!canAdd} onClick={() => setInviteOpen(true)}>
                  {t('settingsUsers.inviteAction')}
                </Button>
                <Button size="sm" leftIcon={<Plus aria-hidden />} disabled={!canAdd} onClick={() => setCreateOpen(true)}>
                  {t('settingsUsers.createAction')}
                </Button>
              </div>
            }
          />
        }
      />

      {/* Правило оплаты — на месте и при загрузке (текст полосами), не появляется из пустоты */}
      {!pricingQ.data && (!ready || pricingQ.isLoading) && (
        <div aria-hidden className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <p className="min-w-0 flex-1">
            <Skeleton lines={2} className="md:hidden" />
            <span className="hidden md:inline">
              <SkeletonText width="60ch" />
            </span>
          </p>
        </div>
      )}
      {pricingQ.data && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-fg">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <p>
            {canAdd
              ? t('settingsUsers.pricingRule', { free: pricingQ.data.freeCount, price: pricingQ.data.pricePerExtra })
              : t('settingsUsers.noPaidLocation')}
          </p>
        </div>
      )}

      <Table
        columns={columns}
        rows={q.data ?? []}
        loading={!ready || q.isLoading}
        loadingRows={1}
        rowKey={(u) => u.id}
        onRowClick={(u) => setOpenUser(u)}
        empty={<EmptyState icon={<Users aria-hidden />} title={t('settingsUsers.empty')} />}
      />

      <UserCardModal networkId={networkId!} user={openUser ? ((q.data ?? []).find((u) => u.id === openUser.id) ?? openUser) : null} onOpenChange={(open) => !open && setOpenUser(null)} onChanged={() => q.refetch()} />
      {networkId && (
        <>
          <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} networkId={networkId} onDone={() => q.refetch()} />
          <CreateModal open={createOpen} onOpenChange={setCreateOpen} networkId={networkId} onDone={() => q.refetch()} />
        </>
      )}
    </div>
  );
}
