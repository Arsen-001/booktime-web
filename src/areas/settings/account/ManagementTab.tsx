'use client';

/**
 * Личный кабинет → «Управление аккаунтом» (F-15-157 стартовая страница, F-15-158 удаление — через 25 дней,
 * можно отменить). ⭐ F-00-183 (черновик): перед удалением предлагаем сначала выгрузить данные (F-15-154).
 * Н9: вход и безопасность в одном месте — двухэтапная проверка, «Завершить все сеансы», журнал входов.
 * Н10: опасные действия говорят, что будет, до подтверждения; каждое действие ловит ошибку тостом.
 * М1: двухэтапная проверка переключается сразу (оптимистично), без перечитывания всей вкладки.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { coreList, useCoreGet } from '@/api/core';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import {
  ACCOUNT_DELETION_DAYS,
  cancelAccountDeletion,
  createHelpRequest,
  getPersonalAccount,
  requestAccountDeletion,
  saveAccountStart,
  setTwoFactorEnabled,
  terminateOtherSessions,
} from '@/api/settings';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { PersonalAccount, StartPage } from '@/domain/settings';
import { dayjs } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { Switch } from '@/ui/Switch';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { BusinessDeleteModal, type BusinessDeleteTarget } from '@/areas/settings/account/BusinessDeleteModal';

const START_PAGES: StartPage[] = ['journal', 'clients', 'analytics', 'settings'];

export function ManagementTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const locale = useLocale();
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, locationIds } = useCurrent();
  const { persona } = useDemo();
  const isOwner = persona === 'owner' || persona === 'individual';

  const accKey = ['settings', 'personalAccount', staffId] as const;
  const accQ = useApiQuery(accKey, () => getPersonalAccount(staffId));
  const bizQ = useCoreGet('businesses', businessId);
  const helpRequest = useApiMutation(createHelpRequest);
  const locationsQ = useApiQuery(['core', 'locations', ...locationIds], () => coreList('locations', (l) => locationIds.includes(l.id)), {
    enabled: locationIds.length > 0,
  });
  const saveStart = useApiMutation(saveAccountStart, {
    optimistic: optimistic<PersonalAccount, { locationId?: Id; startPage?: StartPage }>(accKey, (old, a) => ({
      ...old,
      startLocationId: a.locationId,
      startPage: a.startPage,
    })),
  });
  const toggleTwoFactor = useApiMutation((enabled: boolean) => setTwoFactorEnabled(staffId, enabled), {
    optimistic: optimistic<PersonalAccount, boolean>(accKey, (old, enabled) => ({ ...old, twoFactorEnabled: enabled })),
  });
  const terminate = useApiMutation(() => terminateOtherSessions(staffId), { invalidates: [accKey] });
  const requestDelete = useApiMutation(() => requestAccountDeletion(staffId), { invalidates: [accKey] });
  const cancelDelete = useApiMutation(() => cancelAccountDeletion(staffId), { invalidates: [accKey] });

  const [locationId, setLocationId] = useState<Id | ''>('');
  const [startPage, setStartPage] = useState<StartPage>('journal');
  const [loadedFor, setLoadedFor] = useState<Id | null>(null);
  const [businessDeleteOpen, setBusinessDeleteOpen] = useState(false);

  if (accQ.data && loadedFor !== staffId) {
    setLoadedFor(staffId);
    setLocationId(accQ.data.startLocationId ?? '');
    setStartPage(accQ.data.startPage ?? 'journal');
  }

  const startDirty =
    accQ.data !== undefined &&
    (locationId !== (accQ.data.startLocationId ?? '') || startPage !== (accQ.data.startPage ?? 'journal'));
  useUnsavedGuard(startDirty);
  // Постранично, как во всех списках (DESIGN.md → Long lists): история входов
  const { pageItems: loginPage, pager: loginPager } = usePagedList(accQ.data?.loginHistory ?? []);

  if (accQ.isLoading || !accQ.data) {
    // До данных — те же карточки: двухфакторный вход и сеансы (выключены), история входов строками, удаление
    return (
      <div aria-busy className="flex flex-col gap-6">
        <SectionCard title={t('account.management.securityTitle')} description={t('account.management.securityDescription')}>
          <div className="flex flex-col gap-5">
            <Switch
              checked={false}
              onCheckedChange={() => {}}
              disabled
              labelPosition="start"
              label={t('account.management.twoFactorLabel')}
              description={t('account.management.twoFactorHint')}
              classNames={{ root: 'justify-between' }}
            />
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <span className="text-sm font-medium text-fg">{t('account.password.sessionsTitle')}</span>
              <span className="text-sm text-muted">{t('account.password.sessionsDescription')}</span>
              <Button variant="outline" leftIcon={<LogOut aria-hidden />} className="self-start" disabled>
                {t('account.password.terminateButton')}
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <span className="text-sm font-medium text-fg">{t('account.management.loginHistoryTitle')}</span>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <Smartphone aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                        <SkeletonText width="18ch" />
                      </span>
                      <span className="block text-sm text-muted">
                        <SkeletonText width="26ch" />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>
        <SectionCard title={t('account.management.deleteTitle')}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{t('account.management.deleteDescription', { days: ACCOUNT_DELETION_DAYS })}</p>
            <Button variant="danger" className="self-start" disabled>
              {t('account.management.deleteButton')}
            </Button>
          </div>
        </SectionCard>
      </div>
    );
  }

  const businessName = bizQ.data?.name ?? '';
  const locations = (locationsQ.data ?? []).map((l) => ({ id: l.id, name: pickText(l.name, locale) }));
  const deletionRequestedAt = accQ.data.deletionRequestedAt;
  const daysLeft = deletionRequestedAt ? Math.max(0, ACCOUNT_DELETION_DAYS - dayjs().diff(dayjs(deletionRequestedAt), 'day')) : 0;
  const deletionDate = deletionRequestedAt ? dayjs(deletionRequestedAt).add(ACCOUNT_DELETION_DAYS, 'day').format('YYYY-MM-DD') : undefined;
  const terminatedAt = accQ.data.sessionsTerminatedAt;

  const saveStartPage = async () => {
    try {
      await saveStart.mutate({ staffId, locationId: locationId || undefined, startPage });
      toast.success(t('account.management.saved'));
    } catch {
      toast.error(t('account.management.saveFailed'));
    }
  };

  const runToggleTwoFactor = async (enabled: boolean) => {
    try {
      await toggleTwoFactor.mutate(enabled);
      toast.success(enabled ? t('account.management.twoFactorOn') : t('account.management.twoFactorOff'));
    } catch {
      toast.error(t('account.management.saveFailed'));
    }
  };

  const runTerminate = async () => {
    const ok = await confirm({
      title: t('account.password.confirmTitle'),
      description: t('account.password.confirmText'),
      confirmLabel: t('account.password.terminateButton'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await terminate.mutate(undefined);
      toast.success(t('account.password.terminated'));
    } catch {
      toast.error(t('account.management.saveFailed'));
    }
  };

  const runDelete = async () => {
    const ok = await confirm({
      title: t('account.management.deleteConfirmTitle'),
      description: (
        <span className="flex flex-col gap-2">
          <span>{t('account.management.deleteConfirmText', { days: ACCOUNT_DELETION_DAYS })}</span>
          <span>
            {isOwner
              ? t('account.management.deleteConsequenceOwner', { name: businessName })
              : t('account.management.deleteConsequenceStaff', { name: businessName })}
          </span>
        </span>
      ),
      confirmLabel: t('account.management.deleteConfirmButton'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await requestDelete.mutate(undefined);
      toast.success(t('account.management.requested'));
    } catch {
      toast.error(t('account.management.saveFailed'));
    }
  };

  const runCancel = async () => {
    try {
      await cancelDelete.mutate(undefined);
      toast.success(t('account.management.cancelled'));
    } catch {
      toast.error(t('account.management.saveFailed'));
    }
  };

  // Н10: выгрузка данных БИЗНЕСА — заявка в поддержку (архив всего бизнеса), не личная выгрузка из «Конфиденциальности»
  const runExportBusinessData = async () => {
    if (!businessId) return;
    try {
      await helpRequest.mutate({
        businessId,
        authorStaffId: staffId,
        topic: 'settings',
        message: t('account.management.businessExportMessage', { name: businessName }),
      });
      toast.success(t('account.management.businessExportSent'));
    } catch {
      toast.error(t('account.management.businessDeleteFailed'));
    }
  };

  const runBusinessDelete = async (target: BusinessDeleteTarget) => {
    if (!businessId) return;
    try {
      await helpRequest.mutate({
        businessId,
        authorStaffId: staffId,
        topic: 'settings',
        message:
          target.kind === 'business'
            ? t('account.management.businessDeleteMessageBusiness', { name: target.label })
            : t('account.management.businessDeleteMessageLocation', { name: target.label, id: target.locationId ?? '' }),
      });
      setBusinessDeleteOpen(false);
      toast.success(t('account.management.businessDeleteSent'));
    } catch {
      toast.error(t('account.management.businessDeleteFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {locations.length > 1 && (
        <SectionCard title={t('account.management.startTitle')} description={t('account.management.startDescription')}>
          <div data-f="F-15-157 F-10-129" className="flex flex-col gap-4">
            <FormField label={t('account.management.locationLabel')}>
              <Select value={locationId} onValueChange={(v) => setLocationId(v)} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
            </FormField>
            <FormField label={t('account.management.startPageLabel')}>
              <Select
                value={startPage}
                onValueChange={(v) => setStartPage(v as StartPage)}
                options={START_PAGES.map((p) => ({ value: p, label: t(`account.management.startPages.${p}`) }))}
              />
            </FormField>
            <Button className="self-start" disabled={!startDirty} loading={saveStart.isPending} onClick={() => void saveStartPage()}>
              {t('account.management.save')}
            </Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('account.management.securityTitle')} description={t('account.management.securityDescription')}>
        <div data-f="F-15-159" className="flex flex-col gap-5">
          <Switch
            checked={!!accQ.data.twoFactorEnabled}
            onCheckedChange={(v) => void runToggleTwoFactor(v)}
            labelPosition="start"
            label={t('account.management.twoFactorLabel')}
            description={t('account.management.twoFactorHint')}
            classNames={{ root: 'justify-between' }}
          />

          <div data-f="F-15-152" className="flex flex-col gap-2 border-t border-border pt-5">
            <span className="text-sm font-medium text-fg">{t('account.password.sessionsTitle')}</span>
            <span className="text-sm text-muted">{t('account.password.sessionsDescription')}</span>
            <Button variant="outline" leftIcon={<LogOut aria-hidden />} loading={terminate.isPending} className="self-start" onClick={() => void runTerminate()}>
              {t('account.password.terminateButton')}
            </Button>
            {terminatedAt && <p className="text-xs text-muted">{t('account.password.terminatedAt', { date: format.dateTime(terminatedAt) })}</p>}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <span className="text-sm font-medium text-fg">{t('account.management.loginHistoryTitle')}</span>
            {accQ.data.loginHistory.length === 0 ? (
              <EmptyState variant="section" icon={<ShieldCheck aria-hidden />} title={t('account.management.loginHistoryEmpty')} />
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {loginPage.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <Smartphone aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                        {ev.device}
                        {ev.current && (
                          <Badge tone="success" size="sm">
                            {t('account.management.loginHistoryCurrent')}
                          </Badge>
                        )}
                      </span>
                      <span className="block text-sm text-muted">
                        {ev.location} · {format.dateTime(ev.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {loginPager}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('account.management.deleteTitle')}>
        <div data-f="F-15-158">
          {deletionRequestedAt ? (
            <div className="flex flex-col gap-3">
              <Badge tone="danger" className="self-start">
                {t('account.management.deletionPendingTitle')}
              </Badge>
              <p className="text-sm text-muted">
                {t('account.management.deletionPendingText', { days: daysLeft, date: deletionDate ? format.date(deletionDate) : '' })}
              </p>
              <Button variant="secondary" loading={cancelDelete.isPending} className="self-start" onClick={() => void runCancel()}>
                {t('account.management.cancelDelete')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{t('account.management.deleteDescription', { days: ACCOUNT_DELETION_DAYS })}</p>
              <Button variant="danger" loading={requestDelete.isPending} className="self-start" onClick={() => void runDelete()}>
                {t('account.management.deleteButton')}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* F-15-096: удаление локации/бизнеса — только обращение к нам + выгрузка данных, только у владельца */}
      {isOwner && (
        <SectionCard title={t('account.management.businessDeleteTitle')} description={t('account.management.businessDeleteDescription')}>
          <div data-f="F-15-096" className="flex flex-wrap gap-3">
            <Button variant="secondary" loading={helpRequest.isPending && !businessDeleteOpen} onClick={() => void runExportBusinessData()}>
              {t('account.management.businessExportButton')}
            </Button>
            <Button variant="danger" onClick={() => setBusinessDeleteOpen(true)}>
              {t('account.management.businessDeleteButton')}
            </Button>
          </div>
          <BusinessDeleteModal
            open={businessDeleteOpen}
            onOpenChange={setBusinessDeleteOpen}
            businessName={businessName}
            locations={locations}
            pending={helpRequest.isPending}
            onConfirm={(target) => void runBusinessDelete(target)}
          />
        </SectionCard>
      )}
    </div>
  );
}
