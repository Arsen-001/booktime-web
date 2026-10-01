"use client";

/**
 * Вклад раздела «journal» в хаб настроек /biz/settings (хост «settingsHub»): плитка «Цифровой журнал»
 * с переходом на свою страницу /biz/journal/settings (F-01-168). Посмотреть вклад без хозяина хоста:
 * /dev/ext/settingsHub/journal
 */
import { CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { SettingsHubExtProps } from "@/extensions/types";
import { useT } from "@/i18n/useT";

export default function JournalSettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT("journal");
  return (
    <div data-f="F-01-168">
      <Link
        href="/biz/journal/settings"
        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors hover:bg-surface-2/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <CalendarClock aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg">{t("settings.title")}</span>
          <span className="block text-sm text-muted">{t("settings.subtitle")}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </div>
  );
}
