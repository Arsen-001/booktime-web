"use client";

/**
 * «Что делает Анна?» — шаг сразу после добавления мастера (С12 обзора «Сотрудники», 27.09.2026). Раньше новый
 * мастер оставался пустым, но уже «в онлайн-записи». Здесь — галочки услуг по категориям (с «Выбрать всю
 * категорию») и график «как у салона / настроить сам». «Готово» назначает всё и включает онлайн-запись, когда
 * есть и услуги, и график.
 */
import { useState } from "react";
import { useLocale } from "next-intl";
import { listCategories, listServices } from "@/api/services";
import { applyStaffSetup, hasOpenHours, type StaffCardData } from "@/api/staff";
import { useCoreGet } from "@/api/core";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { pickText } from "@/lib/text";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { ChoiceGroup } from "@/ui/ChoiceGroup";
import { SectionCard } from "@/ui/SectionCard";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

export interface StaffSetupPanelProps {
  card: StaffCardData;
  onDone: () => void;
  onOpenSchedule: () => void;
}

export function StaffSetupPanel({ card, onDone, onOpenSchedule }: StaffSetupPanelProps) {
  const t = useT("staff");
  const toast = useToast();
  const locale = useLocale();
  const { staff } = card;
  const { staffId: myStaffId } = useCurrent();
  const me = useCoreGet("staff", myStaffId);
  // У нового салона часов работы ещё нет — «Как у салона» ставит стандартную неделю и прямо об этом говорит
  const locationQ = useCoreGet("locations", staff.locationIds[0]);
  const noSalonHours = locationQ.data !== undefined && !hasOpenHours(locationQ.data.openHours);
  const servicesQ = useApiQuery(["staff", "setup", "services", staff.businessId], () => listServices(staff.businessId));
  const categoriesQ = useApiQuery(["staff", "setup", "categories", staff.businessId], () => listCategories(staff.businessId));
  const [picked, setPicked] = useState<string[]>(staff.serviceIds);
  const [schedule, setSchedule] = useState<"salon" | "custom" | "keep">(card.scheduleUntil === null ? "salon" : "keep");
  const setup = useApiMutation(applyStaffSetup);

  const services = (servicesQ.data ?? []).filter((s) => s.kind === "individual" || s.kind === "group");
  const categories = (categoriesQ.data ?? [])
    .map((c) => ({ category: c, items: services.filter((s) => s.categoryId === c.id) }))
    .filter((g) => g.items.length > 0);

  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...new Set([...p, id])] : p.filter((x) => x !== id)));
  const toggleCategory = (ids: string[], on: boolean) =>
    setPicked((p) => (on ? [...new Set([...p, ...ids])] : p.filter((x) => !ids.includes(x))));

  const done = async () => {
    try {
      const res = await setup.mutate({
        staffId: staff.id,
        businessId: staff.businessId,
        serviceIds: picked.filter((id) => !staff.serviceIds.includes(id)),
        schedule: schedule === "salon" ? "salon" : "keep",
        actorName: me.data?.name ?? "",
      });
      toast.success(
        res.usedDefaultWeek
          ? t("setup.savedDefaultWeek")
          : res.onlineEnabled
            ? t("setup.saved")
            : t("setup.savedNoOnline"),
      );
      if (schedule === "custom") onOpenSchedule();
      onDone();
    } catch {
      toast.error(t("setup.failed"));
    }
  };

  return (
    <div data-f="F-10-027 F-10-030">
    <SectionCard title={t("setup.title", { name: staff.name.split(" ")[0] ?? staff.name })} description={t("setup.hint")}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-fg">{t("setup.services")}</p>
          {servicesQ.isLoading || categoriesQ.isLoading ? (
            <div data-skeleton className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rect" className="h-28 rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted">{t("setup.noCatalog")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map(({ category, items }) => {
                const ids = items.map((s) => s.id);
                const all = ids.every((id) => picked.includes(id));
                const some = !all && ids.some((id) => picked.includes(id));
                return (
                  <fieldset key={category.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                    <legend className="sr-only">{pickText(category.name, locale as "ru")}</legend>
                    <Checkbox
                      checked={all}
                      indeterminate={some}
                      onCheckedChange={(on) => toggleCategory(ids, on)}
                      label={<span className="font-semibold">{pickText(category.name, locale as "ru")}</span>}
                      description={t("setup.selectCategory")}
                    />
                    <div className="flex flex-col gap-1 pl-7">
                      {items.map((s) => (
                        <Checkbox key={s.id} checked={picked.includes(s.id)} onCheckedChange={(on) => toggle(s.id, on)} label={pickText(s.name, locale as "ru")} />
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fg">{t("setup.schedule")}</p>
          <ChoiceGroup
            value={schedule}
            onValueChange={(v) => setSchedule(v as typeof schedule)}
            aria-label={t("setup.schedule")}
            columns={2}
            options={[
              noSalonHours
                ? { value: "salon", title: t("setup.scheduleDefaultWeek"), description: t("setup.scheduleDefaultWeekHint") }
                : { value: "salon", title: t("setup.scheduleLikeSalon"), description: t("setup.scheduleLikeSalonHint") },
              { value: "custom", title: t("setup.scheduleCustom"), description: t("setup.scheduleCustomHint") },
              ...(card.scheduleUntil !== null ? [{ value: "keep", title: t("setup.scheduleKeep") }] : []),
            ]}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onDone}>
            {t("setup.later")}
          </Button>
          <Button loading={setup.isPending} onClick={() => void done()}>
            {t("setup.done")}
          </Button>
        </div>
      </div>
    </SectionCard>
    </div>
  );
}
