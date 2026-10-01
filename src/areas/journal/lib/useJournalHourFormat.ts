"use client";

/**
 * F-01-221: формат часов (24 / 12), выбранный в «Настройках журнала» (`/biz/journal/settings`,
 * временный дом настройки — см. domain/journal.ts JournalSettings.hourFormat). Кэш react-query
 * общий с другими читателями `getJournalSettings`, поэтому обычно уже тёплый (без лишнего мигания
 * скелетоном) — пока не загрузился, по умолчанию действует '24' (⭐ рынок — Армения, F-00-002).
 */
import { getJournalSettings } from "@/api/journal";
import { useApiQuery } from "@/api/request";
import type { JournalHourFormat } from "@/domain/journal";
import { useCurrent } from "@/demo/hooks";

export function useJournalHourFormat(): JournalHourFormat {
  // Ждём сессию: в режиме api без неё запрос падал «No business in session» на первой загрузке журнала
  const { ready } = useCurrent();
  const query = useApiQuery(["journal", "settings-hour-format"], getJournalSettings, { enabled: ready });
  return query.data?.hourFormat ?? "24";
}
