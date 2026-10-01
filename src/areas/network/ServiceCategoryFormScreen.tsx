"use client";

/**
 * /biz/network/services/categories/[categoryId] — форма сетевой категории услуг (F-11-080).
 * `categoryId === 'new'` — создание. Ключ категории (имя) используется как id в адресе правки.
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getNetworkServiceCategory,
  listNetworkLocations,
  listNetworkSubdivisions,
  saveNetworkServiceCategory,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function ServiceCategoryFormScreen() {
  const t = useT("network");
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ categoryId: string }>();
  const isNew = params.categoryId === "new";
  const key = isNew ? undefined : decodeURIComponent(params.categoryId);
  const { ready, networkId, isError, refetch } = useNetwork();

  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const subdivisionsQ = useApiQuery(
    ["network", "subdivisions", networkId],
    () => listNetworkSubdivisions(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const detailQ = useApiQuery(
    ["network", "serviceCategory", networkId, key],
    () => getNetworkServiceCategory(networkId!, key!),
    { enabled: ready && Boolean(networkId) && !isNew },
  );

  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [onlineName, setOnlineName] = useState("");
  const [subdivisionId, setSubdivisionId] = useState("");
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [filled, setFilled] = useState(false);

  if (detailQ.data && !filled) {
    setNameRu(detailQ.data.name.ru ?? "");
    setNameEn(detailQ.data.name.en ?? "");
    setOnlineName(detailQ.data.onlineName ?? "");
    setSubdivisionId(detailQ.data.subdivisionId ?? "");
    setBusinessIds(detailQ.data.businessIds);
    setFilled(true);
  }

  const mutation = useApiMutation((_: void) =>
    saveNetworkServiceCategory(networkId!, {
      key,
      name: { ru: nameRu.trim(), en: onlyIfSet(nameEn) },
      onlineName: onlineName.trim() ? { ru: onlineName.trim() } : undefined,
      subdivisionId: subdivisionId || undefined,
      businessIds,
    }),
  );

  if (isError || detailQ.isError)
    return (
      <ErrorState onRetry={() => (isError ? refetch() : detailQ.refetch())} />
    );

  const loading = !ready || locationsQ.isLoading || (!isNew && detailQ.isLoading);

  const save = async () => {
    if (!nameRu.trim()) {
      setError(t("services.form.nameRequired"));
      return;
    }
    if (!businessIds.length) {
      setError(t("services.form.locationsRequired"));
      return;
    }
    try {
      await mutation.mutate();
      toast.success(
        isNew ? t("services.form.categoryCreated") : t("services.form.categorySaved"),
      );
      router.push("/biz/network/services");
    } catch {
      toast.error(t("services.form.saveFailed"));
    }
  };

  return (
    <div
      data-f="F-11-080"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={isNew ? t("services.form.newCategoryTitle") : t("services.form.editCategoryTitle")}
        description={t("services.form.categorySubtitle")}
      />
      {loading ? (
        <Skeleton lines={6} />
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
              <FormField
                label={t("services.form.onlineNameLabel")}
                optional
                hint={t("services.form.onlineNameHint")}
              >
                <Input value={onlineName} onChange={(e) => setOnlineName(e.target.value)} />
              </FormField>
              <FormField label={t("services.form.subdivisionLabel")} optional>
                <Select
                  options={[
                    { value: "", label: t("services.form.noSubdivision") },
                    ...(subdivisionsQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={subdivisionId}
                  onValueChange={setSubdivisionId}
                />
              </FormField>
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
            <Button loading={mutation.isPending} onClick={save}>
              {t("services.form.save")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function onlyIfSet(v: string) {
  return v.trim() ? v.trim() : undefined;
}
