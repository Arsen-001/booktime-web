'use client';

/**
 * Вклад раздела «notify» в карточку сотрудника (хост «staffCard», F-05-055/056/057/060/063 — уведомления
 * сотрудника). Файл принадлежит разделу «notify». Посмотреть вклад без хозяина хоста: /dev/ext/staffCard/notify
 *
 * F-05-055: вид уведомлений («на основе прав» пересчитывается из Staff.role на лету — effectiveStaffNotifyView).
 * F-05-056: таблица «тип события × канал» — SMS/Email добавляются сотруднику только здесь.
 * F-05-057: «Отправлять имя и номер телефона клиента» — по умолчанию снята.
 * F-05-060: пуши в приложении для бизнеса — у нас нет отдельного мобильного приложения, поэтому список
 *   видов пушей показываем прямо здесь как «свои пуши» сотрудника (🔒 демо: страница телефона не открывали).
 * F-05-063: приглашение сотрудника в систему — отправить/отозвать/повторно/скопировать ссылку, строка в журнал.
 * F-05-113: без права `notify.manage` вкладка чужого сотрудника не прячется, а видна ТОЛЬКО ДЛЯ ЧТЕНИЯ
 *   (свою собственную — StaffOwnNotifyTab, staff area, показывает отдельно).
 */
import { Bell, Lock } from 'lucide-react';
import { useCoreGet } from '@/api/core';
import {
  effectiveStaffNotifyView,
  getStaffNotifyPrefs,
  listChannels,
  setStaffNotifyMatrixCell,
  updateStaffNotifyPrefs,
} from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { defaultStaffNotifyPrefs, STAFF_NOTIFY_CHANNELS, STAFF_NOTIFY_EVENTS, STAFF_NOTIFY_VIEWS } from '@/domain/notify';
import type { StaffNotifyChannel, StaffNotifyEvent, StaffNotifyView } from '@/domain/notify';
import { useCan, useCurrent } from '@/demo/hooks';
import type { StaffCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export default function NotifyStaffCard({ staffId, businessId }: StaffCardExtProps) {
  const t = useT('notify');
  const toast = useToast();
  const canManage = useCan('notify.manage');
  const { staffId: myStaffId } = useCurrent();

  const staffQ = useCoreGet('staff', staffId);
  const prefsQ = useApiQuery(['notify', 'staffPrefs', staffId], () => getStaffNotifyPrefs(staffId));
  const channelsQ = useApiQuery(['notify', 'channels', businessId], () => listChannels(businessId));

  const setView = useApiMutation(updateStaffNotifyPrefs);
  const toggleCell = useApiMutation(setStaffNotifyMatrixCell);
  const toggleContacts = useApiMutation(updateStaffNotifyPrefs);

  // F-05-113: своя карточка без права — молчим, её показывает StaffOwnNotifyTab (staff area).
  if (!canManage && myStaffId === staffId) return null;
  const loading = staffQ.isLoading || prefsQ.isLoading || channelsQ.isLoading;
  if (loading && !canManage) return <Skeleton lines={6} />;
  if (!loading && (!staffQ.data || !prefsQ.data)) return null;

  if (!canManage && staffQ.data && prefsQ.data) {
    const staff = staffQ.data;
    const prefs = prefsQ.data;
    const effectiveView = effectiveStaffNotifyView(prefs, staff.role);
    return (
      <div data-f="F-05-113" className="flex flex-col gap-5">
        <SectionCard title={t('staffCard.notify.viewTitle')} description={t('staffCard.notify.readOnlyHint')}>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Lock aria-hidden className="size-4 shrink-0" />
            <span>{t(`staffCard.notify.view.${effectiveView}`)}</span>
          </div>
          {effectiveView !== 'off' && (
            <div className="mt-4 overflow-x-auto opacity-70">
              <table className="w-full min-w-[420px] border-separate border-spacing-y-1 text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-1 font-normal">{t('staffCard.notify.eventCol')}</th>
                    {STAFF_NOTIFY_CHANNELS.map((ch) => (
                      <th key={ch} className="px-2 pb-1 text-center font-normal">
                        {t(`staffCard.notify.channel.${ch}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAFF_NOTIFY_EVENTS.map((event) => (
                    <tr key={event} className="rounded-lg bg-surface-2/40">
                      <td className="rounded-l-lg py-2 pl-2 text-fg">{t(`staffCard.notify.event.${event}`)}</td>
                      {STAFF_NOTIFY_CHANNELS.map((channel, i) => (
                        <td key={channel} className={`px-2 py-2 text-center ${i === STAFF_NOTIFY_CHANNELS.length - 1 ? 'rounded-r-lg' : ''}`}>
                          <Checkbox
                            checked={prefs.matrix[event]?.[channel] ?? false}
                            disabled
                            onCheckedChange={() => {}}
                            aria-label={`${t(`staffCard.notify.event.${event}`)} · ${t(`staffCard.notify.channel.${channel}`)}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  // Загрузка — та же вкладка с настройками по умолчанию (все поля выключены): пришли данные — галочки просто отмечаются
  const prefs = prefsQ.data ?? defaultStaffNotifyPrefs(staffId);
  const effectiveView = effectiveStaffNotifyView(prefs, staffQ.data?.role ?? 'master');
  const channelConnected = (ch: StaffNotifyChannel) => !loading && (channelsQ.data?.find((c) => c.channel === ch)?.connected ?? false);

  const handleView = async (view: StaffNotifyView) => {
    try {
      await setView.mutate({ staffId, patch: { view } });
      await prefsQ.refetch();
      toast.success(t('staffCard.notify.saved'));
    } catch {
      toast.error(t('staffCard.notify.saveFailed'));
    }
  };

  const handleCell = async (event: StaffNotifyEvent, channel: StaffNotifyChannel, value: boolean) => {
    try {
      await toggleCell.mutate({ staffId, event, channel, value });
      await prefsQ.refetch();
    } catch {
      toast.error(t('staffCard.notify.saveFailed'));
    }
  };

  const handleContacts = async (sendClientContacts: boolean) => {
    try {
      await toggleContacts.mutate({ staffId, patch: { sendClientContacts } });
      await prefsQ.refetch();
    } catch {
      toast.error(t('staffCard.notify.saveFailed'));
    }
  };


  return (
    <div data-f="F-05-055 F-05-056 F-05-057 F-05-060 F-05-063" className="flex flex-col gap-5">
      {/* F-05-063: приглашение живёт на соседнем блоке «Доступ» карточки — с номером из карточки и проверкой
          телефона/почты (обзор «Сотрудники» С13, 27.09.2026: здесь оно уходило на любую строку и дублировало «Доступ») */}
      <span data-f="F-05-063" hidden />
      {/* F-05-055: вид уведомлений */}
      <SectionCard title={t('staffCard.notify.viewTitle')} description={t('staffCard.notify.viewHint')}>
        <div data-f="F-05-055" className="flex flex-col gap-2">
          <Select
            className="max-w-72"
            value={prefs.view}
            disabled={loading}
            onValueChange={(v) => void handleView(v as StaffNotifyView)}
            options={STAFF_NOTIFY_VIEWS.map((v) => ({ value: v, label: t(`staffCard.notify.view.${v}`) }))}
          />
          {prefs.view === 'byAccess' && (
            <p className="text-xs text-muted">
              {loading ? <SkeletonText width="28ch" /> : t('staffCard.notify.effective', { view: t(`staffCard.notify.view.${effectiveView}`) })}
            </p>
          )}
        </div>
      </SectionCard>

      {/* F-05-056: таблица тип × каналы. F-05-060: колонка «Push» = пуш в приложение для бизнеса */}
      {effectiveView !== 'off' && (
        <SectionCard title={t('staffCard.notify.matrixTitle')} description={t('staffCard.notify.matrixHint')}>
          {/* Телефон (С17 обзора «Сотрудники»): строка на событие, под ней SMS · Email · Push в ряд — без обрезки справа */}
          <ul className="flex flex-col divide-y divide-border md:hidden">
            {STAFF_NOTIFY_EVENTS.map((event) => (
              <li key={event} className="flex flex-col gap-2 py-3">
                <span className="text-sm text-fg">{t(`staffCard.notify.event.${event}`)}</span>
                <span className="flex flex-wrap gap-x-5 gap-y-2">
                  {STAFF_NOTIFY_CHANNELS.map((channel) => (
                    <Checkbox
                      key={channel}
                      checked={prefs.matrix[event]?.[channel] ?? false}
                      disabled={!channelConnected(channel)}
                      onCheckedChange={(v) => void handleCell(event, channel, v)}
                      label={t(`staffCard.notify.channel.${channel}`)}
                    />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <div data-f="F-05-056 F-05-060" className="overflow-x-auto max-md:hidden">
            <table className="w-full min-w-[420px] border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1 font-normal">{t('staffCard.notify.eventCol')}</th>
                  {STAFF_NOTIFY_CHANNELS.map((ch) => (
                    <th key={ch} className="px-2 pb-1 text-center font-normal">
                      {t(`staffCard.notify.channel.${ch}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAFF_NOTIFY_EVENTS.map((event) => (
                  <tr key={event} className="rounded-lg bg-surface-2/40">
                    <td className="rounded-l-lg py-2 pl-2 text-fg">{t(`staffCard.notify.event.${event}`)}</td>
                    {STAFF_NOTIFY_CHANNELS.map((channel, i) => {
                      const connected = channelConnected(channel);
                      return (
                        <td key={channel} className={`px-2 py-2 text-center ${i === STAFF_NOTIFY_CHANNELS.length - 1 ? 'rounded-r-lg' : ''}`}>
                          <Checkbox
                            checked={prefs.matrix[event]?.[channel] ?? false}
                            disabled={!connected}
                            onCheckedChange={(v) => void handleCell(event, channel, v)}
                            aria-label={`${t(`staffCard.notify.event.${event}`)} · ${t(`staffCard.notify.channel.${channel}`)}`}
                          />
                          {!connected && <span className="sr-only">{t('staffCard.notify.channelBlocked')}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {STAFF_NOTIFY_CHANNELS.some((ch) => !channelConnected(ch)) && (
              <p className="mt-2 text-xs text-muted">{t('staffCard.notify.channelBlockedHint')}</p>
            )}
          </div>

          {/* F-05-057 · тот же чекбокс — F-04-225 «Имя и телефон клиента в уведомлениях сотруднику» */}
          <div data-f="F-05-057 F-04-225" className="mt-4 border-t border-border pt-4">
            <Checkbox
              checked={prefs.sendClientContacts}
              disabled={loading}
              onCheckedChange={(v) => void handleContacts(v)}
              label={t('staffCard.notify.clientContacts')}
              description={t('staffCard.notify.clientContactsHint')}
            />
          </div>
        </SectionCard>
      )}

      {effectiveView === 'off' && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-muted p-3 text-sm text-muted">
          <Bell aria-hidden className="size-4 shrink-0" />
          {t('staffCard.notify.offHint')}
        </div>
      )}
    </div>
  );
}
