"use client";

/**
 * Форма «Повторение записи» (F-01-100…107): открывается плиткой в окне сохранённой записи и
 * создаёт серию будущих копий по образцу. У несохранённой записи плитка недоступна (F-01-100).
 */
import { useState } from "react";
import { Minus, Plus, Repeat, X } from "lucide-react";
import type { Booking } from "@/domain/core";
import type { RecurrenceFrequency, RecurrenceRule } from "@/domain/journal";
import {
  createRecurrenceSeries,
  deleteSeries,
  getRecurrenceTemplates,
  listSeriesBookings,
  saveRecurrenceTemplate,
} from "@/api/journal";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useTDynamic } from "@/i18n/useTDynamic";
import { weekdayIndex } from "@/lib/date";
import { DatePicker } from "@/ui/DatePicker";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { RadioGroup } from "@/ui/Radio";
import { Select } from "@/ui/Select";
import { TimePicker } from "@/ui/TimePicker";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { useConfirm, useToast } from "@/ui/Toast";
import { runBusy } from "@/areas/journal/lib/tasks";

const FREQUENCIES: RecurrenceFrequency[] = [
  "daily",
  "weekdays",
  "mon_wed_fri",
  "tue_thu",
  "weekly",
  "monthly",
  "yearly",
];
const WEEKDAY_LABELS_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export interface RecurrenceFormProps {
  booking: Booking;
  onHide: () => void;
  authorName: string;
}

export function RecurrenceForm({
  booking,
  onHide,
  authorName,
}: RecurrenceFormProps) {
  const t = useT("journal");
  const tDyn = useTDynamic();
  const tc = useT("common");
  const toast = useToast();
  const confirm = useConfirm();

  const templatesQuery = useApiQuery(
    ["journal", "recurrence-templates"],
    getRecurrenceTemplates,
    {},
  );
  const seriesQuery = useApiQuery(
    ["journal", "series", booking.seriesId],
    () => listSeriesBookings(booking.seriesId!),
    { enabled: Boolean(booking.seriesId) },
  );

  const [templateId, setTemplateId] = useState("new");
  const [templateName, setTemplateName] = useState("");
  const [rule, setRule] = useState<RecurrenceRule>({
    frequency: "weekly",
    everyN: 1,
    weekdays: [weekdayIndex(booking.start.slice(0, 10))],
    time: booking.start.slice(11, 16) as RecurrenceRule["time"],
    // F-01-103: дата начала = дата СЛЕДУЮЩЕГО повтора, не дата исходной записи — иначе первый же
    // сгенерированный экземпляр дублирует уже существующую запись в тот же день и час.
    startDate: booking.start.slice(0, 10),
    endMode: "count",
    count: 4,
    withClient: true,
  });

  const createMutation = useApiMutation(() =>
    createRecurrenceSeries(booking, rule),
  );
  const saveTemplateMutation = useApiMutation(() =>
    saveRecurrenceTemplate(templateName, rule),
  );
  const [creating, setCreating] = useState(false);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "new") return;
    const tpl = templatesQuery.data?.find((x) => x.id === id);
    if (tpl) setRule(tpl.rule);
  };

  const toggleWeekday = (i: number) => {
    setRule((r) => ({
      ...r,
      weekdays: r.weekdays.includes(i)
        ? r.weekdays.filter((x) => x !== i)
        : [...r.weekdays, i].sort(),
    }));
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      await saveTemplateMutation.mutate(undefined);
      templatesQuery.refetch();
      toast.success(tc("states.saved"));
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  const handleCreate = async () => {
    // try…finally — в runBusy (src/areas/journal/lib/tasks.ts): в теле компонента React Compiler его не компилирует
    await runBusy(
      setCreating,
      async () => {
        const { created, skipped } = await createMutation.mutate(undefined);
        toast.success(
          t("window.repeat.createdToast", { count: created.length }),
          skipped > 0
            ? { description: t("window.repeat.skippedNote", { count: skipped }) }
            : undefined,
        );
        onHide();
      },
      () => toast.error(tc("states.actionFailed")),
    );
  };

  const handleDeleteSeries = async () => {
    if (!booking.seriesId) return;
    const ok = await confirm({
      title: t("window.repeat.deleteSeriesConfirm"),
      tone: "danger",
      confirmLabel: tc("actions.delete"),
    });
    if (!ok) return;
    try {
      const count = await deleteSeries(booking.seriesId, authorName);
      toast.success(t("window.repeat.seriesDeleted", { count }));
      seriesQuery.refetch();
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  const showEveryN = rule.frequency === "daily" || rule.frequency === "weekly";
  const showWeekdayPicker = rule.frequency === "weekly";

  return (
    <div
      data-f="F-01-100 F-01-101 F-01-102 F-01-103 F-01-104 F-01-105 F-01-106"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 p-4"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Repeat aria-hidden className="size-4" />
          {t("window.repeat.title")}
        </p>
        <IconButton
          icon={<X aria-hidden />}
          label={tc("actions.close")}
          size="sm"
          variant="ghost"
          onClick={onHide}
        />
      </div>

      {booking.seriesId && (
        <div
          data-f="F-01-107"
          className="flex items-center justify-between gap-2 rounded-lg bg-surface-3 px-3 py-2 text-sm"
        >
          <span className="text-muted">
            {t("window.repeat.partOfSeries", {
              count: (seriesQuery.data?.length ?? 0) + 1,
            })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDeleteSeries}
          >
            {t("window.repeat.deleteSeries")}
          </Button>
        </div>
      )}

      <FormField label={t("window.repeat.template")}>
        <Select
          value={templateId}
          onValueChange={applyTemplate}
          options={[
            { value: "new", label: t("window.repeat.newTemplate") },
            ...(templatesQuery.data ?? []).map((tpl) => ({
              value: tpl.id,
              label: tpl.name,
            })),
          ]}
        />
      </FormField>
      <div className="flex items-end gap-2">
        <FormField label={t("window.repeat.templateName")} className="flex-1">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t("window.repeat.templateNamePlaceholder")}
          />
        </FormField>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={saveTemplateMutation.isPending}
          disabled={!templateName.trim()}
          onClick={handleSaveTemplate}
        >
          {t("window.repeat.saveTemplate")}
        </Button>
      </div>

      <FormField label={t("window.repeat.frequency")}>
        <Select
          value={rule.frequency}
          onValueChange={(v) =>
            setRule((r) => ({ ...r, frequency: v as RecurrenceFrequency }))
          }
          options={FREQUENCIES.map((f) => ({
            value: f,
            label: tDyn(`journal.window.repeat.freq.${f}`),
          }))}
        />
      </FormField>

      {showEveryN && (
        <FormField
          label={
            rule.frequency === "daily"
              ? t("window.repeat.everyDays")
              : t("window.repeat.everyWeeks")
          }
        >
          <div className="flex items-center gap-2">
            <IconButton
              icon={<Minus aria-hidden />}
              label={t("window.repeat.decrease")}
              size="sm"
              variant="outline"
              disabled={rule.everyN <= 1}
              onClick={() =>
                setRule((r) => ({ ...r, everyN: Math.max(1, r.everyN - 1) }))
              }
            />
            <span className="w-8 text-center font-medium">{rule.everyN}</span>
            <IconButton
              icon={<Plus aria-hidden />}
              label={t("window.repeat.increase")}
              size="sm"
              variant="outline"
              onClick={() => setRule((r) => ({ ...r, everyN: r.everyN + 1 }))}
            />
          </div>
        </FormField>
      )}

      {showWeekdayPicker && (
        <FormField label={t("window.repeat.weekdays")}>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS_KEYS.map((key, i) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleWeekday(i)}
                className={`flex size-10 items-center justify-center rounded-full border text-xs font-medium ${
                  rule.weekdays.includes(i)
                    ? "border-primary bg-primary-soft text-primary-text"
                    : "border-border text-muted"
                }`}
              >
                {tDyn(`journal.window.repeat.weekdayShort.${key}`)}
              </button>
            ))}
          </div>
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("window.repeat.time")}>
          <TimePicker
            value={rule.time}
            onValueChange={(v) => setRule((r) => ({ ...r, time: v }))}
            step={5}
          />
        </FormField>
        <FormField
          label={t("window.repeat.startDate")}
          hint={t("window.repeat.startDateHint")}
        >
          <DatePicker
            value={rule.startDate}
            onValueChange={(d) => d && setRule((r) => ({ ...r, startDate: d }))}
          />
        </FormField>
      </div>

      <FormField label={t("window.repeat.end")}>
        <RadioGroup
          value={rule.endMode}
          onValueChange={(v) =>
            setRule((r) => ({ ...r, endMode: v as "count" | "date" }))
          }
          options={[
            { value: "count", label: t("window.repeat.endCount") },
            { value: "date", label: t("window.repeat.endDate") },
          ]}
        />
      </FormField>
      {rule.endMode === "count" ? (
        <div className="flex items-center gap-2">
          <IconButton
            icon={<Minus aria-hidden />}
            label={t("window.repeat.decrease")}
            size="sm"
            variant="outline"
            disabled={rule.count <= 1}
            onClick={() =>
              setRule((r) => ({ ...r, count: Math.max(1, r.count - 1) }))
            }
          />
          <span className="w-8 text-center font-medium">{rule.count}</span>
          <IconButton
            icon={<Plus aria-hidden />}
            label={t("window.repeat.increase")}
            size="sm"
            variant="outline"
            onClick={() => setRule((r) => ({ ...r, count: r.count + 1 }))}
          />
        </div>
      ) : (
        <DatePicker
          value={rule.endDate}
          onValueChange={(d) =>
            setRule((r) => ({ ...r, endDate: d ?? undefined }))
          }
        />
      )}

      <Checkbox
        checked={!rule.withClient}
        onCheckedChange={(v) => setRule((r) => ({ ...r, withClient: !v }))}
        label={t("window.repeat.withoutClient")}
        description={t("window.repeat.withoutClientHint")}
      />

      <Button
        type="button"
        leftIcon={<Repeat aria-hidden />}
        loading={creating}
        onClick={handleCreate}
      >
        {t("window.repeat.submit")}
      </Button>
    </div>
  );
}
