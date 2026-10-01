'use client';

/**
 * Мастера услуги в строке каталога (У5, У8): аватарки, а если никого — жёлтое «Нет мастеров», по нажатию —
 * список с галочками. Правка уходит один раз, когда список закрыли.
 */
import { useState } from 'react';
import { UserX } from 'lucide-react';
import type { Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { Popover } from '@/ui/Popover';

export interface StaffCellProps {
  staffIds: string[];
  staffList: Staff[];
  canEdit: boolean;
  onCommit: (staffIds: string[]) => void;
  label: string;
}

export function StaffCell({ staffIds, staffList, canEdit, onCommit, label }: StaffCellProps) {
  const t = useT('services');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(staffIds);
  const people = staffIds.map((id) => staffList.find((s) => s.id === id)).filter((s): s is Staff => Boolean(s));

  const face =
    people.length === 0 ? (
      <Badge tone="warning" size="sm" icon={<UserX aria-hidden />}>
        {t('list.noStaff')}
      </Badge>
    ) : (
      <span className="flex items-center">
        {people.slice(0, 3).map((s, i) => (
          <Avatar
            key={s.id}
            name={s.name}
            src={s.avatarUrl}
            size="xs"
            colorIndex={s.colorIndex}
            className={i ? '-ml-1.5 ring-2 ring-surface' : 'ring-2 ring-surface'}
          />
        ))}
        {people.length > 3 && <span className="ml-1 text-xs font-medium text-muted">+{people.length - 3}</span>}
      </span>
    );

  if (!canEdit) return face;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(staffIds);
        else if (JSON.stringify([...draft].sort()) !== JSON.stringify([...staffIds].sort())) onCommit(draft);
        setOpen(next);
      }}
      label={label}
      mobile="sheet"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          aria-label={`${label}: ${people.length ? people.map((s) => s.name).join(', ') : t('list.noStaff')}`}
          className="flex h-10 w-full min-w-0 items-center rounded-md border border-transparent px-2 transition-colors duration-150 hover:border-border-strong/50 hover:bg-surface"
        >
          {face}
        </button>
      )}
    >
      <div className="flex max-h-80 w-64 flex-col gap-1 overflow-y-auto p-2">
        {staffList.map((s) => (
          <Checkbox
            key={s.id}
            checked={draft.includes(s.id)}
            onCheckedChange={(on) => setDraft((d) => (on ? [...d, s.id] : d.filter((x) => x !== s.id)))}
            classNames={{ root: 'min-h-10 rounded-md px-2 hover:bg-surface-2' }}
            label={
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={s.name} src={s.avatarUrl} size="xs" colorIndex={s.colorIndex} />
                <span className="truncate">{s.name}</span>
              </span>
            }
          />
        ))}
      </div>
    </Popover>
  );
}
