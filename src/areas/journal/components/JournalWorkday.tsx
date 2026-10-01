'use client';

/**
 * Рабочий день журнала — №8 и №12 (⭐ 01.10.2026), одним узлом в JournalScreen, чтобы экран журнала почти не менялся:
 *  · горячие клавиши (useJournalHotkeys) и их список по «?» (HotkeysHelp);
 *  · «Лента изменений за день» (DayFeedSheet) — из «⋯ Ещё»;
 *  · подсветка записей, которые только что изменил кто-то другой (ForeignChangeHighlight).
 * «⋯ Ещё» открывает шторки событиями окна (как «Подтвердить завтра»), без новых пропсов у шторки «Ещё».
 */
import { useEffect, useState } from 'react';
import { DayFeedSheet } from '@/areas/journal/components/DayFeedSheet';
import { ForeignChangeHighlight } from '@/areas/journal/components/ForeignChangeHighlight';
import { HotkeysHelp } from '@/areas/journal/components/HotkeysHelp';
import { useJournalHotkeys, type JournalHotkey } from '@/areas/journal/lib/hotkeys';
import type { Id, ISODate } from '@/domain/core';

/** «⋯ Ещё → Лента изменений» */
export const FEED_OPEN_EVENT = 'journal:feed-open';
/** «⋯ Ещё → Горячие клавиши» */
export const HOTKEYS_OPEN_EVENT = 'journal:hotkeys-open';

/** Кнопка «Найти окно» помечена data-hotkey — «F» нажимает её, как человек (поповер, шторка на телефоне — её дело) */
export const FIND_SLOT_HOTKEY_ATTR = 'find-slot';

export interface JournalWorkdayProps {
  ready: boolean;
  businessIds: Id[];
  date: ISODate;
  ownStaffId?: Id;
  /** Мастер без права видеть чужих — только свои записи (лента и подсветка) */
  onlyStaffId?: Id;
  /** Клавиши; нет обработчика — клавиша молчит (например, «N» без права создавать) */
  keys: Partial<Record<Exclude<JournalHotkey, 'help' | 'findSlot'>, () => void>>;
  onOpenBooking: (bookingId: Id) => void;
}

export function JournalWorkday({ ready, businessIds, date, ownStaffId, onlyStaffId, keys, onOpenBooking }: JournalWorkdayProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);

  useEffect(() => {
    const onFeed = () => setFeedOpen(true);
    const onHelp = () => setHelpOpen(true);
    window.addEventListener(FEED_OPEN_EVENT, onFeed);
    window.addEventListener(HOTKEYS_OPEN_EVENT, onHelp);
    return () => {
      window.removeEventListener(FEED_OPEN_EVENT, onFeed);
      window.removeEventListener(HOTKEYS_OPEN_EVENT, onHelp);
    };
  }, []);

  useJournalHotkeys(
    {
      ...keys,
      help: () => setHelpOpen(true),
      findSlot: () => {
        const button = document.querySelector<HTMLButtonElement>(`[data-hotkey="${FIND_SLOT_HOTKEY_ATTR}"]`);
        if (button && !button.disabled && button.offsetParent !== null) button.click();
      },
    },
    ready,
  );

  return (
    <>
      <HotkeysHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <DayFeedSheet
        open={feedOpen}
        onOpenChange={setFeedOpen}
        businessIds={businessIds}
        date={date}
        onlyStaffId={onlyStaffId}
        ownStaffId={ownStaffId}
        onOpenBooking={(id) => {
          setFeedOpen(false);
          onOpenBooking(id);
        }}
      />
      <ForeignChangeHighlight businessIds={businessIds} onlyStaffId={onlyStaffId} ownStaffId={ownStaffId} enabled={ready} />
    </>
  );
}
