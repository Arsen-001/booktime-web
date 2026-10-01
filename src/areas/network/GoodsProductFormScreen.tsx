"use client";

/**
 * /biz/network/goods/[productId] — форма сетевого товара (F-11-113): в филиале правится только цена,
 * себестоимость, пороги остатка и комментарий (F-08-130, стрелка на stockApi.isNetworkFieldLocked).
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getNetworkGoodsProduct,
  listNetworkGoodsCategories,
  listNetworkLocations,
  saveNetworkGoodsProduct,
} from "@/api/network";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { LinkButton } from "@/ui/Button";
import { MoneyInput } from "@/ui/MoneyInput";
import { PageHeader } from "@/ui/PageHeader";
import { SectionCard } from "@/ui/SectionCard";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";
import { LocationsPicker } from "@/areas/network/lib/LocationsPicker";
import { useNetwork } from "@/areas/network/lib/useNetwork";

export function GoodsProductFormScreen() {
  const t = useT("network");
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ productId: string }>();
  const isNew = params.productId === "new";
  const groupId = isNew ? undefined : decodeURIComponent(params.productId);
  const { ready, networkId, isError, refetch } = useNetwork();

  const locationsQ = useApiQuery(
    ["network", "locations", networkId],
    () => listNetworkLocations(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const categoriesQ = useApiQuery(
    ["network", "goodsCategories", networkId],
    () => listNetworkGoodsCategories(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const detailQ = useApiQuery(
    ["network", "goodsProduct", networkId, groupId],
    () => getNetworkGoodsProduct(networkId!, groupId!),
    { enabled: ready && Boolean(networkId) && !isNew },
  );

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [salePrice, setSalePrice] = useState<number | undefined>(undefined);
  const [costPrice, setCostPrice] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [filled, setFilled] = useState(false);

  if (detailQ.data && !filled) {
    const g = detailQ.data.good;
    setName(g.name);
    setCategoryId(g.categoryId);
    setSalePrice(g.salePrice);
    setCostPrice(g.costPrice);
    setComment(g.comment ?? "");
    setBusinessIds(detailQ.data.businessIds);
    setFilled(true);
  }

  const mutation = useApiMutation((_: void) =>
    saveNetworkGoodsProduct(networkId!, {
      groupId,
      name: name.trim(),
      categoryId,
      salePrice: salePrice ?? 0,
      costPrice: costPrice ?? 0,
      comment: comment.trim() || undefined,
      businessIds,
    }),
  );

  if (isError || detailQ.isError)
    return (
      <ErrorState onRetry={() => (isError ? refetch() : detailQ.refetch())} />
    );

  const loading = !ready || locationsQ.isLoading || categoriesQ.isLoading || (!isNew && detailQ.isLoading);

  if (!loading && !categoriesQ.data?.length) {
    return (
      <div data-f="F-11-113" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t("goods.product.newTitle")} />
        <EmptyState
          title={t("goods.product.needCategoryFirst")}
          action={
            <LinkButton href="/biz/network/goods/categories/new">
              {t("goods.category.newTitle")}
            </LinkButton>
          }
        />
      </div>
    );
  }

  const save = async () => {
    if (!name.trim()) {
      setError(t("goods.product.nameRequired"));
      return;
    }
    if (!categoryId) {
      setError(t("goods.product.categoryRequired"));
      return;
    }
    if (!businessIds.length) {
      setError(t("goods.product.locationsRequired"));
      return;
    }
    try {
      await mutation.mutate();
      toast.success(t("goods.product.saved"));
      router.push("/biz/network/goods");
    } catch {
      toast.error(t("goods.product.saveFailed"));
    }
  };

  return (
    <div
      data-f="F-11-113"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader title={isNew ? t("goods.product.newTitle") : t("goods.product.editTitle")} />
      {loading ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <SectionCard title={t("goods.product.nameLabel")}>
            <div className="flex flex-col gap-4">
              <FormField label={t("goods.product.nameLabel")} required error={error}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </FormField>
              <FormField label={t("goods.product.categoryLabel")} required>
                <Select
                  options={(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onValueChange={setCategoryId}
                />
              </FormField>
              <div className="flex gap-3">
                <FormField label={t("goods.product.salePriceLabel")} className="flex-1">
                  <MoneyInput value={salePrice} onValueChange={setSalePrice} />
                </FormField>
                <FormField label={t("goods.product.costPriceLabel")} className="flex-1">
                  <MoneyInput value={costPrice} onValueChange={setCostPrice} />
                </FormField>
              </div>
              <FormField label={t("goods.product.commentLabel")} optional>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              </FormField>
            </div>
          </SectionCard>
          <SectionCard
            title={t("goods.product.locationsTitle")}
            description={t("goods.product.localNote")}
          >
            <LocationsPicker
              locations={locationsQ.data ?? []}
              value={businessIds}
              onChange={setBusinessIds}
            />
          </SectionCard>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => router.back()}>
              {t("goods.product.cancel")}
            </Button>
            <Button loading={mutation.isPending} onClick={save}>
              {t("goods.product.save")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
