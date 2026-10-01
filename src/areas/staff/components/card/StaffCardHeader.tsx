"use client";

/**
 * Шапка карточки (С16 обзора «Сотрудники», 27.09.2026): имя — заголовок страницы, рядом маленькое фото и ОДНА
 * строка «Мастер маникюра · Платно · мастер». Боковой плашки с тем же именем и фото больше нет — на телефоне
 * форма начинается сразу под шапкой. Пока карточка ещё грузится без данных строки — скелет той же высоты (М1).
 * Мастер без услуг или графика — плашка «Не принимает записи: нет услуг» с «Настроить» (С12).
 */
import { AlertTriangle } from "lucide-react";
import type { StaffCardData } from "@/api/staff";
import { SeatLabel } from "@/areas/staff/components/StaffCells";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { PageHeader } from "@/ui/PageHeader";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";

export function StaffCardHeader({ card, onSetup }: { card: StaffCardData | undefined; onSetup: () => void }) {
  const t = useT("staff");
  const fmt = useFormat();
  const back = { href: "/biz/staff", label: t("cardView.back") };
  if (!card)
    return (
      <PageHeader
        back={back}
        // Та же разметка, что с данными: фото и имя в заголовке, строка «должность · место» — полосами в своих элементах
        title={
          <span className="flex items-center gap-3" aria-busy>
            <Skeleton variant="circle" className="size-10 shrink-0" />
            <span className="min-w-0">
              <SkeletonText width="14ch" />
            </span>
          </span>
        }
        meta={
          <p className="flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
            <SkeletonText width="16ch" />
            <span aria-hidden>·</span>
            <SkeletonText width="12ch" />
          </p>
        }
      />
    );
  const { staff } = card;
  const position = staff.position?.ru || staff.specialty?.ru || t(`role.${staff.role}` as never);
  const needsServices = staff.role === "master" && !staff.assistantOnly && staff.serviceIds.length === 0;
  const needsSchedule = staff.role === "master" && !staff.assistantOnly && card.scheduleUntil === null;
  const dismissal = card.dismissal;
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        back={back}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="md" />
            <span className="min-w-0">{staff.name}</span>
          </span>
        }
        meta={
          <p data-f="F-10-024 F-02-022" className="flex min-h-5 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
            <span>{position}</span>
            <span aria-hidden>·</span>
            <SeatLabel seat={card.seat} />
            {staff.status === "invited" && <Badge tone="warning" size="sm">{t("status.invited")}</Badge>}
            {staff.status === "disabled" && <Badge tone="warning" size="sm">{t("status.disabled")}</Badge>}
            {staff.status === "fired" && (
              <Badge tone="danger" size="sm">
                {dismissal?.firedAt ? t("cardView.firedOn", { date: fmt.date(dismissal.firedAt, "short") }) : t("status.fired")}
              </Badge>
            )}
            {dismissal?.scheduled && staff.status !== "fired" && (
              <Badge tone="danger" size="sm">
                {t("cardView.leavingOn", { date: fmt.date(dismissal.date, "short") })}
              </Badge>
            )}
          </p>
        }
      />
      {(needsServices || needsSchedule) && staff.status !== "fired" && (
        <div data-f="F-10-027" role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3 text-sm">
          <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1 text-fg">
            <b className="font-semibold">{t("cardView.notBooking.title")}:</b>{" "}
            {needsServices && needsSchedule
              ? t("cardView.notBooking.both")
              : needsServices
                ? t("cardView.notBooking.noServices")
                : t("cardView.notBooking.noSchedule")}
          </span>
          <Button size="sm" variant="outline" onClick={onSetup}>
            {t("cardView.notBooking.action")}
          </Button>
        </div>
      )}
    </div>
  );
}
