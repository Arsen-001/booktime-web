"use client";

/**
 * Карточка сотрудника → «Информация» (F-10-025, F-10-026, F-10-039, F-10-048, F-10-051; обзор 27.09.2026).
 * Блок сам держит черновик и сам себя сохраняет по общей кнопке «Сохранить» карточки (С2, cardForm).
 *  - Фото — 96 px с «Заменить» (С16: раньше крупные 320 px дублировали фото шапки).
 *  - Телефон подписан «для записи, уведомлений и входа» — тот же номер на «Доступе» только читается (С14).
 *  - «О себе» на трёх языках (С18).
 *  - «В салоне «…»» — только когда название уже известно (М3: не «В салоне «»»).
 * Внизу — свёрнутые «Дополнительно» и «Юр. информация» (С15): их данные грузятся, когда блок раскрыли (М1).
 */
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { ChevronDown, ImagePlus, LoaderCircle } from "lucide-react";
import {
  StaffValidationError,
  addPosition,
  listPositions,
  setHomeAcceptance,
  updateStaffInfo,
  updateStaffPhoto,
} from "@/api/staff";
import { optimistic, useApiMutation, useApiQuery } from "@/api/request";
import { IMAGE_ACCEPT, SERVER_UPLOAD_MAX_MB } from "@/api/uploads";
import { useCardSection } from "@/areas/staff/components/card/cardForm";
import { StaffExtraSection } from "@/areas/staff/components/card/StaffSettingsTab";
import { StaffLegalSection } from "@/areas/staff/components/card/StaffLegalTab";
import type { StaffCardData } from "@/api/staff";
import type { Staff } from "@/domain/core";
import { staffToInfoDraft, type StaffInfoDraft } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { Combobox, type ComboboxOption } from "@/ui/Combobox";
import { DatePicker } from "@/ui/DatePicker";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PhoneInput } from "@/ui/PhoneInput";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { uploadErrorKey, useImageUploader } from "@/ui/useImageUploader";
import { Textarea } from "@/ui/Textarea";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

export interface StaffInfoTabProps {
  staff: Staff;
  businessName: string;
  canEdit: boolean;
  showExtra: boolean;
  showLegal: boolean;
}

export function StaffInfoTab({ staff, businessName, canEdit, showExtra, showLegal }: StaffInfoTabProps) {
  const t = useT("staff");
  return (
    <div className="flex flex-col gap-5">
      <InfoSection staff={staff} businessName={businessName} canEdit={canEdit} />
      {showExtra && (
        <FoldBlock title={t("cardView.extraSection")} hint={t("cardView.extraSectionHint")}>
          <StaffExtraSection staff={staff} />
        </FoldBlock>
      )}
      {showLegal && (
        <FoldBlock title={t("cardView.legalSection")} hint={t("cardView.legalSectionHint")}>
          <StaffLegalSection staffId={staff.id} businessId={staff.businessId} />
        </FoldBlock>
      )}
    </div>
  );
}

/**
 * «Информация» до загрузки карточки — та же разметка (М2): плашка места работы, «Принимает на дому» (как у мастера
 * салона), фото 96 px с кнопкой, те же поля с подписями (неактивные, пустые), «О себе», дата, свёрнутые блоки.
 * Пришла карточка — поля заполнились, ничего не сдвинулось.
 */
export function StaffInfoTabSkeleton({ canEdit, showExtra, showLegal }: { canEdit: boolean; showExtra: boolean; showLegal: boolean }) {
  const t = useT("staff");
  const noop = () => {};
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="flex flex-col gap-5">
        <div className="flex min-h-6 flex-wrap items-center gap-2">
          <Badge tone="neutral" variant="soft">
            <SkeletonText width="23.5ch" />
          </Badge>
        </div>
        <Checkbox checked={false} disabled label={t("infoTab.homeAccept")} description={t("infoTab.homeAcceptHint")} />
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="size-24 shrink-0" />
          {canEdit && (
            <span className="flex flex-wrap gap-2">
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-muted">
                <ImagePlus aria-hidden className="size-4" />
                {t("infoTab.photoReplace")}
              </span>
            </span>
          )}
        </div>
        <FormField label={t("infoTab.name")} required hint={t("infoTab.nameHint")}>
          <Input value="" disabled onChange={noop} />
        </FormField>
        <p className="-mt-3 text-xs text-muted">{t("infoTab.replaceHint")}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("infoTab.position")} hint={t("infoTab.positionHint")}>
            <Input value="" disabled onChange={noop} />
          </FormField>
          <FormField label={t("infoTab.specialty")} hint={t("infoTab.specialtyHint")}>
            <Input value="" disabled onChange={noop} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("infoTab.phone")}>
            <PhoneInput value="" disabled onValueChange={noop} />
          </FormField>
          <FormField label={t("infoTab.email")} optional>
            <Input value="" disabled onChange={noop} />
          </FormField>
        </div>
        <BioField value={{ ru: "", hy: "", en: "" }} disabled onChange={noop} />
        <FormField label={t("infoTab.hiredAt")} className="max-w-56">
          <DatePicker value={undefined} disabled onValueChange={noop} />
        </FormField>
      </div>
      {showExtra && <FoldBlock title={t("cardView.extraSection")} hint={t("cardView.extraSectionHint")}>{null}</FoldBlock>}
      {showLegal && <FoldBlock title={t("cardView.legalSection")} hint={t("cardView.legalSectionHint")}>{null}</FoldBlock>}
    </div>
  );
}

/**
 * Свёрнутый блок: раскрыли один раз — содержимое смонтировано и дальше (черновик не теряется, данные не
 * перечитываются), свернули — просто скрыто. Появление — одна CSS-анимация прозрачности.
 */
function FoldBlock({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const id = useId();
  return (
    <section className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setMounted(true);
          setOpen((v) => !v);
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-fg">{title}</span>
          <span className="text-sm text-muted">{hint}</span>
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open && "rotate-180")} />
      </button>
      {mounted && (
        <div id={id} hidden={!open} className="animate-fade-in border-t border-border p-4">
          {children}
        </div>
      )}
    </section>
  );
}

type InfoDraft = StaffInfoDraft & { avatarUrl: string | undefined };

const draftOf = (s: Staff): InfoDraft => ({ ...staffToInfoDraft(s), avatarUrl: s.avatarUrl });
const keyOf = (d: InfoDraft) => JSON.stringify(d);

/** Правка карточки сразу видна в шапке и в списке — кэш правится до ответа, ответ сверяет (М6) */
const infoOptimistic = [
  optimistic<StaffCardData, InfoDraft & { staffId: string }>(
    (a) => ["staff", "card", a.staffId],
    (old, a) => ({
      ...old,
      staff: {
        ...old.staff,
        name: a.name.trim(),
        phone: a.phone,
        email: a.email.trim() || undefined,
        specialty: a.specialty.trim() ? { ...old.staff.specialty, ru: a.specialty.trim() } : undefined,
        position: a.position.trim() ? { ...old.staff.position, ru: a.position.trim() } : undefined,
        avatarUrl: a.avatarUrl,
      },
      positionLabel: a.position.trim(),
    }),
  ),
];

function InfoSection({ staff, businessName, canEdit }: { staff: Staff; businessName: string; canEdit: boolean }) {
  const t = useT("staff");
  const toast = useToast();
  const formId = useId();
  const base = draftOf(staff);
  const baseKey = keyOf(base);
  const [draft, setDraft] = useState<InfoDraft>(base);
  const [seenKey, setSeenKey] = useState(baseKey);
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "email", string>>>({});
  // Данные сотрудника поменялись снаружи (сохранили, другой человек) — черновик без правок идёт за ними
  if (baseKey !== seenKey) {
    setSeenKey(baseKey);
    if (keyOf(draft) === seenKey) setDraft(base);
  }
  const dirty = keyOf(draft) !== baseKey;
  const patch = (p: Partial<InfoDraft>) => setDraft((d) => ({ ...d, ...p }));

  const positionsQ = useApiQuery(["staff", "positions", staff.businessId], () => listPositions(staff.businessId));
  const createPosition = useApiMutation((name: string) => addPosition(staff.businessId, name));
  const homeAccept = useApiMutation((enabled: boolean) => setHomeAcceptance(staff.id, enabled));
  const infoM = useApiMutation(
    (a: InfoDraft & { staffId: string }) =>
      updateStaffInfo({
        staffId: a.staffId,
        name: a.name,
        specialty: a.specialty,
        position: a.position,
        phone: a.phone,
        email: a.email,
        bio: a.bio,
        hiredAt: a.hiredAt,
      }),
    { optimistic: infoOptimistic },
  );
  const photoM = useApiMutation((a: { staffId: string; avatarUrl: string | undefined }) => updateStaffPhoto(a.staffId, a.avatarUrl));

  useCardSection("info", dirty, async () => {
    setErrors({});
    try {
      const saved = await infoM.mutate({ ...draft, staffId: staff.id });
      const withPhoto =
        draft.avatarUrl !== staff.avatarUrl ? await photoM.mutate({ staffId: staff.id, avatarUrl: draft.avatarUrl }) : saved;
      const next = draftOf(withPhoto);
      setDraft(next);
      setSeenKey(keyOf(next));
    } catch (e) {
      if (e instanceof StaffValidationError) {
        setErrors({ [e.field]: t(`cardView.validation.${e.field}` as never) });
        requestAnimationFrame(() =>
          document.querySelector(`[data-staff-field="${e.field}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
        );
      }
      throw e;
    }
  });

  const positionOptions: ComboboxOption[] = (positionsQ.data ?? []).map((p) => ({ value: p.name.ru, label: p.name.ru }));
  const isSalon = staff.workplaces.includes("salon");
  const canOfferHome = staff.role === "master" && isSalon;

  return (
    <div data-f="F-10-025 F-10-026 F-10-039 F-10-051 F-00-048" className="flex flex-col gap-5">
      <div className="flex min-h-6 flex-wrap items-center gap-2">
        {isSalon ? (
          businessName && (
            <Badge tone="neutral" variant="soft">
              {t("infoTab.workModeSalon", { name: businessName })}
            </Badge>
          )
        ) : (
          <Badge tone="neutral" variant="soft">
            {t("infoTab.workModeIndividual")}
          </Badge>
        )}
      </div>
      {canOfferHome && (
        <Checkbox
          checked={staff.workplaces.includes("home")}
          disabled={homeAccept.isPending || !canEdit}
          onCheckedChange={(v) => void homeAccept.mutate(v).catch(() => toast.error(t("cardView.saveFailed")))}
          label={t("infoTab.homeAccept")}
          description={t("infoTab.homeAcceptHint")}
        />
      )}

      <PhotoField name={draft.name || staff.name} colorIndex={staff.colorIndex} value={draft.avatarUrl} disabled={!canEdit} onChange={(url) => patch({ avatarUrl: url })} />

      <div data-staff-field="name">
        <FormField label={t("infoTab.name")} required error={errors.name} hint={t("infoTab.nameHint")}>
          <Input value={draft.name} disabled={!canEdit} onChange={(e) => patch({ name: e.target.value })} placeholder={t("infoTab.namePlaceholder")} />
        </FormField>
      </div>
      <p data-f="F-10-039" className="-mt-3 text-xs text-muted">
        {t("infoTab.replaceHint")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div data-f="F-10-048">
          <FormField label={t("infoTab.position")} hint={t("infoTab.positionHint")}>
            <Combobox
              id={`${formId}-position`}
              options={positionOptions}
              value={draft.position || null}
              onValueChange={(v) => patch({ position: v ?? "" })}
              allowCreate
              onCreate={(text) => {
                patch({ position: text });
                void createPosition.mutate(text);
              }}
              loading={positionsQ.isLoading}
              disabled={!canEdit}
              placeholder={t("infoTab.positionPlaceholder")}
              emptyText={t("infoTab.positionEmpty")}
            />
          </FormField>
        </div>
        <FormField label={t("infoTab.specialty")} hint={t("infoTab.specialtyHint")}>
          <Input value={draft.specialty} disabled={!canEdit} onChange={(e) => patch({ specialty: e.target.value })} placeholder={t("infoTab.specialtyPlaceholder")} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div data-staff-field="phone">
          <FormField label={t("infoTab.phone")} error={errors.phone}>
            <PhoneInput value={draft.phone} disabled={!canEdit} onValueChange={(v) => patch({ phone: v })} invalid={Boolean(errors.phone)} />
          </FormField>
        </div>
        <div data-staff-field="email">
          <FormField label={t("infoTab.email")} optional error={errors.email}>
            <Input type="email" value={draft.email} disabled={!canEdit} onChange={(e) => patch({ email: e.target.value })} placeholder="name@example.com" />
          </FormField>
        </div>
      </div>

      <BioField value={draft.bio} disabled={!canEdit} onChange={(bio) => patch({ bio })} />

      <FormField label={t("infoTab.hiredAt")} className="max-w-56">
        <DatePicker value={draft.hiredAt} disabled={!canEdit} onValueChange={(d) => d && patch({ hiredAt: d })} />
      </FormField>
    </div>
  );
}

/** «О себе» на трёх языках (С18): вкладки языка над одним полем, у заполненных — отметка */
function BioField({ value, onChange, disabled }: { value: InfoDraft["bio"]; onChange: (v: InfoDraft["bio"]) => void; disabled: boolean }) {
  const t = useT("staff");
  const [lang, setLang] = useState<"ru" | "hy" | "en">("ru");
  const labelId = useId();
  return (
    <div data-f="F-10-025" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={labelId} className="text-sm font-medium text-fg">
          {t("infoTab.bio")} <span className="font-normal text-muted">· {t("infoTab.bioHint")}</span>
        </span>
        <SegmentedControl
          size="sm"
          aria-labelledby={labelId}
          value={lang}
          onValueChange={(v) => setLang(v as "ru" | "hy" | "en")}
          options={(["ru", "hy", "en"] as const).map((l) => ({
            value: l,
            label: `${t(`infoTab.bioLang.${l}`)}${value[l].trim() ? " ✓" : ""}`,
          }))}
        />
      </div>
      <Textarea
        aria-labelledby={labelId}
        lang={lang}
        value={value[lang]}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        rows={3}
        placeholder={t("infoTab.bioPlaceholder")}
      />
    </div>
  );
}

/** Фото 96 px с «Заменить» и «Убрать» (С16) */
function PhotoField({
  name,
  colorIndex,
  value,
  onChange,
  disabled,
}: {
  name: string;
  colorIndex: number;
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  disabled: boolean;
}) {
  const t = useT("staff");
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Мок — data: URL; режим api — файл на сервере, в поле — его адрес (src/api/uploads.ts)
  const upload = useImageUploader();
  const tUi = useT("ui");
  const onInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setError(null);
    if (!file) return;
    if (!IMAGE_ACCEPT.includes(file.type)) return setError(tUi("upload.wrongType"));
    if (file.size > SERVER_UPLOAD_MAX_MB * 1024 * 1024) return setError(tUi("upload.tooLarge", { mb: SERVER_UPLOAD_MAX_MB }));
    setBusy(true);
    try {
      onChange((await upload(file)).url);
    } catch (err) {
      setError(tUi(uploadErrorKey(err), { mb: SERVER_UPLOAD_MAX_MB }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-f="F-10-026" className="flex items-center gap-4">
      <span className="relative size-24 shrink-0 overflow-hidden rounded-full">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-24 object-cover" />
        ) : (
          <Avatar name={name} colorIndex={colorIndex} size="xl" className="size-24 text-3xl" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <LoaderCircle aria-hidden className="size-6 animate-spin text-muted" />
          </span>
        )}
      </span>
      {!disabled && (
        <span className="flex flex-wrap gap-2">
          <input id={inputId} type="file" accept={IMAGE_ACCEPT.join(",")} disabled={busy} className="sr-only" onChange={(e) => void onInput(e)} />
          <label
            htmlFor={inputId}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2 focus-within:outline-2 focus-within:outline-focus"
          >
            <ImagePlus aria-hidden className="size-4" />
            {value ? t("infoTab.photoReplace") : t("infoTab.photoAdd")}
          </label>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              {t("infoTab.photoRemove")}
            </Button>
          )}
          {error && (
            <p role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          )}
        </span>
      )}
    </div>
  );
}
