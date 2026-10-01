'use client';

/**
 * «⋯ Ещё» журнала (DESIGN.md → Journal A2: «лишние фильтры — под „⋯“»). Всё, что раньше стояло рядами над сеткой и в
 * левой панели, собрано здесь — ни одна функция не пропала, экран не загромождён:
 *  · действия: сводка дня (F-01-011), «Продать» (F-01-010), добавить сотрудника (F-01-016), пакет услуг, масштаб на
 *    телефоне (F-16-024), клиенты и чат (F-01-017);
 *  · вид сетки: статусы, шаг, перерыв, деление по ресурсам (F-01-014, F-01-015, F-01-133, F-01-132);
 *  · закрепить журнал (F-01-005), закреплённые разделы и быстрые действия левой панели (F-01-002, F-01-150…156),
 *    кто вошёл и «Администрирование» (F-01-008, F-01-001);
 *  · «Загрузка недели» (⭐ 29.09.2026) — тепловая карта «мастер × день» для тех, кто видит чужие записи.
 */
import { useState, type ReactNode } from 'react';
import { ClipboardX, Columns3, Flame, History, Keyboard, Layers, Lock, MessageCircle, MessagesSquare, MonitorSmartphone, Star, Sun, UserPlus } from 'lucide-react';
import { FEED_OPEN_EVENT, HOTKEYS_OPEN_EVENT } from '@/areas/journal/components/JournalWorkday';
import { useNavigate } from '@/ui/navigation/useNavigate';
import { CONFIRM_TOMORROW_EVENT } from '@/areas/journal/components/ConfirmTomorrowSheet';
import { openWorkdaySheet } from '@/areas/journal/components/workday/events';
import type { Id, ISODate } from '@/domain/core';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { DaySummaryButton } from '@/areas/journal/components/DaySummaryButton';
import { JournalGridSettings, type JournalGridSettingsProps } from '@/areas/journal/components/JournalToolbar';
import { JournalSidebar } from '@/areas/journal/components/JournalSidebar';
import { SellMenu } from '@/areas/journal/components/SellMenu';
import { WeekLoadSheet } from '@/areas/journal/components/WeekLoadSheet';
import { Sheet } from '@/ui/Sheet';

export interface JournalMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: ISODate;
  onDateChange: (date: ISODate) => void;
  businessId?: Id;
  locationId: Id;
  staffIds: Id[];
  showStatistics: boolean;
  canAddStaff: boolean;
  onAddStaff: () => void;
  canPackage: boolean;
  onNewPackage: () => void;
  onOpenScale?: () => void;
  onOpenClients: () => void;
  isFavorite: boolean;
  onToggleFavorite?: () => void;
  showWaitlist: boolean;
  onOpenWaitlist: () => void;
  grid: JournalGridSettingsProps;
  /** Телефон: вид журнала и «Все мастера» — в шапке телефона им нет места */
  top?: ReactNode;
  /** «Загрузка недели»: клик по клетке — день в журнале; staffId — оставить в сетке только этого мастера */
  onOpenStaffDay?: (date: ISODate, staffId?: Id) => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ icon, children, onClick, active, ...rest }: { icon: ReactNode; children: ReactNode; onClick: () => void; active?: boolean; 'data-f'?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted',
        active && '[&_svg]:fill-current [&_svg]:text-warning',
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function JournalMoreSheet({
  open,
  onOpenChange,
  date,
  onDateChange,
  businessId,
  locationId,
  staffIds,
  showStatistics,
  canAddStaff,
  onAddStaff,
  canPackage,
  onNewPackage,
  onOpenScale,
  onOpenClients,
  isFavorite,
  onToggleFavorite,
  showWaitlist,
  onOpenWaitlist,
  grid,
  top,
  onOpenStaffDay,
}: JournalMoreSheetProps) {
  const t = useT('journal');
  // «Загрузка недели» — только тем, кто видит записи других мастеров (владелец, администратор)
  const canSeeOthers = useCan('journal.others');
  // Сводка и итоги дня — с правом «сводка дня» (сервер проверяет то же)
  const canDayStats = useCan('journal.stats') && showStatistics;
  const [weekLoadOpen, setWeekLoadOpen] = useState(false);
  const nav = useNavigate();
  const closeThen = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title={t('board.moreSheet.title')} side="auto" size="md">
        <div className="flex flex-col gap-7 pb-4">
          {top}
          <Section title={t('board.moreSheet.actions')}>
            <div data-f="F-01-010 F-01-011 F-01-016" className="flex flex-wrap gap-2">
              {businessId && showStatistics && <DaySummaryButton businessId={businessId} date={date} />}
              <SellMenu />
            </div>
            <div className="flex flex-col">
              {canAddStaff && (
                <Row icon={<UserPlus aria-hidden />} onClick={closeThen(onAddStaff)}>
                  {t('header.addStaff.button')}
                </Row>
              )}
              {canPackage && (
                <Row icon={<Layers aria-hidden />} onClick={closeThen(onNewPackage)}>
                  {t('header.newPackage')}
                </Row>
              )}
              {onOpenScale && (
                <Row data-f="F-16-024" icon={<Columns3 aria-hidden />} onClick={closeThen(onOpenScale)}>
                  {t('scale.button')}
                </Row>
              )}
              <Row data-f="F-01-017" icon={<MessagesSquare aria-hidden />} onClick={closeThen(onOpenClients)}>
                {t('board.moreSheet.clients')}
              </Row>
              <Row data-f="F-00-121" icon={<MessageCircle aria-hidden />} onClick={closeThen(() => window.dispatchEvent(new Event(CONFIRM_TOMORROW_EVENT)))}>
                {t('board.confirmTomorrow.title')}
              </Row>
              {/* ⭐ Рабочий день (01.10.2026): сводка утром, незакрытые визиты, итоги и закрытие дня */}
              {canDayStats && (
                <Row icon={<Sun aria-hidden />} onClick={closeThen(() => openWorkdaySheet('morning', date))}>
                  {t('workday.morning.menu')}
                </Row>
              )}
              <Row icon={<ClipboardX aria-hidden />} onClick={closeThen(() => openWorkdaySheet('unclosed'))}>
                {t('workday.unclosed.menu')}
              </Row>
              {canDayStats && (
                <Row icon={<Lock aria-hidden />} onClick={closeThen(() => openWorkdaySheet('dayClose', date))}>
                  {t('workday.dayClose.menu')}
                </Row>
              )}
              {canSeeOthers && staffIds.length > 0 && (
                <Row icon={<Flame aria-hidden />} onClick={closeThen(() => setWeekLoadOpen(true))}>
                  {t('weekLoad.open')}
                </Row>
              )}
              {/* ⭐ Рабочий день №10 и №12: стойка администратора (планшет) и лента изменений за день */}
              <Row icon={<MonitorSmartphone aria-hidden />} onClick={closeThen(() => nav.go('/biz/journal/desk'))}>
                {t('desk.open')}
              </Row>
              <Row icon={<History aria-hidden />} onClick={closeThen(() => window.dispatchEvent(new Event(FEED_OPEN_EVENT)))}>
                {t('feed.open')}
              </Row>
              {/* Горячие клавиши — для компьютера; на телефоне клавиатуры нет */}
              <span className="contents max-md:hidden">
                <Row icon={<Keyboard aria-hidden />} onClick={closeThen(() => window.dispatchEvent(new Event(HOTKEYS_OPEN_EVENT)))}>
                  {t('hotkeys.open')}
                </Row>
              </span>
            </div>
          </Section>

          <Section title={t('board.moreSheet.grid')}>
            <JournalGridSettings {...grid} />
          </Section>

          <Section title={t('board.moreSheet.pinned')}>
            {onToggleFavorite && (
              <Row data-f="F-01-005" icon={<Star aria-hidden />} active={isFavorite} onClick={onToggleFavorite}>
                {isFavorite ? t('board.moreSheet.unpinJournal') : t('board.moreSheet.pinJournal')}
              </Row>
            )}
            <div className="-mx-3 -mt-3">
              <JournalSidebar
                inSheet
                hideCalendar
                showFooter
                collapsed={false}
                onToggleCollapsed={() => {}}
                date={date}
                onDateChange={onDateChange}
                staffIds={staffIds}
                showWaitlist={showWaitlist}
                onOpenWaitlist={closeThen(onOpenWaitlist)}
                businessId={businessId}
                locationId={locationId}
              />
            </div>
          </Section>
        </div>
      </Sheet>
      <WeekLoadSheet
        open={weekLoadOpen}
        onOpenChange={setWeekLoadOpen}
        from={date}
        staffIds={staffIds}
        onPick={(d, staffId) => (onOpenStaffDay ? onOpenStaffDay(d, staffId) : onDateChange(d))}
      />
    </>
  );
}
