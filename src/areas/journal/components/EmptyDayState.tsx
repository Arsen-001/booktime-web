"use client";

/** «Расписание не установлено» — пустой день без графиков (F-01-018). */
import { CalendarOff, Scissors, Users } from "lucide-react";
import { useT } from "@/i18n/useT";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/Button";

export interface EmptyDayStateProps {
  /** Есть ли у бизнеса хоть одна услуга (F-01-018 fix, qa/measure/journal/empty-d1.md #1). */
  hasServices?: boolean;
  /** Есть ли у бизнеса хоть один сотрудник. */
  hasStaff?: boolean;
}

/**
 * qa/measure/journal/empty-d1.md #1 (major, не исправлено): совсем пустому бизнесу (нет услуг,
 * нет сотрудников) звать «Настроить график» первым шагом неверно — настраивать нечей график.
 * Путь новичка по порядку: услуги → сотрудники → график. Когда график действительно единственное,
 * чего не хватает (сотрудники и услуги уже есть), возвращаем прежний текст.
 */
export function EmptyDayState({
  hasServices = true,
  hasStaff = true,
}: EmptyDayStateProps) {
  const t = useT("journal");

  if (!hasServices) {
    return (
      <div
        data-f="F-01-018"
        className="rounded-xl border border-dashed border-border bg-surface-2/50 py-8"
      >
        <EmptyState
          icon={<Scissors aria-hidden />}
          title={t("emptyDay.noServicesTitle")}
          description={t("emptyDay.noServicesHint")}
          action={
            <LinkButton href="/biz/services" variant="primary" size="sm">
              {t("emptyDay.addServices")}
            </LinkButton>
          }
        />
      </div>
    );
  }

  if (!hasStaff) {
    return (
      <div
        data-f="F-01-018"
        className="rounded-xl border border-dashed border-border bg-surface-2/50 py-8"
      >
        <EmptyState
          icon={<Users aria-hidden />}
          title={t("emptyDay.noStaffTitle")}
          description={t("emptyDay.noStaffHint")}
          action={
            <LinkButton href="/biz/staff" variant="primary" size="sm">
              {t("emptyDay.addStaff")}
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div
      data-f="F-01-018 F-02-029"
      className="rounded-xl border border-dashed border-border bg-surface-2/50 py-8"
    >
      <EmptyState
        icon={<CalendarOff aria-hidden />}
        title={t("emptyDay.title")}
        action={
          <>
            <LinkButton href="/biz/schedule" variant="primary" size="sm">
              {t("emptyDay.setupSchedule")}
            </LinkButton>
            <LinkButton href="/biz/staff" variant="outline" size="sm">
              {t("emptyDay.addStaffToday")}
            </LinkButton>
          </>
        }
      />
    </div>
  );
}
