'use client';

/**
 * Экран «Цифровой журнал» (пачка b05): F-01-155, F-01-167…180.
 * Одна страница настроек журнала — все поля сохраняются одной кнопкой (F-01-168). Права доступа
 * (F-01-178, F-01-179) сохраняются сразу по выбранному сотруднику, как в остальных разделах.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Lock, MessageCircle } from 'lucide-react';
import { listStaffOptions } from '@/api/clients';
import { getAutoSaveChatLeads, setAutoSaveChatLeads, simulateChatLead } from '@/api/clients';
import {
  getJournalPrefs,
  getJournalSettings,
  getStaffJournalRights,
  getStaffWindowRights,
  getVisitGroupingMode,
  setBreakCombineMode,
  setJournalSettings,
  setSplitByResourceEnabled,
  setStaffJournalRights,
  setStaffWindowRights,
  setVisitGroupingMode,
} from '@/api/journal';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import {
  defaultAdminJournalRights,
  defaultAdminWindowRights,
  VISIT_GAP_OPTIONS,
  type HistoryWindowLimit,
  type JournalBlockRights,
  type JournalSettings,
  type VisitGapMinutes,
  type VisitGroupingMode,
  type WindowRights,
} from '@/domain/journal';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Radio } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { Button } from '@/ui/Button';

const BREAK_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 45, 60];
// F-01-121: срок восстановления удалённой записи, дней — настройка бизнеса, по умолчанию 7
const RESTORE_WINDOW_OPTIONS = [1, 3, 7, 14, 30];
const HISTORY_OPTIONS: HistoryWindowLimit[] = ['none', '1d', '3d', '7d', '1m', '3m', '6m', 'unlimited'];

export function JournalSettingsScreen() {
  const t = useT('journal');
  const format = useFormat();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  // F-01-168/178/179 (block): страница «владелец настраивает» — она сама раздаёт права сотрудникам
  // (в т.ч. «Права доступа»), поэтому доступ к ней самой должен решаться грубым правом фундамента, а
  // не только скрытым пунктом меню (nav.ts permission="settings.manage") — прямым переходом на
  // /biz/journal/settings его раньше обходили полностью: у мастера/сотрудника без settings.manage
  // страница открывалась целиком, читаемо и редактируемо.
  const canManage = useCan('settings.manage');

  const settingsQuery = useApiQuery(['journal', 'settings'], getJournalSettings, { enabled: ready && canManage });
  // Несохранённая правка поверх загруженных настроек — без эффекта: как только придут данные,
  // форма уже видна (draft пуст), правки пользователя живут поверх них до нажатия «Сохранить».
  const [draft, setDraft] = useState<Partial<JournalSettings>>({});
  const form: JournalSettings | null = settingsQuery.data ? { ...settingsQuery.data, ...draft } : null;

  const saveMutation = useApiMutation(setJournalSettings);
  const [saving, setSaving] = useState(false);

  const patch = <K extends keyof JournalSettings>(key: K, value: JournalSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await saveMutation.mutate(form);
      setDraft({});
      await settingsQuery.refetch();
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // «Основные настройки» — и форма, и её скелетон при загрузке (DESIGN.md → «The skeleton IS the page»): те же подписи,
  // варианты и переключатели на своих местах, пока настроек нет — ничего не выбрано и всё неактивно
  const mainSection = (f: JournalSettings | null) => (
    <SectionCard title={t('settings.sections.main')}>
      <div className="flex flex-col gap-5">
        <div data-f="F-01-167 F-16-027" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">{t('settings.recordType.label')}</p>
          <p className="text-sm text-muted">{t('settings.recordType.hint')}</p>
          <ChoiceGroup
            aria-label={t('settings.recordType.label')}
            columns={2}
            value={f?.recordType ?? ''}
            onValueChange={(v) => patch('recordType', v as JournalSettings['recordType'])}
            options={(['auto', 'individual', 'mixed', 'group'] as const).map((opt) => ({
              value: opt,
              title: t(`settings.recordType.${opt}` as never),
              description: opt === 'auto' ? undefined : t(`settings.recordType.${opt}Hint` as never),
              disabled: !f,
            }))}
          />
        </div>

        <div data-f="F-01-170 F-16-021" className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium text-fg">{t('settings.defaultView.label')}</p>
          <div className="flex flex-col gap-1">
            <Radio
              name="defaultView"
              label={t('settings.defaultView.staff')}
              checked={f?.defaultView === 'staff'}
              disabled={!f}
              onChange={() => patch('defaultView', 'staff')}
            />
            <Radio
              name="defaultView"
              label={t('settings.defaultView.resource')}
              checked={f?.defaultView === 'resource'}
              disabled={!f}
              onChange={() => patch('defaultView', 'resource')}
            />
          </div>
        </div>

        <div data-f="F-01-169 F-16-022" className="border-t border-border pt-4">
          <Switch
            checked={f?.showOccupiedResourcesForStaff ?? false}
            disabled={!f}
            onCheckedChange={(v) => patch('showOccupiedResourcesForStaff', v)}
            label={t('settings.showOccupiedResources.title')}
            description={t('settings.showOccupiedResources.hint')}
          />
        </div>
      </div>
    </SectionCard>
  );

  // «Дата, время и часовой пояс» — вторая секция первого экрана: при загрузке та же, значения полосой/пустые
  const dateTimeSection = (f: JournalSettings | null) => (
      <SectionCard title={t('settings.sections.dateTime')}>
        <div data-f="F-01-221" className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Н5: формат времени — один источник, «Системные»; здесь только показ и ссылка */}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm font-medium text-fg">{t('settings.dateTime.formatLabel')}</p>
            <ElsewhereRow
              text={!f ? <SkeletonText width="18ch" /> : f.hourFormat === '12' ? t('settings.dateTime.format12') : t('settings.dateTime.format24')}
              href="/biz/settings/system"
              linkText={t('settings.dateTime.changeInSystem')}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm font-medium text-fg">{t('settings.dateTime.cityLabel')}</p>
            <Input value={f?.timeZoneCity ?? ''} disabled={!f} onChange={(e) => patch('timeZoneCity', e.target.value)} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{t('settings.dateTime.hint')}</p>
      </SectionCard>
  );

  if (ready && !canManage) {
    return (
      <div data-f="F-01-168 F-01-178 F-01-179 F-10-133 F-10-134 F-10-136" className="flex flex-col gap-4">
        <PageHeader title={t('settings.title')} />
        <EmptyState icon={<Lock className="size-8" />} title={t('settings.accessDenied.title')} description={t('settings.accessDenied.text')} />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('settings.title')} />
        <ErrorState onRetry={() => settingsQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      {!form || settingsQuery.isLoading ? (
        <div aria-busy className="contents">
          {mainSection(null)}
          {dateTimeSection(null)}
        </div>
      ) : (
        <>
          {mainSection(form)}

          {dateTimeSection(form)}

          <SectionCard title={t('settings.sections.records')}>
            <div className="flex flex-col gap-5">
              <div data-f="F-01-171" className="flex flex-col gap-2">
                <p className="text-sm font-medium text-fg">{t('settings.firstLine.label')}</p>
                <div className="flex flex-col gap-1">
                  {(['service', 'clientName', 'phone'] as const).map((opt) => (
                    <Radio
                      key={opt}
                      name="firstLine"
                      label={t(`settings.firstLine.${opt}` as never)}
                      checked={form.firstLineMode === opt}
                      onChange={() => patch('firstLineMode', opt)}
                    />
                  ))}
                </div>
              </div>

              <div data-f="F-01-172" className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-fg">{t('settings.visitGrouping.label')}</p>
                <p className="text-sm text-muted">{t('settings.visitGrouping.hint')}</p>
                <VisitGroupingControl t={t} />
              </div>

              <div data-f="F-01-174" className="border-t border-border pt-4">
                <SplitByResourceSwitch t={t} />
              </div>

              <div data-f="F-01-155 F-16-148" className="border-t border-border pt-4">
                <Switch
                  checked={form.waitlistEnabled}
                  onCheckedChange={(v) => patch('waitlistEnabled', v)}
                  label={t('settings.waitlist.title')}
                  description={t('settings.waitlist.hint')}
                />
              </div>

              <div data-f="F-01-059" className="border-t border-border pt-4">
                <Switch
                  checked={form.assistantPayEnabled}
                  onCheckedChange={(v) => patch('assistantPayEnabled', v)}
                  label={t('settings.assistantPay.title')}
                  description={t('settings.assistantPay.hint')}
                />
              </div>

              <div data-f="F-01-121" className="flex flex-col gap-2 border-t border-border pt-4 sm:max-w-xs">
                <p className="text-sm font-medium text-fg">{t('settings.restoreWindow.label')}</p>
                <p className="text-sm text-muted">{t('settings.restoreWindow.hint')}</p>
                <Select
                  className="mt-1"
                  value={String(form.deletionRestoreWindowDays)}
                  onValueChange={(v) => patch('deletionRestoreWindowDays', Number(v))}
                  options={RESTORE_WINDOW_OPTIONS.map((d) => ({ value: String(d), label: t('settings.restoreWindow.days', { n: d }) }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('settings.sections.breaks')}>
            <div className="flex flex-col gap-5">
              <div data-f="F-01-175 F-02-061" className="flex flex-col gap-2">
                <p className="text-sm font-medium text-fg">{t('settings.breakRule.label')}</p>
                <BreakCombineControl t={t} />
              </div>
              <div data-f="F-01-175" className="flex flex-col gap-1.5 border-t border-border pt-4 sm:max-w-xs">
                <p className="text-sm font-medium text-fg">{t('settings.defaultBreak.label')}</p>
                <p className="text-sm text-muted">{t('settings.defaultBreak.hint')}</p>
                <Select
                  className="mt-1"
                  value={String(form.defaultBreakAfterMin)}
                  onValueChange={(v) => patch('defaultBreakAfterMin', Number(v))}
                  options={BREAK_OPTIONS.map((m) => ({ value: String(m), label: m === 0 ? t('settings.defaultBreak.none') : format.duration(m) }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('settings.sections.clients')}>
            <div data-f="F-01-173">
              <Switch
                checked={form.allowOverlapOverNoShow}
                onCheckedChange={(v) => patch('allowOverlapOverNoShow', v)}
                label={t('settings.allowOverlapOverNoShow.title')}
                description={t('settings.allowOverlapOverNoShow.hint')}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('settings.sections.fullName')}>
            <div className="flex flex-col gap-4">
              <div data-f="F-01-176">
                <ElsewhereRow text={t('settings.fullName.surnameHint')} href="/biz/settings" linkText={t('settings.fullName.surnameLink')} />
              </div>
              <div data-f="F-01-176">
                <Switch
                  checked={form.patronymicEnabled}
                  onCheckedChange={(v) => patch('patronymicEnabled', v)}
                  label={t('settings.fullName.patronymic')}
                  description={t('settings.fullName.patronymicHint')}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t('settings.sections.elsewhere')} description={undefined}>
            <div data-f="F-01-177" className="flex flex-col gap-3 text-sm">
              <ElsewhereRow
                text={t('settings.elsewhere.planningPeriod')}
                href="/biz/schedule"
                linkText={t('settings.elsewhere.planningPeriodLink')}
              />
              <ElsewhereRow text={t('settings.elsewhere.groupCapacity')} href="/biz/services" linkText={t('settings.elsewhere.groupCapacityLink')} />
              <p className="text-muted">{t('settings.elsewhere.chatWhatsapp')}</p>
            </div>
          </SectionCard>

          <ChatSection form={form} patch={patch} businessId={businessId} t={t} />

        </>
      )}

      {/* Одна и та же панель «Сохранить» и при загрузке (неактивна), и с формой: не пересоздаётся — не выезжает заново */}
      <StickyActionBar desktop="sticky" aria-label={t('settings.save')}>
        <Button loading={saving} disabled={!form} onClick={handleSave} data-f="F-01-168">
          {t('settings.save')}
        </Button>
      </StickyActionBar>

      {/* Права — под всеми секциями формы: пока формы нет, не рисуем, иначе блок съехал бы вниз, когда она придёт */}
      {form && <RightsSection businessId={businessId} t={t} toast={toast} />}
    </div>
  );
}

function ElsewhereRow({ text, href, linkText }: { text: ReactNode; href: string; linkText: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
      <p className="min-w-0 flex-1 text-muted">{text}</p>
      <Link href={href} className="shrink-0 inline-flex min-h-10 items-center py-2 text-sm font-medium text-primary-text hover:underline">
        {linkText}
      </Link>
    </div>
  );
}

// ─────────────────────────── F-01-172: режим склейки визита ───────────────────────────

function VisitGroupingControl({ t }: { t: ReturnType<typeof useT<'journal'>> }) {
  // Хранится отдельно (visitIntervalMin в срезе журнала) — здесь читаем/пишем через getVisitGroupingMode
  const q = useApiQuery(['journal', 'visit-grouping'], getVisitGroupingMode);
  const mutation = useApiMutation(setVisitGroupingMode);
  const setMode = async (mode: VisitGroupingMode) => {
    await mutation.mutate(mode);
    q.refetch();
  };

  if (q.isLoading || !q.data) return <Skeleton lines={2} />;

  return (
    <div className="flex flex-col gap-1.5">
      <Radio
        name="visitGrouping"
        label={t('settings.visitGrouping.perBooking')}
        checked={q.data.kind === 'perBooking'}
        onChange={() => setMode({ kind: 'perBooking' })}
      />
      <Radio
        name="visitGrouping"
        label={t('settings.visitGrouping.allDay')}
        checked={q.data.kind === 'allDay'}
        onChange={() => setMode({ kind: 'allDay' })}
      />
      <div className="flex items-center gap-2">
        <Radio
          name="visitGrouping"
          // F-01-172: без label/description зона нажатия — только сам кружок (20px), меньше 40px
          // минимума; своего label здесь нет (текст — в Select рядом), поэтому расширяем сам label-обёртку.
          className="min-w-11"
          checked={q.data.kind === 'gapMinutes'}
          onChange={() => setMode({ kind: 'gapMinutes', minutes: 15 })}
        />
        <Select
          className="max-w-[14rem]"
          disabled={q.data.kind !== 'gapMinutes'}
          value={q.data.kind === 'gapMinutes' ? String(q.data.minutes) : '15'}
          onValueChange={(v) => setMode({ kind: 'gapMinutes', minutes: Number(v) as VisitGapMinutes })}
          options={VISIT_GAP_OPTIONS.map((m) => ({ value: String(m), label: t('settings.visitGrouping.gap', { n: m }) }))}
        />
      </div>
    </div>
  );
}

// ─────────────────────────── F-01-174 (перенесено из шапки) ───────────────────────────

function SplitByResourceSwitch({ t }: { t: ReturnType<typeof useT<'journal'>> }) {
  const q = useApiQuery(['journal', 'prefs-split'], getJournalPrefs);
  const mutation = useApiMutation(setSplitByResourceEnabled);
  if (q.isLoading || !q.data) return <Skeleton lines={1} />;
  return (
    <Switch
      checked={q.data.splitByResourceEnabled}
      onCheckedChange={async (v) => {
        await mutation.mutate(v);
        q.refetch();
      }}
      label={t('settings.splitByResource.title')}
      description={t('settings.splitByResource.hint')}
    />
  );
}

function BreakCombineControl({ t }: { t: ReturnType<typeof useT<'journal'>> }) {
  const q = useApiQuery(['journal', 'prefs-break-combine'], getJournalPrefs);
  const mutation = useApiMutation(setBreakCombineMode);
  if (q.isLoading || !q.data) return <Skeleton lines={2} />;
  return (
    <div className="flex flex-col gap-1.5">
      <Radio
        name="breakCombine"
        label={t('settings.breakRule.longest')}
        checked={q.data.breakCombineMode === 'longest'}
        onChange={async () => {
          await mutation.mutate('longest');
          q.refetch();
        }}
      />
      <Radio
        name="breakCombine"
        label={t('settings.breakRule.sum')}
        checked={q.data.breakCombineMode === 'sum'}
        onChange={async () => {
          await mutation.mutate('sum');
          q.refetch();
        }}
      />
    </div>
  );
}

// ─────────────────────────── F-01-165/166: чат с клиентом ───────────────────────────

function ChatSection({
  form,
  patch,
  businessId,
  t,
}: {
  form: JournalSettings;
  patch: <K extends keyof JournalSettings>(k: K, v: JournalSettings[K]) => void;
  businessId: string | undefined;
  t: ReturnType<typeof useT<'journal'>>;
}) {
  const toast = useToast();
  const autoSaveQuery = useApiQuery(['clients', 'autoSaveChatLeads'], getAutoSaveChatLeads);
  const setAutoSave = useApiMutation(setAutoSaveChatLeads);
  // F-01-165: по ТЗ у всплывашки есть «ссылка на чат» — раньше был только текст. Ссылка ведёт на
  // карточку клиента (вкладка сообщений); клиент появляется, только если включено «Сохранять лидов
  // из чата автоматически» (F-01-166) — без него ссылки нет, есть смысл вести только в общий список.
  const [popupBanner, setPopupBanner] = useState<{ text: string; clientId?: string } | null>(null);

  return (
    <SectionCard title={t('settings.sections.chat')} actions={<MessageCircle aria-hidden className="size-4 text-muted" />}>
      <div data-f="F-01-165 F-01-166" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border-strong bg-surface-2 px-3.5 py-3">
          <p className="min-w-0 flex-1 text-sm text-muted">
            {form.chatIntegrationConnected ? t('settings.chat.connectedTitle') : t('settings.chat.disabledHint')}
          </p>
          <button
            type="button"
            className="shrink-0 inline-flex min-h-10 items-center py-2 text-sm font-medium text-primary-text hover:underline"
            onClick={() => patch('chatIntegrationConnected', !form.chatIntegrationConnected)}
          >
            {form.chatIntegrationConnected ? t('settings.chat.disconnectDemo') : t('settings.chat.connectDemo')}
          </button>
        </div>

        {form.chatIntegrationConnected && (
          <>
            <div data-f="F-13-169">
              <Switch checked={form.chatPopupEnabled} onCheckedChange={(v) => patch('chatPopupEnabled', v)} label={t('settings.chat.popup.title')} />
            </div>
            <div data-f="F-13-170">
              <Switch
                checked={autoSaveQuery.data ?? false}
                onCheckedChange={async (v) => {
                  try {
                    await setAutoSave.mutate(v);
                    autoSaveQuery.refetch();
                  } catch {
                    toast.error(t('settings.saveFailed'));
                  }
                }}
                label={t('settings.chat.autoSaveLeads.title')}
                description={t('settings.chat.autoSaveLeads.hint')}
              />
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!businessId) return;
                  let leadClientId: string | undefined;
                  if (autoSaveQuery.data) {
                    try {
                      const lead = await simulateChatLead(businessId);
                      leadClientId = lead.id;
                      toast.success(t('settings.chat.autoSaveLeads.title'));
                    } catch {
                      // тумблер выключен — попап ниже всё равно покажется без ссылки на карточку
                    }
                  }
                  if (form.chatPopupEnabled) {
                    setPopupBanner({ text: t('settings.chat.popupToast', { name: 'New client' }), clientId: leadClientId });
                    window.setTimeout(() => setPopupBanner(null), 4000);
                  }
                }}
              >
                {t('settings.chat.simulate')}
              </Button>
            </div>
            {popupBanner && (
              <div
                role="status"
                data-f="F-01-165 F-13-169"
                className="fixed bottom-4 left-4 z-50 flex max-w-xs items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-fg shadow-lg"
              >
                <MessageCircle aria-hidden className="size-4 shrink-0 text-primary-text" />
                <span className="min-w-0 flex-1">{popupBanner.text}</span>
                <Link
                  href={popupBanner.clientId ? `/biz/clients/${popupBanner.clientId}?tab=calls` : '/biz/clients'}
                  className="shrink-0 font-medium text-primary-text hover:underline"
                  onClick={() => setPopupBanner(null)}
                >
                  {t('settings.chat.popupOpenChat')}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ─────────────────────────── F-01-178/179: права по сотруднику ───────────────────────────

const JOURNAL_RIGHT_KEYS = [
  'viewAllPositions',
  'editStaffSchedule',
  'showPhones',
  'reschedule',
  'showStatistics',
] as const satisfies readonly (keyof JournalBlockRights)[];

const WINDOW_RIGHT_GROUPS: { titleKey: string; rights: (keyof WindowRights)[] }[] = [
  { titleKey: 'assistants', rights: ['manageAssistants', 'editAssistantShare'] },
  { titleKey: 'client', rights: ['clientAccess', 'createClientInWindow', 'clientDropdown', 'showPhones', 'clientAccessNetwork'] },
  { titleKey: 'fields', rights: ['viewCustomFields', 'editCustomFields'] },
  {
    titleKey: 'records',
    rights: [
      'createBookings',
      'editBookings',
      'editArrivedStatus',
      'editArrivedPaid',
      'editConfirmedStatus',
      'editServicePrice',
      'editServiceDiscount',
      'changeStaffAndTime',
      'changeDuration',
      'editComment',
      'editServiceComposition',
    ],
  },
  { titleKey: 'delete', rights: ['deleteBookings', 'deleteArrivedBookings', 'deletePaidBookings'] },
  { titleKey: 'goods', rights: ['sellGoods', 'createGoodsTx', 'editGoodsTx', 'editGoodsPrice', 'editGoodsDiscount'] },
  { titleKey: 'payment', rights: ['takePayment', 'takePaymentFromClientAccount'] },
  { titleKey: 'consumables', rights: ['editConsumables'] },
];

function RightsSection({
  businessId,
  t,
  toast,
}: {
  businessId: string | undefined;
  t: ReturnType<typeof useT<'journal'>>;
  toast: ReturnType<typeof useToast>;
}) {
  const [tab, setTab] = useState<'journal' | 'window'>('journal');
  const staffQuery = useApiQuery(['journal', 'rights-staff-options', businessId], () => listStaffOptions(businessId!), {
    enabled: Boolean(businessId),
  });
  const [staffId, setStaffId] = useState('');
  const activeStaffId = staffId || staffQuery.data?.[0]?.value || '';

  const journalRightsQuery = useApiQuery(['journal', 'staff-rights-edit', activeStaffId], () => getStaffJournalRights(activeStaffId), {
    enabled: Boolean(activeStaffId),
  });
  const windowRightsQuery = useApiQuery(['journal', 'staff-window-rights-edit', activeStaffId], () => getStaffWindowRights(activeStaffId), {
    enabled: Boolean(activeStaffId),
  });

  const journalCurrent: JournalBlockRights = { ...defaultAdminJournalRights(), ...journalRightsQuery.data };
  const windowCurrent: WindowRights = { ...defaultAdminWindowRights(), ...windowRightsQuery.data };

  const toggleJournal = async (key: keyof JournalBlockRights, value: boolean) => {
    if (!activeStaffId) return;
    try {
      await setStaffJournalRights(activeStaffId, { ...journalCurrent, [key]: value });
      journalRightsQuery.refetch();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };
  const toggleWindow = async (key: keyof WindowRights, value: boolean) => {
    if (!activeStaffId) return;
    try {
      await setStaffWindowRights(activeStaffId, { ...windowCurrent, [key]: value });
      windowRightsQuery.refetch();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div data-f="F-01-085 F-01-115 F-01-154 F-01-178 F-01-179 F-01-180">
      <SectionCard title={t('settings.rights.title')} description={t('settings.rights.subtitle')}>
        {staffQuery.isLoading ? (
          <Skeleton lines={3} />
        ) : (staffQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t('settings.rights.noStaff')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Select
              options={(staffQuery.data ?? []).map((s) => ({ value: s.value, label: s.label }))}
              value={activeStaffId}
              onValueChange={setStaffId}
            />
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'journal' | 'window')}
              items={[
                { value: 'journal', label: t('settings.rights.journalBlock') },
                { value: 'window', label: t('settings.rights.windowBlock') },
              ]}
            />

            {tab === 'journal' ? (
              journalRightsQuery.isLoading ? (
                <Skeleton lines={6} />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {JOURNAL_RIGHT_KEYS.map((key) => (
                    <Switch
                      key={key}
                      checked={Boolean(journalCurrent[key])}
                      onCheckedChange={(v) => toggleJournal(key, v)}
                      label={t(`settings.rights.journal.${key}` as never)}
                    />
                  ))}
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                    <p className="text-sm font-medium text-fg">{t('settings.rights.journal.viewStaffScope')}</p>
                    <div className="flex flex-col gap-1">
                      <Radio
                        name="staffScope"
                        label={t('settings.rights.journal.viewStaffScopeAll')}
                        checked={journalCurrent.viewStaffScope === 'all'}
                        onChange={() =>
                          setStaffJournalRights(activeStaffId, { ...journalCurrent, viewStaffScope: 'all' }).then(() => journalRightsQuery.refetch())
                        }
                      />
                      <Radio
                        name="staffScope"
                        label={t('settings.rights.journal.viewStaffScopeOwn')}
                        checked={journalCurrent.viewStaffScope === 'own'}
                        onChange={() =>
                          setStaffJournalRights(activeStaffId, { ...journalCurrent, viewStaffScope: 'own' }).then(() => journalRightsQuery.refetch())
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3 sm:max-w-xs">
                    <p className="text-sm font-medium text-fg">{t('settings.rights.journal.historyLimit')}</p>
                    <Select
                      value={journalCurrent.historyLimit}
                      onValueChange={(v) =>
                        setStaffJournalRights(activeStaffId, { ...journalCurrent, historyLimit: v as HistoryWindowLimit }).then(() =>
                          journalRightsQuery.refetch(),
                        )
                      }
                      options={HISTORY_OPTIONS.map((opt) => ({ value: opt, label: t(`settings.rights.historyOptions.${opt}` as never) }))}
                    />
                  </div>
                </div>
              )
            ) : windowRightsQuery.isLoading ? (
              <Skeleton lines={10} />
            ) : (
              <div className="flex flex-col gap-4">
                {WINDOW_RIGHT_GROUPS.map((group) => (
                  <div key={group.titleKey} className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-col gap-2">
                      {group.rights.map((r) => (
                        <Switch
                          key={r}
                          checked={Boolean(windowCurrent[r])}
                          onCheckedChange={(v) => toggleWindow(r, v)}
                          label={t(`settings.rights.window.${r}` as never)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
