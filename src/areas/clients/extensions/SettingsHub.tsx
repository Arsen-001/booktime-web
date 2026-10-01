'use client';

/**
 * Вклад раздела «clients» в хаб настроек /biz/settings (хост «settingsHub»):
 *  - переключатель «Фамилия и отчество» (F-04-046) — наш временный заменитель настройки цифрового
 *    журнала (F-04-105, раздел journal её не построил; см. qa/requests/clients.md);
 *  - «Права доступа: Клиентская база» (F-04-194…204) — 26 тонких прав по сотруднику; тоньше, чем есть
 *    в фундаменте (clients.view/phones/edit/export/delete), поэтому храним override в своём срезе
 *    (см. src/areas/clients/lib/rights.ts, qa/requests/clients.md).
 */
import { useState } from 'react';
import {
  getLostAfterDays,
  getShowFullNameFields,
  getShowLoyaltySearchInBookingWindow,
  getStaffFineRights,
  listStaffOptions,
  setLostAfterDays,
  setShowFullNameFields,
  setShowLoyaltySearchInBookingWindow,
  setStaffFineRights,
} from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import { defaultAdminFineRights, FINE_RIGHT_GROUPS, type ClientsFineRights, type FineRight } from '@/domain/clients';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const GROUP_TITLE_KEYS: Record<string, string> = {
  contacts: 'rights.groups.contacts',
  edit: 'rights.groups.edit',
  deleteExport: 'rights.groups.deleteExport',
  comments: 'rights.groups.comments',
  filesFields: 'rights.groups.filesFields',
  scope: 'rights.groups.scope',
  accounts: 'rights.groups.accounts',
  bookingWindow: 'rights.groups.bookingWindow',
  categories: 'rights.groups.categories',
  loyaltyRights: 'rights.groups.loyaltyRights',
  medicalDocs: 'rights.groups.medicalDocs',
  networkAccess: 'rights.groups.networkAccess',
};

export default function ClientsSettingsHub(props: SettingsHubExtProps) {
  const t = useT('clients');
  const toast = useToast();
  const q = useApiQuery(['clients', 'showFullName', props.businessId], () => getShowFullNameFields(props.businessId));
  const set = useApiMutation(setShowFullNameFields);
  const lostQ = useApiQuery(['clients', 'lostAfterDays', props.businessId], () => getLostAfterDays(props.businessId));
  const setLost = useApiMutation(setLostAfterDays);
  const loyaltySearchQ = useApiQuery(['clients', 'showLoyaltySearch', props.businessId], () => getShowLoyaltySearchInBookingWindow(props.businessId));
  const setLoyaltySearch = useApiMutation(setShowLoyaltySearchInBookingWindow);

  const staffQ = useApiQuery(['clients', 'staffOptions', props.businessId], () => listStaffOptions(props.businessId));
  const [staffId, setStaffId] = useState<string>('');
  const activeStaffId = staffId || staffQ.data?.[0]?.value || '';
  const rightsQ = useApiQuery(['clients', 'staffRights', activeStaffId], () => getStaffFineRights(activeStaffId), {
    enabled: Boolean(activeStaffId),
  });
  const setRights = useApiMutation((args: { staffId: string; rights: ClientsFineRights }) => setStaffFineRights(args.staffId, args.rights));

  const current: ClientsFineRights = { ...defaultAdminFineRights(), ...rightsQ.data };

  const toggle = async (right: FineRight, value: boolean) => {
    if (!activeStaffId) return;
    const next: ClientsFineRights = { ...current, [right]: value };
    try {
      await setRights.mutate({ staffId: activeStaffId, rights: next });
    } catch {
      toast.error(t('card.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* F-04-105: раздел journal свою настройку «ФИО клиента» не построил (см. qa/requests/clients.md) —
          наш переключатель «Фамилия и отчество» стоит на её месте временным заменителем */}
      <div data-f="F-04-046 F-04-014 F-04-105">
        <SectionCard title={t('settings.title')} description={t('settings.description')}>
          <div className="flex flex-col gap-5">
            <Switch
              checked={q.data ?? true}
              onCheckedChange={async (value) => {
                try {
                  await set.mutate({ businessId: props.businessId, value });
                } catch {
                  toast.error(t('card.saveFailed'));
                }
              }}
              label={t('settings.fullNameFields.title')}
              description={t('settings.fullNameFields.description')}
            />
            <FormField label={t('settings.lostAfter.title')} hint={t('settings.lostAfter.hint')}>
              <Select
                value={String(lostQ.data ?? 60)}
                onValueChange={async (v) => {
                  try {
                    await setLost.mutate({ businessId: props.businessId, days: Number(v) });
                  } catch {
                    toast.error(t('card.saveFailed'));
                  }
                }}
                options={[30, 60, 90, 180].map((d) => ({ value: String(d), label: t('settings.lostAfter.days', { count: d }) }))}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-04-099 F-06-068">
        <SectionCard title={t('settings.loyaltySearch.title')} description={t('settings.loyaltySearch.description')}>
          <Switch
            checked={loyaltySearchQ.data ?? false}
            onCheckedChange={async (value) => {
              try {
                await setLoyaltySearch.mutate({ businessId: props.businessId, value });
              } catch {
                toast.error(t('card.saveFailed'));
              }
            }}
            label={t('settings.loyaltySearch.switchLabel')}
            description={t('settings.loyaltySearch.switchHint')}
          />
        </SectionCard>
      </div>

      <div data-f="F-04-194 F-04-195 F-04-196 F-04-197 F-04-198 F-04-199 F-04-200 F-04-201 F-04-202 F-04-204 F-04-084 F-04-150 F-04-184">
        <SectionCard title={t('rights.title')} description={t('rights.subtitle')}>
          {!staffQ.isLoading && (staffQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t('rights.noStaff')}</p>
          ) : (
            // Пока сотрудники и права читаются — тот же выбор сотрудника и те же группы переключателей (неактивные):
            // подписи известны заранее, карточка сразу своей высоты
            <div className="flex flex-col gap-5">
              <Select
                options={(staffQ.data ?? []).map((s) => ({ value: s.value, label: s.label }))}
                value={activeStaffId}
                onValueChange={setStaffId}
                aria-label={t('rights.staff')}
                disabled={staffQ.isLoading}
              />
              {FINE_RIGHT_GROUPS.map((group) => (
                <div key={group.titleKey} className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <p className="text-sm font-semibold text-fg">{t(GROUP_TITLE_KEYS[group.titleKey] as never)}</p>
                  <div className="flex flex-col gap-2">
                    {group.rights.map((r) => (
                      <Switch
                        key={r}
                        checked={Boolean(current[r])}
                        disabled={staffQ.isLoading || rightsQ.isLoading}
                        onCheckedChange={(v) => toggle(r, v)}
                        label={t(`rights.items.${r}` as never)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
