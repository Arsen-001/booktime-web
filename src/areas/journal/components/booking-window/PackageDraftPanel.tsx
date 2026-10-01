'use client';

/**
 * Окно записи → пакеты, добавленные из списка услуг (F-16-125, F-16-129, F-16-130): блок «Связанные
 * записи» ещё до сохранения — какие пакеты в визите, что делает мастер этой записи, какие записи других
 * мастеров будут созданы (мастера можно поменять), и куда добавить следующую обычную услугу.
 */
import { Link2, Trash2, X } from 'lucide-react';
import type { ISODateTime, Staff } from '@/domain/core';
import { linkedStarts } from '@/domain/journalPackages';
import type { PackageDraft } from '@/areas/journal/components/booking-window/usePackageDraft';
import type { UiServiceLine } from '@/areas/journal/lib/lineTotals';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { Badge } from '@/ui/Badge';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Select } from '@/ui/Select';

export interface PackageDraftPanelProps {
  draft: PackageDraft;
  mainStart: ISODateTime;
  mainDurationMin: number;
  mainStaffName: string;
  serviceLines: UiServiceLine[];
  staffList: Staff[];
  onRemovePackage: (packageId: string) => void;
}

export function PackageDraftPanel({ draft, mainStart, mainDurationMin, mainStaffName, serviceLines, staffList, onRemovePackage }: PackageDraftPanelProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  if (draft.added.length === 0) return null;

  const starts = linkedStarts(mainStart, mainDurationMin, draft.linked);
  const staffName = (id: string) => staffList.find((s) => s.id === id)?.name ?? t('window.packageDraft.noStaff');
  const ownPackageLines = serviceLines.filter((l) => l.packageId);

  return (
    <div data-f="F-16-125 F-16-127 F-16-130" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <Link2 aria-hidden className="size-4 text-muted" />
        <p className="text-sm font-medium text-fg">{t('window.package.siblingsTitle')}</p>
        <Badge tone="accent" size="sm">
          {t('window.package.badge')}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {draft.added.map((p) => (
          <span key={p.packageId} className="flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface pl-3 text-sm text-fg">
            <span className="truncate">{p.name}</span>
            <span className="text-xs text-muted">· {t(`window.packageDraft.mode.${p.mode}`)}</span>
            <IconButton icon={<X aria-hidden />} label={t('window.packageDraft.removePackage')} variant="ghost" size="sm" onClick={() => onRemovePackage(p.packageId)} />
          </span>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        <li className="flex flex-col gap-1 rounded-lg bg-surface px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-fg">{t('window.packageDraft.thisBooking', { name: mainStaffName })}</span>
            <span className="shrink-0 text-muted">{format.time(mainStart)}</span>
          </div>
          {ownPackageLines.length === 0 ? (
            <p className="text-xs text-muted">{t('window.packageDraft.nothingForThisStaff')}</p>
          ) : (
            <p className="text-xs text-muted">{ownPackageLines.map((l) => l.name).join(', ')}</p>
          )}
        </li>

        {draft.linked.map((item, index) => {
          const options = draft.staffOptionsFor(item, staffList);
          const staffChoices = (options.length > 0 ? options : staffList).map((s) => ({ value: s.id, label: s.name }));
          return (
            <li key={item.key} className="flex flex-col gap-2 rounded-lg bg-surface px-3 py-2">
              <div className="flex items-center gap-2">
                <Select
                  size="sm"
                  className="min-w-0 flex-1"
                  aria-label={t('window.packageDraft.staffFor')}
                  value={item.staffId}
                  onValueChange={(v) => draft.setLinkedStaff(item.key, v)}
                  options={staffChoices}
                  placeholder={t('window.packageDraft.noStaff')}
                />
                <span className="shrink-0 text-sm text-muted">{format.time(starts[index] ?? mainStart)}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {item.lines.map((line, lineIndex) => (
                  <li key={`${line.serviceId}:${lineIndex}`} className="flex min-h-9 items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-fg">{line.name}</span>
                      {!line.packageId && (
                        <Badge tone="neutral" size="sm">
                          {t('window.packageDraft.extraService')}
                        </Badge>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-muted">
                      {format.money(line.price)} · {format.duration(line.durationMin)}
                      {!line.packageId && (
                        <IconButton
                          data-f="F-16-129"
                          icon={<Trash2 aria-hidden />}
                          label={t('window.serviceLine.remove')}
                          variant="ghost"
                          size="sm"
                          onClick={() => draft.removeLinkedLine(item.key, lineIndex)}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {draft.linked.length > 0 && (
        <div data-f="F-16-129">
        <FormField label={t('window.packageDraft.targetLabel')} hint={t('window.packageDraft.targetHint')}>
          <Select
            size="sm"
            value={draft.target}
            onValueChange={draft.setTarget}
            options={[
              { value: 'main', label: t('window.packageDraft.thisBooking', { name: mainStaffName }) },
              ...draft.linked.map((item, index) => ({
                value: item.key,
                label: t('window.packageDraft.linkedOption', { name: staffName(item.staffId), time: format.time(starts[index] ?? mainStart) }),
              })),
            ]}
          />
        </FormField>
        </div>
      )}
    </div>
  );
}
