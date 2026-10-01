'use client';

/**
 * «Приложение» → команда (F-14-116…120, F-14-125). Демо-симуляция раздела «Employees» в мобильном
 * приложении для бизнеса: карточка сотрудника, его услуги и длительность, увольнение/удаление/
 * восстановление, доступ «только свои записи», скрытие контактов клиента, вкладка аналитики.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { BarChart3, Bell, Lock, Plus, RotateCcw, ShieldCheck, Trash2, UserX, Users, Wallet } from 'lucide-react';
import {
  canRestoreStaff,
  createAppStaff,
  deleteAppStaff,
  getMyAnalytics,
  listAppStaff,
  restoreStaff,
  setEmployeeAppAccess,
  setStaffStatus,
  type AppStaffRow,
} from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id, StaffRole } from '@/domain/core';
import { STAFF_PUSH_TYPES, type PayrollAppAccess, type StaffPushType } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function TeamAppScreen() {
  const t = useT('client');
  const { ready, businessId, locationIds } = useCurrent();
  // Права — как в разделе «Сотрудники» (A8): смотреть — staff.view (экран закрыт на уровне страницы), менять — staff.manage
  const canManage = useCan('staff.manage');
  const [openId, setOpenId] = useState<Id | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useApiQuery(['app-staff', businessId], () => listAppStaff(businessId!), { enabled: ready && Boolean(businessId) });
  // Только что добавленный — первым в списке и сразу открыт (раньше уходил на 2-ю страницу и терялся)
  const [createdId, setCreatedId] = useState<Id | undefined>(undefined);
  const rows = createdId ? [...(q.data ?? [])].sort((a, b) => Number(b.staff.id === createdId) - Number(a.staff.id === createdId)) : (q.data ?? []);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(rows, { resetKey: createdId });

  return (
    <div data-f="F-14-116 F-14-117 F-14-118 F-14-119 F-14-120 F-14-125 F-14-128" className="flex flex-col gap-6">
      <PageHeader
        title={t('apps.team.title')}
        description={t('apps.team.subtitle')}
        actions={
          canManage ? (
            <Button size="sm" leftIcon={<Plus aria-hidden />} onClick={() => setCreateOpen(true)}>
              {t('apps.team.addCta')}
            </Button>
          ) : undefined
        }
      />

      {!ready || q.isLoading ? (
        <Skeleton lines={4} />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Users aria-hidden className="size-8 text-muted" />}
          title={t('apps.team.empty')}
          action={canManage ? <Button onClick={() => setCreateOpen(true)}>{t('apps.team.addCta')}</Button> : undefined}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {pageItems.map((row) => (
              <li key={row.staff.id}>
                <Card interactive padding="sm" className="flex items-center gap-3" onClick={() => setOpenId(row.staff.id)}>
                  <Avatar name={row.staff.name} src={row.staff.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">{row.staff.name}</p>
                    <p className="truncate text-sm text-muted">
                      {t(`apps.team.role.${row.staff.role}` as 'apps.team.role.master')} · {t('apps.team.servicesCount', { count: row.services.length })}
                    </p>
                  </div>
                  {row.staff.status === 'fired' && (
                    <Badge tone="danger" variant="soft">
                      {t('apps.team.fired')}
                    </Badge>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}

      <ExitHold value={openId ? q.data?.find((r) => r.staff.id === openId) : undefined}>
        {(row) => <StaffModal row={row} businessId={businessId!} onClose={() => setOpenId(undefined)} onChanged={() => void q.refetch()} />}
      </ExitHold>

      <ExitHold value={createOpen && businessId && locationIds[0] ? businessId : null}>
        {(businessId) => (
          <CreateStaffModal
            businessId={businessId}
            locationId={locationIds[0]!}
            onClose={() => setCreateOpen(false)}
            onCreated={(id) => {
              setCreatedId(id);
              setOpenId(id);
            }}
          />
        )}
      </ExitHold>
    </div>
  );
}

function CreateStaffModal({ businessId, locationId, onClose, onCreated }: { businessId: Id; locationId: Id; onClose: () => void; onCreated: (id: Id) => void }) {
  const t = useT('client');
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('master');
  const [tried, setTried] = useState(false);
  const create = useApiMutation(createAppStaff);
  const phoneOk = Boolean(normalizePhone(phone));
  const nameOk = Boolean(name.trim());

  return (
    <Modal open onOpenChange={onClose} title={t('apps.team.addCta')} size="sm">
      <div className="flex flex-col gap-3">
        <FormField label={t('apps.team.nameLabel')} error={tried && !nameOk ? t('apps.team.nameRequired') : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label={t('apps.team.phoneLabel')} error={tried && !phoneOk ? t('apps.team.phoneInvalid') : undefined}>
          <PhoneInput value={phone} onValueChange={(v) => setPhone(v)} />
        </FormField>
        <FormField label={t('apps.team.roleLabel')}>
          <Select
            options={[
              { value: 'master', label: t('apps.team.role.master') },
              { value: 'admin', label: t('apps.team.role.admin') },
            ]}
            value={role}
            onValueChange={(v) => setRole(v as StaffRole)}
          />
        </FormField>
        <Button
          loading={create.isPending}
          onClick={() => {
            setTried(true);
            if (!nameOk || !phoneOk) return;
            void create
              .mutate({ businessId, locationId, name: name.trim(), phone: normalizePhone(phone) ?? phone, role })
              .then((staff) => {
                toast.success(t('apps.team.created'));
                onClose();
                onCreated(staff.id);
              })
              .catch(() => toast.error(t('apps.team.actionFailed')));
          }}
        >
          {t('apps.team.createCta')}
        </Button>
      </div>
    </Modal>
  );
}

function StaffModal({ row, businessId, onClose, onChanged }: { row: AppStaffRow; businessId: Id; onClose: () => void; onChanged: () => void }) {
  const t = useT('client');
  const toast = useToast();
  const locale = useLocale();
  const { staffId: myStaffId } = useCurrent();
  const canManage = useCan('staff.manage');
  const canSeeReports = useCan('reports.view');
  // Владельца из приложения не увольняют, не удаляют и не меняют ему доступ (F-14-118) — ни у кого
  const isOwnerRow = row.staff.role === 'owner';
  const locked = !canManage || isOwnerRow;
  const isSelf = row.staff.id === myStaffId;
  const [tab, setTab] = useState<'card' | 'services' | 'access' | 'push' | 'payroll' | 'analytics'>('card');
  const [confirmFire, setConfirmFire] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fire = useApiMutation(({ id }: { id: Id }) => setStaffStatus(id, 'fired'));
  const restore = useApiMutation(restoreStaff);
  const remove = useApiMutation(deleteAppStaff);
  const setAccess = useApiMutation(({ id, patch }: { id: Id; patch: Partial<AppStaffRow['access']> }) => setEmployeeAppAccess(id, patch));

  const isFired = row.staff.status === 'fired';

  return (
    <Modal open onOpenChange={onClose} title={row.staff.name} description={t(`apps.team.role.${row.staff.role}` as 'apps.team.role.master')} size="lg">
      <div className="flex flex-col gap-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          items={[
            { value: 'card', label: t('apps.team.tabCard') },
            { value: 'services', label: t('apps.team.tabServices') },
            { value: 'access', label: t('apps.team.tabAccess') },
            { value: 'push', label: t('apps.team.tabPush') },
            { value: 'payroll', label: t('apps.team.tabPayroll') },
            ...(canSeeReports || isSelf ? [{ value: 'analytics', label: t('apps.team.tabAnalytics') }] : []),
          ]}
          // F-14-131: на 390px 6 вкладок не помещаются — лист скроллится стрелками. Сами стрелки
          // (абсолютные круги над контентом) иначе перекрывают текст крайней видимой вкладки с первого
          // кадра, ещё до скролла. Резервируем под них место через уже готовый classNames.list —
          // без правки самого src/ui/Tabs.tsx (фундамент).
          classNames={{ list: 'px-11 scroll-px-11' }}
        />

        {tab === 'card' && (
          <div data-f="F-14-116" className="flex flex-col gap-3">
            <Card padding="sm" className="flex flex-col gap-1">
              <p className="text-sm text-muted">{t('apps.team.phoneLabel')}</p>
              <p className="text-fg">{row.staff.phone}</p>
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <span className="text-sm text-muted">{t('apps.team.statusLabel')}</span>
              <Badge tone={isFired ? 'danger' : 'success'} variant="soft">
                {isFired ? t('apps.team.fired') : t('apps.team.active')}
              </Badge>
            </Card>
            {isOwnerRow && canManage && <p className="text-sm text-muted">{t('apps.team.ownerLocked')}</p>}
            {!locked && (
            <div data-f="F-14-118" className="flex gap-2">
              {isFired ? (
                canRestoreStaff(row.staff) && (
                  <Button
                    variant="secondary"
                    leftIcon={<RotateCcw aria-hidden />}
                    loading={restore.isPending}
                    onClick={() => void restore.mutate(row.staff.id).then(() => { toast.success(t('apps.team.restored')); onChanged(); })}
                  >
                    {t('apps.team.restoreCta')}
                  </Button>
                )
              ) : (
                <Button variant="secondary" leftIcon={<UserX aria-hidden />} onClick={() => setConfirmFire(true)}>
                  {t('apps.team.fireCta')}
                </Button>
              )}
              <Button variant="ghost" leftIcon={<Trash2 aria-hidden />} onClick={() => setConfirmDelete(true)}>
                {t('apps.team.deleteCta')}
              </Button>
            </div>
            )}
          </div>
        )}

        {tab === 'services' && (
          <div data-f="F-14-117" className="flex flex-col gap-2">
            {row.services.length === 0 ? (
              <EmptyState icon={<Users aria-hidden className="size-8 text-muted" />} title={t('apps.team.noServices')} />
            ) : (
              row.services.map(({ service, durationMin }) => (
                <Card key={service.id} padding="sm" className="flex items-center justify-between">
                  <span className="text-fg">{pickText(service.name, locale)}</span>
                  <span className="text-sm text-muted">{t('apps.team.durationMin', { count: durationMin })}</span>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'access' && (
          <>
            <div data-f="F-14-119 F-14-120" className="flex flex-col gap-2">
              <Switch
                labelPosition="start"
                label={t('apps.team.onlyOwnBookings')}
                description={t('apps.team.onlyOwnBookingsHint')}
                checked={row.access.onlyOwnBookings}
                disabled={locked}
                onCheckedChange={(v) => void setAccess.mutate({ id: row.staff.id, patch: { onlyOwnBookings: v } }).then(onChanged)}
              />
              <Switch
                labelPosition="start"
                label={t('apps.team.hideClientContacts')}
                description={t('apps.team.hideClientContactsHint')}
                checked={row.access.hideClientContacts}
                disabled={locked}
                onCheckedChange={(v) => void setAccess.mutate({ id: row.staff.id, patch: { hideClientContacts: v } }).then(onChanged)}
              />
            </div>
            <div data-f="F-14-135" className="mt-3 border-t border-border pt-3">
              <Switch
                labelPosition="start"
                label={
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck aria-hidden className="size-4 text-muted" />
                    {t('apps.team.twoStepLogin')}
                  </span>
                }
                description={t('apps.team.twoStepLoginHint')}
                checked={row.access.twoStepLoginEnabled}
                disabled={locked}
                onCheckedChange={(v) => void setAccess.mutate({ id: row.staff.id, patch: { twoStepLoginEnabled: v } }).then(onChanged)}
              />
            </div>
          </>
        )}

        {tab === 'push' && <PushTab row={row} locked={locked} isSelf={isSelf} onSave={(patch) => setAccess.mutate({ id: row.staff.id, patch }).then(onChanged)} saving={setAccess.isPending} />}

        {tab === 'payroll' && <PayrollAccessTab row={row} locked={locked} onSave={(patch) => setAccess.mutate({ id: row.staff.id, patch }).then(onChanged)} saving={setAccess.isPending} />}

        {tab === 'analytics' && (canSeeReports || isSelf) && <AnalyticsTab row={row} businessId={businessId} />}
      </div>

      <ConfirmDialog
        open={confirmFire}
        onOpenChange={setConfirmFire}
        tone="danger"
        title={t('apps.team.fireConfirmTitle', { name: row.staff.name })}
        description={t('apps.team.fireConfirmHint')}
        confirmLabel={t('apps.team.fireCta')}
        onConfirm={async () => {
          await fire.mutate({ id: row.staff.id });
          toast.success(t('apps.team.fired'));
          onChanged();
          onClose();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        title={t('apps.team.deleteConfirmTitle', { name: row.staff.name })}
        description={t('apps.team.deleteConfirmHint')}
        confirmLabel={t('apps.team.deleteCta')}
        onConfirm={async () => {
          await remove.mutate(row.staff.id);
          toast.success(t('apps.team.deleted'));
          onChanged();
          onClose();
        }}
      />
    </Modal>
  );
}

/**
 * Пуши команде: владелец включает в кабинете и выбирает типы (F-14-131); ниже — как это видит сам
 * сотрудник в приложении, переключая только внутри разрешённого владельцем набора (F-14-132).
 */
function PushTab({
  row,
  locked,
  isSelf,
  onSave,
  saving,
}: {
  row: AppStaffRow;
  /** Нет staff.manage или это владелец — настройки «от владельца» только смотреть */
  locked: boolean;
  /** Своя карточка — свои пуши сотрудник включает сам (F-14-132) */
  isSelf: boolean;
  onSave: (patch: Partial<AppStaffRow['access']>) => Promise<void>;
  saving: boolean;
}) {
  const t = useT('client');
  const { access } = row;

  const toggleAllowed = (type: StaffPushType) => {
    const has = access.pushTypesAllowed.includes(type);
    const pushTypesAllowed = has ? access.pushTypesAllowed.filter((x) => x !== type) : [...access.pushTypesAllowed, type];
    // Владелец выключил тип — у сотрудника он тоже гаснет, если был включён
    const pushTypesOn = access.pushTypesOn.filter((x) => pushTypesAllowed.includes(x));
    void onSave({ pushTypesAllowed, pushTypesOn });
  };

  const toggleOn = (type: StaffPushType) => {
    const has = access.pushTypesOn.includes(type);
    const pushTypesOn = has ? access.pushTypesOn.filter((x) => x !== type) : [...access.pushTypesOn, type];
    void onSave({ pushTypesOn });
  };

  return (
    <div data-f="F-14-131 F-14-132" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Switch
          labelPosition="start"
          label={
            <span className="flex items-center gap-1.5">
              <Bell aria-hidden className="size-4 text-muted" />
              {t('apps.team.pushEnabledByOwner')}
            </span>
          }
          description={t('apps.team.pushEnabledByOwnerHint')}
          checked={access.pushEnabledByOwner}
          disabled={locked}
          onCheckedChange={(v) => void onSave({ pushEnabledByOwner: v, pushTypesOn: v ? access.pushTypesOn : [] })}
        />
        <Switch
          labelPosition="start"
          label={t('apps.team.hideClientDataInPush')}
          description={t('apps.team.hideClientDataInPushHint')}
          checked={access.hideClientDataInPush}
          disabled={locked}
          onCheckedChange={(v) => void onSave({ hideClientDataInPush: v })}
        />
      </div>

      {access.pushEnabledByOwner && (
        <Card padding="sm" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">{t('apps.team.pushTypesAllowedLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {STAFF_PUSH_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                disabled={saving || locked}
                onClick={() => toggleAllowed(type)}
                className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${
                  access.pushTypesAllowed.includes(type) ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-surface text-muted'
                }`}
              >
                {t(`apps.team.pushType.${type}`)}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card padding="sm" className="flex flex-col gap-2 bg-surface-2">
        <p className="text-sm font-medium text-fg">{t('apps.team.pushSelfHint')}</p>
        {!access.pushEnabledByOwner ? (
          <p className="text-sm text-muted">{t('apps.team.pushLocked')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {access.pushTypesAllowed.map((type) => (
              <li key={type}>
                <Switch
                  labelPosition="start"
                  label={t(`apps.team.pushType.${type}`)}
                  checked={access.pushTypesOn.includes(type)}
                  disabled={locked && !isSelf}
                  onCheckedChange={() => toggleOn(type)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Доступ к расчёту ЗП в приложении: скрыт / свой / все, и ограничение «только сегодня» (F-14-127, F-14-128) */
function PayrollAccessTab({
  row,
  locked,
  onSave,
}: {
  row: AppStaffRow;
  locked: boolean;
  onSave: (patch: Partial<AppStaffRow['access']>) => Promise<void>;
  saving: boolean;
}) {
  const t = useT('client');
  const { access } = row;

  return (
    <div data-f="F-14-128" className="flex flex-col gap-4">
      <FormField label={t('apps.team.payrollAccessLabel')}>
        <Select
          options={(['none', 'self', 'all'] as PayrollAppAccess[]).map((v) => ({ value: v, label: t(`apps.team.payrollAccess.${v}`) }))}
          value={access.payrollAccess}
          disabled={locked}
          onValueChange={(v) => void onSave({ payrollAccess: v as PayrollAppAccess })}
        />
      </FormField>
      {access.payrollAccess !== 'none' && (
        <Switch
          labelPosition="start"
          label={
            <span className="flex items-center gap-1.5">
              <Wallet aria-hidden className="size-4 text-muted" />
              {t('apps.team.payrollCurrentDayOnly')}
            </span>
          }
          description={t('apps.team.payrollCurrentDayOnlyHint')}
          checked={access.payrollCurrentDayOnly}
          disabled={locked}
          onCheckedChange={(v) => void onSave({ payrollCurrentDayOnly: v })}
        />
      )}
    </div>
  );
}

function AnalyticsTab({ row, businessId }: { row: AppStaffRow; businessId: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  // «Сегодня» — по Еревану (@/lib/date), не по UTC (A9)
  const to = today();
  const from = addDays(to, -6);
  const q = useApiQuery(['my-analytics', row.staff.id, from, to], () => getMyAnalytics(businessId, row.staff.id, from, to));

  if (!row.access.analyticsAllowed) {
    return <EmptyState icon={<Lock aria-hidden className="size-8 text-muted" />} title={t('apps.team.noAnalyticsRight')} />;
  }
  if (q.isLoading) return <Skeleton lines={2} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <div data-f="F-14-125" className="grid grid-cols-2 gap-3">
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <BarChart3 aria-hidden className="size-4" /> {t('apps.team.revenue7d')}
        </span>
        <span className="text-lg font-semibold text-fg">{fmt.money(q.data.revenue)}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t('apps.team.bookings7d')}</span>
        <span className="text-lg font-semibold text-fg">{q.data.bookingsCount}</span>
      </Card>
    </div>
  );
}
