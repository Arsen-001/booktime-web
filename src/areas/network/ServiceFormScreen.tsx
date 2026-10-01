"use client";

/**
 * /biz/network/services/[serviceId] — форма сетевой услуги (F-11-081, F-11-082, F-11-083).
 * `serviceId === 'new'` — создание.
 */
import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getNetworkService,
  listNetworkLocations,
  listNetworkServiceCategories,
  previewNetworkServiceSave,
  saveNetworkService,
  type NetworkServiceSaveRow,
} from "@/api/network";
import { useFormat } from "@/i18n/useFormat";
import { Badge } from "@/ui/Badge";
import { Modal } from "@/ui/Modal";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { ErrorState } from "@/ui/ErrorState";
import { EmptyState } from "@/ui/EmptyState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { MoneyInput } from "@/ui/MoneyInput";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";
import { LinkButton } from "@/ui/Button";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function ServiceFormScreen() {
  const t = useT("network");
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ serviceId: string }>();
  const searchParams = useSearchParams();
  const isNew = params.serviceId === "new";
  const key = isNew ? undefined : decodeURIComponent(params.serviceId);
  const { ready, networkId, isError, refetch } = useNetwork();

  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const categoriesQ = useApiQuery(
    ["network", "serviceCategories", networkId],
    () => listNetworkServiceCategories(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const detailQ = useApiQuery(
    ["network", "service", networkId, key],
    () => getNetworkService(networkId!, key!),
    { enabled: ready && Boolean(networkId) && !isNew },
  );

  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [onlineName, setOnlineName] = useState("");
  const [categoryKey, setCategoryKey] = useState(
    searchParams.get("categoryKey") ?? "",
  );
  const [kind, setKind] = useState<"individual" | "group">("individual");
  const [descRu, setDescRu] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [priceMin, setPriceMin] = useState<number | undefined>(undefined);
  const [priceRange, setPriceRange] = useState(false);
  const [priceMax, setPriceMax] = useState<number | undefined>(undefined);
  const [capacity, setCapacity] = useState<number | undefined>(undefined);
  const [priceLocked, setPriceLocked] = useState(false);
  const [descriptionLocked, setDescriptionLocked] = useState(false);
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [filled, setFilled] = useState(false);

  if (detailQ.data && !filled) {
    const { service } = detailQ.data;
    setNameRu(service.name.ru ?? "");
    setNameEn(service.name.en ?? "");
    setOnlineName(detailQ.data.onlineName ?? "");
    setDescRu(service.description?.ru ?? "");
    setKind(service.kind);
    setDurationMin(service.durationMin);
    setPriceMin(service.priceMin);
    setPriceRange(service.priceMax != null);
    setPriceMax(service.priceMax);
    setCapacity(service.capacity);
    setPriceLocked(detailQ.data.priceLocked);
    setDescriptionLocked(detailQ.data.descriptionLocked);
    setBusinessIds(detailQ.data.businessIds);
    setFilled(true);
  }

  const format = useFormat();
  // Сеть4: перед записью — превью по каждому филиалу, выбор цены и подтверждение удаления
  const [preview, setPreview] = useState<NetworkServiceSaveRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [priceMode, setPriceMode] = useState<"all" | "keepLocal">("all");
  const mutation = useApiMutation((mode: "all" | "keepLocal") =>
    saveNetworkService(networkId!, {
      priceMode: mode,
      key,
      name: { ru: nameRu.trim(), en: nameEn.trim() || undefined },
      onlineName: onlineName.trim() ? { ru: onlineName.trim() } : undefined,
      categoryKey,
      kind,
      description: descRu.trim() ? { ru: descRu.trim() } : undefined,
      durationMin,
      priceMin: priceMin ?? 0,
      priceMax: priceRange ? priceMax : undefined,
      capacity: kind === "group" ? capacity : undefined,
      priceLocked,
      descriptionLocked,
      businessIds,
    }),
  );

  if (isError || detailQ.isError)
    return (
      <ErrorState onRetry={() => (isError ? refetch() : detailQ.refetch())} />
    );

  const loading =
    !ready || locationsQ.isLoading || categoriesQ.isLoading || (!isNew && detailQ.isLoading);

  if (!loading && !categoriesQ.data?.length) {
    return (
      <div data-f="F-11-081" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t("services.form.newServiceTitle")} />
        <EmptyState
          title={t("services.form.needCategoryFirst")}
          action={
            <LinkButton href="/biz/network/services/categories/new">
              {t("services.form.createCategoryFirst")}
            </LinkButton>
          }
        />
      </div>
    );
  }

  const save = async () => {
    if (!nameRu.trim()) {
      setError(t("services.form.nameRequired"));
      return;
    }
    if (!categoryKey) {
      setError(t("services.form.categoryRequired"));
      return;
    }
    if (!businessIds.length) {
      setError(t("services.form.locationsRequired"));
      return;
    }
    setPreviewing(true);
    try {
      const rows = await previewNetworkServiceSave(networkId!, { key, categoryKey, businessIds });
      setPriceMode("all");
      setPreview(rows);
    } catch {
      toast.error(t("services.form.saveFailed"));
    } finally {
      setPreviewing(false);
    }
  };

  const newPriceMax = priceRange ? priceMax : undefined;
  const priceText = (min?: number, max?: number) =>
    min == null ? "—" : max != null ? `${format.money(min)} – ${format.money(max)}` : format.money(min);
  const priceDiffers = (r: NetworkServiceSaveRow) =>
    r.action === "update" && (r.currentPriceMin !== (priceMin ?? 0) || (r.currentPriceMax ?? undefined) !== newPriceMax);
  const anyPriceDiffers = (preview ?? []).some(priceDiffers);
  const removals = (preview ?? []).filter((r) => r.action === "remove");
  const futureTotal = removals.reduce((sum, r) => sum + r.futureBookings, 0);

  const confirmSave = async () => {
    try {
      await mutation.mutate(priceMode);
      setPreview(null);
      toast.success(
        isNew ? t("services.form.serviceCreated") : t("services.form.serviceSaved"),
      );
      router.push("/biz/network/services/migration");
    } catch {
      toast.error(t("services.form.saveFailed"));
    }
  };

  return (
    <div
      data-f="F-11-081"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24"
    >
      <PageHeader
        title={isNew ? t("services.form.newServiceTitle") : t("services.form.editServiceTitle")}
        description={t("services.form.serviceSubtitle")}
      />
      {loading ? (
        <Skeleton lines={8} />
      ) : (
        <>
          <SectionCard title={t("services.form.mainTitle")}>
            <div className="flex flex-col gap-4">
              <FormField label={t("services.form.nameRu")} required error={error}>
                <Input value={nameRu} onChange={(e) => setNameRu(e.target.value)} autoFocus />
              </FormField>
              <FormField label={t("services.form.nameEn")} optional>
                <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </FormField>
              <FormField label={t("services.form.onlineNameLabel")} optional>
                <Input value={onlineName} onChange={(e) => setOnlineName(e.target.value)} />
              </FormField>
              <FormField label={t("services.form.categoryLabel")} required>
                <Select
                  options={(categoriesQ.data ?? []).map((c) => ({
                    value: c.key,
                    label: c.category.name.ru,
                  }))}
                  value={categoryKey}
                  onValueChange={setCategoryKey}
                  placeholder={t("services.form.categoryPlaceholder")}
                />
              </FormField>
              <div data-f="F-16-032" className="contents">
                <FormField
                  label={t("services.form.kindLabel")}
                  hint={t("services.form.kindNetworkHint")}
                >
                  <SegmentedControl
                    options={[
                      { value: "individual", label: t("services.form.kindIndividual") },
                      { value: "group", label: t("services.form.kindGroup") },
                    ]}
                    value={kind}
                    onValueChange={(v) => setKind(v as typeof kind)}
                  />
                </FormField>
              </div>
              {kind === "group" && (
                <FormField label={t("services.form.capacityLabel")}>
                  <Input
                    type="number"
                    min={1}
                    value={capacity ?? ""}
                    onChange={(e) => setCapacity(Number(e.target.value) || undefined)}
                  />
                </FormField>
              )}
              <FormField label={t("services.form.descriptionLabel")} optional>
                <Textarea value={descRu} onChange={(e) => setDescRu(e.target.value)} rows={3} />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title={t("services.form.priceDurationTitle")}>
            <div className="flex flex-col gap-4">
              <FormField label={t("services.form.durationLabel")} required>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value) || 5)}
                />
              </FormField>
              <Switch
                checked={priceRange}
                onCheckedChange={setPriceRange}
                label={t("services.form.priceRangeToggle")}
              />
              <div className="flex gap-3">
                <FormField
                  label={priceRange ? t("services.form.priceFrom") : t("services.form.priceLabel")}
                  className="flex-1"
                >
                  <MoneyInput value={priceMin} onValueChange={setPriceMin} />
                </FormField>
                {priceRange && (
                  <FormField label={t("services.form.priceTo")} className="flex-1">
                    <MoneyInput value={priceMax} onValueChange={setPriceMax} />
                  </FormField>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t("services.form.locksTitle")}
            description={t("services.form.locksDescription")}
          >
            <div className="flex flex-col gap-3">
              <div data-f="F-11-082">
                <Switch
                  checked={priceLocked}
                  onCheckedChange={setPriceLocked}
                  label={t("services.form.priceLockLabel")}
                />
              </div>
              <div data-f="F-11-083">
                <Switch
                  checked={descriptionLocked}
                  onCheckedChange={setDescriptionLocked}
                  label={t("services.form.descriptionLockLabel")}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title={t("services.form.locationsTitle")}>
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={businessIds}
              onChange={setBusinessIds}
            />
          </SectionCard>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              {t("services.form.cancel")}
            </Button>
            <Button loading={previewing} onClick={save}>
              {t("services.form.save")}
            </Button>
          </div>
        </>
      )}

      <Modal
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={t("services.preview.title")}
        description={t("services.preview.subtitle")}
        size="md"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              {t("services.form.cancel")}
            </Button>
            <Button
              variant={removals.length ? "danger" : "primary"}
              loading={mutation.isPending}
              onClick={() => void confirmSave()}
            >
              {removals.length ? t("services.preview.confirmWithRemove", { count: removals.length }) : t("services.form.save")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {(preview ?? []).map((r) => (
              <li key={r.businessId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{r.businessName}</span>
                <Badge tone={r.action === "remove" ? "danger" : r.action === "create" ? "success" : "neutral"} size="sm">
                  {t(`services.preview.action.${r.action}` as const)}
                </Badge>
                <span className="w-full text-xs text-muted sm:w-auto">
                  {r.action === "create"
                    ? priceText(priceMin ?? 0, newPriceMax)
                    : r.action === "remove"
                      ? priceText(r.currentPriceMin, r.currentPriceMax)
                      : priceDiffers(r)
                        ? `${priceText(r.currentPriceMin, r.currentPriceMax)} → ${priceMode === "all" ? priceText(priceMin ?? 0, newPriceMax) : t("services.preview.keepsLocal")}`
                        : priceText(r.currentPriceMin, r.currentPriceMax)}
                  {r.createsCategory ? ` · ${t("services.preview.createsCategory")}` : ""}
                  {r.action === "remove" && r.futureBookings > 0
                    ? ` · ${t("services.preview.futureBookings", { count: r.futureBookings })}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          {anyPriceDiffers && (
            <FormField label={t("services.preview.priceQuestion")}>
              <SegmentedControl
                options={[
                  { value: "all", label: t("services.preview.priceAll") },
                  { value: "keepLocal", label: t("services.preview.priceKeepLocal") },
                ]}
                value={priceMode}
                onValueChange={(v) => setPriceMode(v as "all" | "keepLocal")}
              />
            </FormField>
          )}
          {removals.length > 0 && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-fg">
              {futureTotal > 0
                ? t("services.preview.removeWarningBookings", { count: futureTotal })
                : t("services.preview.removeWarning")}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
