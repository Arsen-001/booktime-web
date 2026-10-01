'use client';

/**
 * Вклад «resources» в окно записи (F-16-013): «Ресурсы» — ручной выбор экземпляров. Виден всегда, если в
 * локации есть хотя бы один ресурс (F-16-008); занятые на это время экземпляры — серые и не выбираются.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { coreList } from '@/api/core';
import {
  getAssistantSettings,
  getBookingAssistants,
  listAssistantStaff,
  listResourceOptions,
  setBookingAssistants,
  type AssistantEligibleStaff,
  type BookingAssistant,
} from '@/api/resources';
import { useApiQuery } from '@/api/request';
import { useResourcesRights } from '@/areas/resources/lib/rights';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useAfterSaveStep } from '@/extensions/saveHooks';
import { pickText } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';

export default function ResourcesBookingWindow({ businessId, draft, onDraftChange, bookingId, registerAfterSave }: BookingWindowExtProps) {
  const t = useT('resources');
  const locale = useLocale();

  const durationMin = draft.durationMin ?? draft.services?.reduce((n, s) => n + s.durationMin * s.qty, 0) ?? 0;
  const enabled = Boolean(draft.start) && durationMin > 0;

  const optionsQ = useApiQuery(
    ['resources', 'booking-window-options', businessId, draft.start, durationMin, bookingId],
    () => listResourceOptions(businessId, draft.start!, durationMin, bookingId),
    { enabled },
  );

  const selected = draft.resourceIds ?? [];
  const allInstances = useMemo(
    () =>
      (optionsQ.data ?? []).flatMap((opt) =>
        opt.instances.map((inst) => ({
          value: inst.id,
          label: `${pickText(opt.resource.name, locale)} — ${inst.name}`,
          busy: inst.busy,
        })),
      ),
    [optionsQ.data, locale],
  );

  const showResources = optionsQ.isLoading || (optionsQ.data ?? []).length > 0;

  const setRow = (index: number, instanceId: string) => {
    const next = [...selected];
    next[index] = instanceId;
    onDraftChange?.({ resourceIds: next });
  };
  const addRow = () => onDraftChange?.({ resourceIds: [...selected, ''] });
  const removeRow = (index: number) => onDraftChange?.({ resourceIds: selected.filter((_, i) => i !== index) });

  return (
    <>
      {showResources && (
        <div data-f="F-16-011 F-16-012 F-16-013 F-16-014 F-16-017" className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg">{t('bookingWindow.title')}</span>
          {/* Пока варианты читаются — та же разметка (подпись «не выбрано», строки выбора, «+ Добавить»): варианты
              нужны только в выпадающем, место блока от них не зависит */}
          <>
              {selected.length === 0 && <p className="text-sm text-muted">{t('bookingWindow.none')}</p>}
              {selected.map((instanceId, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    className="flex-1"
                    placeholder={t('bookingWindow.placeholder')}
                    value={instanceId}
                    onValueChange={(v) => setRow(i, v)}
                    options={allInstances.map((o) => ({
                      value: o.value,
                      label: o.busy && o.value !== instanceId ? t('bookingWindow.busyOption', { label: o.label }) : o.label,
                      disabled: o.busy && o.value !== instanceId,
                    }))}
                  />
                  <IconButton icon={<Trash2 aria-hidden />} label={t('bookingWindow.remove')} variant="ghost" size="sm" onClick={() => removeRow(i)} />
                </div>
              ))}
              <button type="button" onClick={addRow} disabled={optionsQ.isLoading} className="flex min-h-10 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary-text hover:bg-primary-soft">
                <Plus aria-hidden className="size-4" />
                {t('bookingWindow.add')}
              </button>
          </>
        </div>
      )}
      <AssistantsBlock businessId={businessId} draft={draft} bookingId={bookingId} registerAfterSave={registerAfterSave} />
    </>
  );
}

/**
 * Ассистенты строки услуги (F-16-136, F-16-142…144): «+ Добавить ассистента» только у сотрудников с
 * «Доступен для ассистирования» (F-16-138) и только когда компенсация включена (F-16-140); доля — 100% и
 * редактируемая при «полная каждому», иначе распределена и не редактируется (F-16-143); права — своя тонкая
 * галочка вместо грубого resources.manage (F-16-144).
 */
function AssistantsBlock({ businessId, draft, bookingId, registerAfterSave }: Pick<BookingWindowExtProps, 'businessId' | 'draft' | 'bookingId' | 'registerAfterSave'>) {
  const t = useT('resources');
  const locale = useLocale();
  const rights = useResourcesRights();

  const settingsQ = useApiQuery(['resources', 'assistant-settings', businessId], () => getAssistantSettings(businessId));
  const staffQ = useApiQuery(['resources', 'assistant-staff', businessId], () => listAssistantStaff(businessId), {
    enabled: Boolean(settingsQ.data?.compensationEnabled),
  });
  const servicesQ = useApiQuery(['resources', 'services-for-form', businessId], () => coreList('services', { businessId }), {
    enabled: Boolean(settingsQ.data?.compensationEnabled),
  });

  const lines = draft.services ?? [];
  const [byLine, setByLine] = useState<Record<number, BookingAssistant[]>>({});
  const [loadedForBooking, setLoadedForBooking] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!bookingId || loadedForBooking === bookingId || lines.length === 0) return;
    let cancelled = false;
    Promise.all(lines.map((_, i) => getBookingAssistants(bookingId, i))).then((all) => {
      if (cancelled) return;
      setByLine(Object.fromEntries(all.map((a, i) => [i, a])));
      setLoadedForBooking(bookingId);
    });
    return () => {
      cancelled = true;
    };
    // lines — новый массив на каждый рендер (draft.services ?? []); достаточно длины, ссылку намеренно не включаем
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, loadedForBooking, lines.length]);

  useAfterSaveStep(registerAfterSave, async (savedBookingId) => {
    const shareRule = settingsQ.data?.shareRule ?? 'split';
    await Promise.all(Object.entries(byLine).map(([i, list]) => setBookingAssistants(savedBookingId, Number(i), list, shareRule)));
  });

  if (!settingsQ.data?.compensationEnabled || lines.length === 0) return null;

  const eligible: AssistantEligibleStaff[] = (staffQ.data ?? []).filter((s) => s.eligible && s.id !== draft.staffId);

  const addAssistant = (lineIndex: number, staffId: string) => {
    const current = byLine[lineIndex] ?? [];
    if (current.some((a) => a.staffId === staffId)) return;
    const shareRule = settingsQ.data?.shareRule ?? 'split';
    const next = shareRule === 'full' ? [...current, { staffId, sharePercent: 100 }] : [...current, { staffId, sharePercent: 0 }];
    const normalized =
      shareRule === 'split'
        ? next.map((a, i, arr) => ({ ...a, sharePercent: Math.floor(100 / arr.length) + (i < 100 % arr.length ? 1 : 0) }))
        : next;
    setByLine((prev) => ({ ...prev, [lineIndex]: normalized }));
  };
  const removeAssistant = (lineIndex: number, staffId: string) => {
    setByLine((prev) => ({ ...prev, [lineIndex]: (prev[lineIndex] ?? []).filter((a) => a.staffId !== staffId) }));
  };
  const setShare = (lineIndex: number, staffId: string, sharePercent: number) => {
    setByLine((prev) => ({ ...prev, [lineIndex]: (prev[lineIndex] ?? []).map((a) => (a.staffId === staffId ? { ...a, sharePercent } : a)) }));
  };

  return (
    <div data-f="F-16-136 F-16-142 F-16-143 F-16-144 F-09-046 F-09-048" className="flex flex-col gap-3">
      <span className="text-sm font-medium text-fg">{t('assistants.blockTitle')}</span>
      {lines.map((line, i) => {
        const assistants = byLine[i] ?? [];
        const staffOptions = eligible.filter((s) => !assistants.some((a) => a.staffId === s.id));
        return (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <span className="text-sm text-fg">
              {(() => {
                const svc = (servicesQ.data ?? []).find((s) => s.id === line.serviceId);
                return svc ? pickText(svc.name, locale) : t('assistants.serviceLine', { index: i + 1 });
              })()}
            </span>
            {assistants.length === 0 ? (
              <p className="text-xs text-muted">{t('assistants.none')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {assistants.map((a) => {
                  const staff = eligible.find((s) => s.id === a.staffId) ?? (staffQ.data ?? []).find((s) => s.id === a.staffId);
                  return (
                    <li key={a.staffId} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-fg">{staff?.name ?? a.staffId}</span>
                      {settingsQ.data?.shareRule === 'full' && rights.editAssistantShare ? (
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={a.sharePercent}
                          onChange={(e) => setShare(i, a.staffId, Number(e.target.value))}
                          className="w-20"
                        />
                      ) : (
                        <Badge tone="neutral">{a.sharePercent}%</Badge>
                      )}
                      {rights.addAssistants && (
                        <IconButton icon={<Trash2 aria-hidden />} label={t('assistants.remove')} variant="ghost" size="sm" onClick={() => removeAssistant(i, a.staffId)} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {rights.addAssistants && staffOptions.length > 0 && (
              <Select
                placeholder={t('assistants.addPlaceholder')}
                value=""
                onValueChange={(v) => addAssistant(i, v)}
                options={staffOptions.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            {!rights.addAssistants && (
              <p className="text-xs text-muted">{t('assistants.noPermission')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
