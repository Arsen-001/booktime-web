"use client";

/**
 * Медицинские сферы (useSphere().has('medicalRecords'/'treatmentPlan'), F-00-145): «Текущий приём»
 * (F-01-189) — заключение по ЭТОМУ визиту; «Медкарта» (F-01-190) и «План лечения» (F-01-191) —
 * данные пациента, общие для всех его визитов. Поля адаптированы к Армении: вместо ОМС/СНИЛС
 * (российские документы) — местный полис и соц. номер (⭐ решение по умолчанию, У нас в ТЗ).
 * Печать — предпросмотр в модалке (системный print() запрещён, CONVENTIONS §0.3): распечатать
 * может сам браузер (Ctrl+P/Cmd+P) с открытым предпросмотром.
 */
import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Printer, Trash2 } from "lucide-react";
import type { Id } from "@/domain/core";
import type { MedicalCard, MedicalVisitNote, TreatmentPlan } from "@/domain/journal";
import {
  addTreatmentPlan,
  deleteTreatmentPlan,
  duplicateTreatmentPlan,
  getMedicalCard,
  getMedicalVisit,
  listTreatmentPlans,
  setMedicalCard,
  setMedicalVisit,
} from "@/api/journal";
import { coreList } from "@/api/core";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCan, useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { pickText } from "@/lib/text";
import { useLocale } from "next-intl";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { Textarea } from "@/ui/Textarea";

const MEDICAL_VISIT_FIELDS: Array<keyof Omit<MedicalVisitNote, "bookingId" | "authorName" | "updatedAt">> = [
  "complaints",
  "diseaseHistory",
  "lifeHistory",
  "chronicConditions",
  "epidemiological",
  "allergy",
  "examination",
  "procedures",
  "diagnosis",
  "prescriptions",
  "recommendations",
  "comment",
];

/** F-01-189: «Текущий приём» — заключение по визиту, во всплывающей шторке слева */
export function MedicalVisitCard({
  bookingId,
  clientName,
  authorName,
  onHide,
}: {
  bookingId: Id;
  clientName: string;
  authorName: string;
  onHide: () => void;
}) {
  const t = useT("journal");
  const tc = useT("common");
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const canView = useCan("journal.view");
  const canEdit = useCan("journal.edit");
  const query = useApiQuery(
    ["journal", "medical-visit", bookingId],
    () => getMedicalVisit(bookingId),
    {},
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [printOpen, setPrintOpen] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    if (query.data && !loaded.current) {
      const next: Record<string, string> = {};
      for (const key of MEDICAL_VISIT_FIELDS) next[key] = query.data[key] ?? "";
      setDraft(next);
      loaded.current = true;
    }
  }, [query.data]);
  const saveMutation = useApiMutation(() =>
    setMedicalVisit(
      bookingId,
      draft as Partial<MedicalVisitNote>,
      authorName,
    ),
  );

  if (!canView) return null;

  return (
    <div
      data-f="F-01-189 F-04-146 F-04-147"
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">
          {t("window.medical.visitTitle")}
        </h3>
        <div className="flex items-center gap-1">
          <IconButton
            icon={<Printer aria-hidden />}
            label={t("window.medical.print")}
            size="sm"
            variant="ghost"
            onClick={() => setPrintOpen(true)}
          />
          <Button type="button" variant="ghost" size="sm" onClick={onHide}>
            {t("window.medical.hide")}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Skeleton lines={4} />
      ) : (
        <div className="flex flex-col gap-3">
          {MEDICAL_VISIT_FIELDS.map((key) => (
            <FormField key={key} label={t(`window.medical.fields.${key}`)}>
              <Textarea
                value={draft[key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [key]: e.target.value }))
                }
                rows={2}
                disabled={!canEdit}
              />
            </FormField>
          ))}
          <Button
            type="button"
            onClick={() => saveMutation.mutate(undefined)}
            loading={saveMutation.isPending}
            disabled={!canEdit}
          >
            {tc("actions.save")}
          </Button>
          {query.data && (
            <p className="text-xs text-muted">
              {t("window.medical.updatedAt")}:{" "}
              {format.date(query.data.updatedAt.slice(0, 10), "short")}{" "}
              {format.time(query.data.updatedAt)} · {query.data.authorName}
            </p>
          )}
        </div>
      )}

      <Modal
        open={printOpen}
        onOpenChange={setPrintOpen}
        title={t("window.medical.printTitle")}
        size="lg"
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold text-fg">{clientName}</p>
          {MEDICAL_VISIT_FIELDS.map((key) =>
            draft[key] ? (
              <div key={key}>
                <p className="font-medium text-fg">
                  {t(`window.medical.fields.${key}`)}
                </p>
                <p className="whitespace-pre-wrap text-muted">{draft[key]}</p>
              </div>
            ) : null,
          )}
          <p className="text-xs text-muted">{t("window.medical.printHint")}</p>
        </div>
      </Modal>
    </div>
  );
}

const MEDICAL_CARD_FIELDS: Array<keyof Omit<MedicalCard, "clientId" | "filledAt" | "updatedAt">> = [
  "cardNumber",
  "address",
  "locality",
  "documentNo",
  "insurancePolicy",
  "socialNumber",
  "maritalStatus",
  "education",
  "employment",
  "workplace",
  "insuranceCompany",
  "disability",
  "bloodType",
  "allergies",
];

/** F-01-190: «Медкарта» — модалка, открывается плиткой в левой зоне */
export function MedicalCardModal({
  open,
  onOpenChange,
  clientId,
  clientName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: Id;
  clientName: string;
}) {
  const t = useT("journal");
  const canEdit = useCan("journal.edit");
  const query = useApiQuery(
    ["journal", "medical-card", clientId],
    () => getMedicalCard(clientId),
    { enabled: open },
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [printOpen, setPrintOpen] = useState(false);
  const loaded = useRef<Id | null>(null);
  useEffect(() => {
    if (open && query.data && loaded.current !== clientId) {
      const next: Record<string, string> = {};
      for (const key of MEDICAL_CARD_FIELDS) next[key] = query.data[key] ?? "";
      setDraft(next);
      loaded.current = clientId;
    }
  }, [open, query.data, clientId]);
  const saveMutation = useApiMutation(() =>
    setMedicalCard(clientId, draft as Partial<MedicalCard>),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("window.medical.cardTitle")}
      description={clientName}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => setPrintOpen(true)}>
            {t("window.medical.print")}
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate(undefined)}
            loading={saveMutation.isPending}
            disabled={!canEdit}
          >
            {t("window.medical.saveCard")}
          </Button>
        </>
      }
    >
      {query.isLoading ? (
        <Skeleton lines={6} />
      ) : (
        <div data-f="F-01-190 F-04-148" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MEDICAL_CARD_FIELDS.map((key) => (
            <FormField key={key} label={t(`window.medical.cardFields.${key}`)}>
              <Input
                value={draft[key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [key]: e.target.value }))
                }
                disabled={!canEdit}
              />
            </FormField>
          ))}
        </div>
      )}
      <Modal
        open={printOpen}
        onOpenChange={setPrintOpen}
        title={t("window.medical.printTitle")}
        size="md"
      >
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-fg">{clientName}</p>
          {MEDICAL_CARD_FIELDS.map((key) =>
            draft[key] ? (
              <p key={key} className="text-muted">
                <span className="font-medium text-fg">
                  {t(`window.medical.cardFields.${key}`)}:
                </span>{" "}
                {draft[key]}
              </p>
            ) : null,
          )}
          <p className="text-xs text-muted">{t("window.medical.printHint")}</p>
        </div>
      </Modal>
    </Modal>
  );
}

/** F-01-191: «План лечения» — список планов клиента, минимальная цена подтягивается из услуги заново */
export function TreatmentPlanModal({
  open,
  onOpenChange,
  clientId,
  clientName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: Id;
  clientName: string;
}) {
  const t = useT("journal");
  const tc = useT("common");
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const locale = useLocale();
  const { businessId } = useCurrent();
  const canEdit = useCan("journal.edit");
  const plansQuery = useApiQuery(
    ["journal", "treatment-plans", clientId],
    () => listTreatmentPlans(clientId),
    { enabled: open },
  );
  const servicesQuery = useApiQuery(
    ["core", "services", businessId],
    () => coreList("services", { businessId: businessId! }),
    { enabled: open && Boolean(businessId) },
  );
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [serviceIds, setServiceIds] = useState<Id[]>([]);
  const [pendingDelete, setPendingDelete] = useState<TreatmentPlan | null>(null);
  const addMutation = useApiMutation(() =>
    addTreatmentPlan(clientId, title.trim(), serviceIds),
  );
  const dupMutation = useApiMutation((planId: Id) =>
    duplicateTreatmentPlan(clientId, planId),
  );
  const delMutation = useApiMutation((planId: Id) =>
    deleteTreatmentPlan(clientId, planId),
  );
  const [printPlan, setPrintPlan] = useState<TreatmentPlan | null>(null);
  const services = servicesQuery.data ?? [];
  const serviceName = (id: Id) =>
    pickText(services.find((s) => s.id === id)?.name, locale) ?? "";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("window.medical.planTitle")}
      description={clientName}
      size="lg"
    >
      <div data-f="F-01-191 F-04-149 F-00-150" className="flex flex-col gap-4">
        {plansQuery.isLoading ? (
          <Skeleton lines={4} />
        ) : (plansQuery.data ?? []).length === 0 && !creating ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted">
            <p>{t("window.medical.planEmpty")}</p>
          </div>
        ) : (
          (plansQuery.data ?? []).map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-fg">{plan.title}</p>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={<Printer aria-hidden />}
                    label={t("window.medical.print")}
                    size="sm"
                    variant="ghost"
                    onClick={() => setPrintPlan(plan)}
                  />
                  <IconButton
                    icon={<Copy aria-hidden />}
                    label={tc("actions.copy")}
                    size="sm"
                    variant="ghost"
                    disabled={!canEdit}
                    onClick={() => dupMutation.mutate(plan.id)}
                  />
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    label={tc("actions.delete")}
                    size="sm"
                    variant="ghost"
                    disabled={!canEdit}
                    onClick={() => setPendingDelete(plan)}
                  />
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {plan.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <span>{serviceName(item.serviceId)}</span>
                    <span>{format.money(item.priceMin)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        {creating ? (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border-strong p-3">
            <FormField label={t("window.medical.planName")}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField label={t("window.medical.planServices")}>
              <Select
                value=""
                onValueChange={(v) =>
                  setServiceIds((ids) => (ids.includes(v) ? ids : [...ids, v]))
                }
                options={services.map((s) => ({
                  value: s.id,
                  label: `${pickText(s.name, locale)} · ${format.money(s.priceMin)}`,
                }))}
                placeholder={t("window.medical.planServicesPlaceholder")}
              />
            </FormField>
            {serviceIds.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {serviceIds.map((id) => (
                  <li key={id} className="flex items-center justify-between">
                    {serviceName(id)}
                    <IconButton
                      icon={<Trash2 aria-hidden />}
                      label={tc("actions.delete")}
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setServiceIds((ids) => ids.filter((s) => s !== id))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setTitle("");
                  setServiceIds([]);
                }}
              >
                {tc("actions.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!title.trim() || serviceIds.length === 0}
                loading={addMutation.isPending}
                onClick={() =>
                  addMutation.mutate(undefined).then(() => {
                    setCreating(false);
                    setTitle("");
                    setServiceIds([]);
                  })
                }
              >
                {tc("actions.create")}
              </Button>
            </div>
          </div>
        ) : (
          canEdit && (
            <Button
              type="button"
              variant="outline"
              leftIcon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              {t("window.medical.planAdd")}
            </Button>
          )
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={t("window.medical.planDeleteTitle")}
        description={t("window.medical.planDeleteText")}
        confirmLabel={tc("actions.delete")}
        tone="danger"
        onConfirm={() => {
          if (pendingDelete) delMutation.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />

      <Modal
        open={Boolean(printPlan)}
        onOpenChange={(v) => !v && setPrintPlan(null)}
        title={t("window.medical.printTitle")}
        size="md"
      >
        {printPlan && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-fg">{clientName}</p>
            <p className="text-muted">{printPlan.title}</p>
            <ul className="flex flex-col gap-1">
              {printPlan.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{serviceName(item.serviceId)}</span>
                  <span>{format.money(item.priceMin)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{t("window.medical.printHint")}</p>
          </div>
        )}
      </Modal>
    </Modal>
  );
}
