'use client';

/**
 * /biz/resources/assistants — общие настройки ассистирования (F-16-136, F-16-140/141 — читаем, F-09-008/009
 * их строит payroll, здесь временный слой, пока запрос не выполнен — qa/requests/resources.md), кто из
 * сотрудников доступен для ассистирования (F-16-138) и права на ассистентов (F-16-144).
 */
import { useState } from 'react';
import { Save, UserPlus } from 'lucide-react';
import {
  createAssistant,
  defaultResourcesFineRights,
  getAssistantSettings,
  getStaffResourcesRights,
  listAssistantStaff,
  saveAssistantSettings,
  setStaffAssistantEligible,
  setStaffResourcesRights,
  type AssistantShareRule,
} from '@/api/resources';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { AssistantSettings, ResourcesFineRights } from '@/domain/resources';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useResourcesRights } from '@/areas/resources/lib/rights';

const FINE_RIGHT_KEYS: (keyof ResourcesFineRights)[] = ['viewResources', 'editServiceResources', 'viewWaitlist', 'addAssistants', 'editAssistantShare'];

export function AssistantsSettingsScreen() {
  const t = useT('resources');
  const toast = useToast();
  const { ready, businessId, locationIds } = useCurrent();
  const canManage = useResourcesRights().editServiceResources;
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNameError, setNewNameError] = useState('');
  const createAssistantMutation = useApiMutation((args: { name: string; phone: string }) =>
    createAssistant(businessId ?? '', locationIds[0] ?? '', args.name, args.phone),
  );

  const settingsQ = useApiQuery(['resources', 'assistant-settings', businessId], () => getAssistantSettings(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const staffQ = useApiQuery(['resources', 'assistant-staff', businessId], () => listAssistantStaff(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const saveSettings = useApiMutation((patch: Partial<AssistantSettings>) => saveAssistantSettings(businessId ?? '', patch));
  const setEligible = useApiMutation((args: { staffId: string; value: boolean }) => setStaffAssistantEligible(args.staffId, args.value));

  const [rightsStaffId, setRightsStaffId] = useState('');
  const activeRightsStaffId = rightsStaffId || staffQ.data?.[0]?.id || '';
  const rightsQ = useApiQuery(['resources', 'staffRights', activeRightsStaffId], () => getStaffResourcesRights(activeRightsStaffId), {
    enabled: ready && Boolean(activeRightsStaffId),
  });
  const setRights = useApiMutation((args: { staffId: string; patch: Partial<ResourcesFineRights> }) => setStaffResourcesRights(args.staffId, args.patch));
  const baseRights: ResourcesFineRights = { ...defaultResourcesFineRights(), ...rightsQ.data };

  // Один черновик на всю страницу и одна кнопка «Сохранить» (раньше каждый переключатель писал сразу, без отмены):
  // правки общих настроек, «кто ассистирует» и прав по сотрудникам копятся здесь поверх данных «сервера».
  const [settingsEdit, setSettingsEdit] = useState<Partial<AssistantSettings>>({});
  const [eligibleEdit, setEligibleEdit] = useState<Record<string, boolean>>({});
  const [rightsEdit, setRightsEdit] = useState<Record<string, Partial<ResourcesFineRights>>>({});

  const baseSettings = settingsQ.data;
  const settings: AssistantSettings | undefined = baseSettings ? { ...baseSettings, ...settingsEdit } : undefined;
  const currentRights: ResourcesFineRights = { ...baseRights, ...rightsEdit[activeRightsStaffId] };
  const dirty = Object.keys(settingsEdit).length > 0 || Object.keys(eligibleEdit).length > 0 || Object.keys(rightsEdit).length > 0;
  useUnsavedGuard(dirty);
  const [saving, setSaving] = useState(false);
  const staffSkeletonRows = useSkeletonCount('assistantStaff', { loading: !staffQ.data, count: staffQ.data?.length, fallback: 10, max: 12 });

  const editSetting = (patch: Partial<AssistantSettings>) => {
    const next = { ...settingsEdit, ...patch };
    for (const k of Object.keys(next) as (keyof AssistantSettings)[]) if (baseSettings && next[k] === baseSettings[k]) delete next[k];
    setSettingsEdit(next);
  };
  const editEligible = (staffId: string, base: boolean, value: boolean) => {
    const next = { ...eligibleEdit };
    if (value === base) delete next[staffId];
    else next[staffId] = value;
    setEligibleEdit(next);
  };
  const editRight = (key: keyof ResourcesFineRights, value: boolean) => {
    const forStaff = { ...rightsEdit[activeRightsStaffId] };
    if (value === baseRights[key]) delete forStaff[key];
    else forStaff[key] = value;
    const next = { ...rightsEdit };
    if (Object.keys(forStaff).length) next[activeRightsStaffId] = forStaff;
    else delete next[activeRightsStaffId];
    setRightsEdit(next);
  };

  const reset = () => {
    setSettingsEdit({});
    setEligibleEdit({});
    setRightsEdit({});
  };

  const save = async () => {
    setSaving(true);
    try {
      if (Object.keys(settingsEdit).length) await saveSettings.mutate(settingsEdit);
      for (const [staffId, value] of Object.entries(eligibleEdit)) await setEligible.mutate({ staffId, value });
      for (const [staffId, patch] of Object.entries(rightsEdit)) await setRights.mutate({ staffId, patch });
      reset();
      toast.success(t('form.updated'));
    } catch {
      toast.error(t('form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Скелетон = та же страница: те же карточки, переключатели и подписи (неактивные), пока настройки читаются.
  // Блоки компенсации — как у демо-бизнеса (включена), чтобы приход данных не сдвигал карточки ниже.
  const loading = !ready || settingsQ.isLoading;
  const staffLoading = loading || staffQ.isLoading;
  const showCompensation = loading || Boolean(settings?.compensationEnabled);

  return (
    <div data-f="F-16-136 F-16-140 F-16-141 F-16-144" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('assistants.title')} description={t('assistants.description')} />

      <SectionCard title={t('assistants.compensationTitle')}>
        <Switch
          checked={settings?.compensationEnabled ?? loading}
          disabled={!canManage || loading}
          onCheckedChange={(v) => editSetting({ compensationEnabled: v })}
          label={t('assistants.compensationSwitch')}
          description={t('assistants.compensationSwitchHint')}
        />
      </SectionCard>

      {showCompensation && (
        <>
          <SectionCard title={t('assistants.multipleTitle')}>
            <Switch
              checked={settings?.allowMultiple ?? loading}
              disabled={!canManage || loading}
              onCheckedChange={(v) => editSetting({ allowMultiple: v })}
              label={t('assistants.multipleSwitch')}
              description={t('assistants.multipleSwitchHint')}
            />
          </SectionCard>

          <SectionCard title={t('assistants.shareRuleTitle')}>
            <ChoiceGroup
              columns={1}
              value={settings?.shareRule ?? ''}
              onValueChange={(v) => editSetting({ shareRule: v as AssistantShareRule })}
              options={[
                { value: 'full', title: t('assistants.shareFull'), description: t('assistants.shareFullHint'), disabled: !canManage || loading },
                { value: 'split', title: t('assistants.shareSplit'), description: t('assistants.shareSplitHint'), disabled: !canManage || loading },
              ]}
            />
          </SectionCard>
        </>
      )}

      <SectionCard
        title={t('assistants.staffTitle')}
        description={t('assistants.staffHint')}
        actions={
          canManage ? (
            <Button
              data-f="F-16-137 F-16-139"
              size="sm"
              variant="outline"
              leftIcon={<UserPlus aria-hidden className="size-4" />}
              onClick={() => {
                setNewName('');
                setNewPhone('');
                setNewNameError('');
                setCreateOpen(true);
              }}
            >
              {t('assistants.createAction')}
            </Button>
          ) : undefined
        }
      >
        {staffLoading ? (
          // Те же строки «имя — переключатель»
          <ul className="flex flex-col divide-y divide-border" aria-busy>
            {Array.from({ length: staffSkeletonRows }, (_, i) => (
              <li key={i} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="text-sm text-fg">
                  <SkeletonText width={i % 2 ? '12ch' : '16ch'} />
                </span>
                <Switch checked={false} disabled aria-hidden tabIndex={-1} />
              </li>
            ))}
          </ul>
        ) : (staffQ.data ?? []).length === 0 ? (
          <EmptyState compact title={t('assistants.staffEmpty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {(staffQ.data ?? []).map((s) => (
              <li key={s.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="text-sm text-fg">{s.name}</span>
                <Switch
                  data-f="F-09-045"
                  checked={eligibleEdit[s.id] ?? s.eligible}
                  disabled={!canManage || saving}
                  aria-label={s.name}
                  onCheckedChange={(value) => editEligible(s.id, s.eligible, value)}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div data-f="F-16-026 F-16-169">
      <SectionCard title={t("assistants.rightsTitle")} description={t("assistants.rightsHint")}>
        {!staffLoading && (staffQ.data ?? []).length === 0 ? (
          <EmptyState compact title={t('assistants.staffEmpty')} />
        ) : (
          // Пока сотрудники и права читаются — тот же выбор сотрудника и те же строки прав (подписи известны заранее)
          <div className="flex flex-col gap-4">
            <Select
              value={activeRightsStaffId}
              onValueChange={setRightsStaffId}
              options={(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              disabled={!canManage || staffLoading}
            />
            <ul className="flex flex-col divide-y divide-border">
              {FINE_RIGHT_KEYS.map((key) => (
                <li key={key} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className="text-sm text-fg">{t(`assistants.rights.${key}` as 'assistants.rights.viewResources')}</span>
                  <Switch
                    checked={currentRights[key]}
                    disabled={!canManage || saving || staffLoading || rightsQ.isLoading}
                    aria-label={t(`assistants.rights.${key}` as 'assistants.rights.viewResources')}
                    onCheckedChange={(value) => editRight(key, value)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>
      </div>

      {canManage && (
        <StickyActionBar desktop="inline">
          <Button variant="ghost" onClick={reset} disabled={!dirty || saving}>
            {t('form.cancel')}
          </Button>
          <Button leftIcon={<Save aria-hidden />} loading={saving} disabled={!dirty} onClick={save}>
            {t('form.save')}
          </Button>
        </StickyActionBar>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('assistants.createTitle')}
        description={t('assistants.createHint')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('form.cancel')}
            </Button>
            <Button
              loading={createAssistantMutation.isPending}
              onClick={async () => {
                if (!newName.trim()) {
                  setNewNameError(t('form.nameRequired'));
                  return;
                }
                try {
                  await createAssistantMutation.mutate({ name: newName.trim(), phone: newPhone });
                  toast.success(t('assistants.created', { name: newName.trim() }));
                  setCreateOpen(false);
                } catch {
                  toast.error(t('form.saveFailed'));
                }
              }}
            >
              {t('form.save')}
            </Button>
          </>
        }
      >
        <div data-f="F-09-044" className="flex flex-col gap-4">
          <FormField label={t('assistants.createName')} error={newNameError}>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewNameError('');
              }}
            />
          </FormField>
          <FormField label={t('assistants.createPhone')}>
            <PhoneInput value={newPhone} onValueChange={setNewPhone} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
