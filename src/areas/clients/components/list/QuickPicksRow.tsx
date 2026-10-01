'use client';

/**
 * Быстрые подборки одним рядом чипов, листается вбок (ux-r1 №1, ux-r5 улучшение 1): «Пора записать (⭐ по интервалу услуги) · Новые · Повторные · Давно не были ·
 * Заканчивается абонемент · Часто не приходят» и «Из чата», когда включено сохранение собеседников (F-04-011…016, F-04-157).
 * Числа — по всей базе; пока грузится первый раз, чисел нет (не «0», который потом прыгает — ux-r1 №24).
 */
import { useApiMode } from '@/areas/clients/lib/useApiMode';
import type { QuickPickId } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { ScrollRow } from '@/ui/ScrollRow';

export interface QuickPicksRowProps {
  value: QuickPickId | null;
  onChange: (pick: QuickPickId | null) => void;
  counts: Record<QuickPickId, number> | undefined;
  /** Список ещё грузится — у чипов уже есть место под число */
  countsLoading?: boolean;
  showChatLeads: boolean;
}

export function QuickPicksRow({ value, onChange, counts, countsLoading, showChatLeads }: QuickPicksRowProps) {
  const t = useT('clients');
  const apiMode = useApiMode();
  // «Пора записать» сервер пока не умеет (нет pick 'due' и dueAt → 400 и весь список на экране ошибки,
  // code-review 30.09 №8) — на живом бэкенде чип прячем, пока сервер его не поддержит
  const picks: QuickPickId[] = [...(apiMode ? [] : (['due'] as QuickPickId[])), 'new', 'repeat', 'lost', 'subscriptionEnding', 'noShow'];
  const chip = (pick: QuickPickId) => (
    <Chip selected={value === pick} count={counts?.[pick]} countLoading={countsLoading} onClick={() => onChange(value === pick ? null : pick)}>
      {t(`segments.${pick}`)}
    </Chip>
  );
  return (
    <div data-f="F-04-011 F-04-012 F-04-013 F-04-014 F-04-015 F-04-157 F-00-191">
      <ScrollRow bleed aria-label={t('segments.title')}>
        {picks.map((pick) => (
          <span key={pick} className="shrink-0">
            {chip(pick)}
          </span>
        ))}
        {showChatLeads && (
          <span data-f="F-04-016 F-04-187" className="shrink-0">
            {chip('chatLeads')}
          </span>
        )}
      </ScrollRow>
    </div>
  );
}
