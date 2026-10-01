"use client";

/**
 * F-01-010: «Продать ▾» — товар / абонемент / сертификат без записи на этот день, во всплывающем
 * окне В КОНТЕКСТЕ журнала (block-баг: раньше пункты уводили целиком на /biz/stock и /biz/loyalty —
 * оба ещё «скоро появится», страница журнала терялась). Настоящий склад/лояльность принадлежат
 * разделам «Склад»/«Лояльность» (ещё не построены) — здесь демо-каталог и демо-продажа в своём
 * срезе (F-01-060, см. qa/requests/journal.md), с приглашением создать первый тип, если в каталоге
 * его ещё нет.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, User, X } from "lucide-react";
import type { Client } from "@/domain/core";
import type { GoodsKind } from "@/domain/journal";
import { getGoodsCatalog, searchClientsForBooking, sellWithoutBooking } from "@/api/journal";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { newId } from "@/lib/id";
import { Button } from "@/ui/Button";
import { DropdownMenu } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { useToast } from "@/ui/Toast";

/** F-04-219: поиск клиента внутри «Продать ▾» — тот же поиск, что и в правой панели журнала (F-04-103). */
function SellClientField({ client, onChange }: { client: Client | null; onChange: (c: Client | null) => void }) {
  const t = useT("journal");
  const { businessId } = useCurrent();
  const [query, setQuery] = useState("");
  const searchQ = useApiQuery(
    ["journal", "sell-client-search", businessId, query],
    () => searchClientsForBooking(businessId!, query),
    { enabled: Boolean(businessId) && query.trim().length >= 2 },
  );
  const results = searchQ.data ?? [];

  if (client) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <User aria-hidden className="size-4 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{client.name || client.phone}</p>
            {client.name && <p className="truncate text-xs text-muted">{client.phone}</p>}
          </div>
        </div>
        <IconButton icon={<X aria-hidden />} label={t("header.sell.clientClear")} variant="ghost" size="sm" onClick={() => onChange(null)} />
      </div>
    );
  }

  return (
    <FormField label={t("header.sell.clientLabel")} hint={t("header.sell.clientHint")}>
      <div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("header.sell.clientPlaceholder")} />
        {query.trim().length >= 2 && (
          <ul className="mt-1 flex max-h-40 flex-col overflow-auto rounded-lg border border-border">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{t("header.sell.clientNoResults")}</li>
            ) : (
              results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                    onClick={() => {
                      onChange(c);
                      setQuery("");
                    }}
                  >
                    <span className="truncate">{c.name || c.phone}</span>
                    <span className="shrink-0 text-xs text-muted">{c.phone}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </FormField>
  );
}

export function SellMenu() {
  const t = useT("journal");
  const tc = useT("common");
  const router = useRouter();
  const toast = useToast();
  const format = useFormat();
  // Ск3: товары — со склада текущей локации журнала
  const { businessId: sellBusinessId, locationId: sellLocationId } = useCurrent();
  const catalogQuery = useApiQuery(
    ["journal", "goods-catalog", sellBusinessId, sellLocationId],
    () => getGoodsCatalog(sellLocationId),
    {},
  );
  const sellMutation = useApiMutation(sellWithoutBooking);
  const [emptyKind, setEmptyKind] = useState<
    "subscription" | "certificate" | undefined
  >(undefined);
  const [saleKind, setSaleKind] = useState<GoodsKind | undefined>(undefined);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  // F-04-219: клиент продажи вне визита — необязателен, но привязывает продажу к его «Продано»/«Оплачено».
  const [saleClient, setSaleClient] = useState<Client | null>(null);

  const catalog = catalogQuery.data ?? [];
  const hasKind = (kind: "subscription" | "certificate") =>
    catalog.some((g) => g.kind === kind);

  const openSale = (kind: GoodsKind) => {
    setSaleKind(kind);
    const items = catalog.filter((g) => g.kind === kind);
    setItemId(items[0]?.id ?? "");
    setQty(1);
    setCode("");
    setSaleClient(null);
    setPaymentMethod("cash");
  };

  const saleItems = saleKind
    ? catalog.filter((g) => g.kind === saleKind)
    : [];
  const selectedItem = saleItems.find((g) => g.id === itemId);
  const total = selectedItem ? selectedItem.price * qty : 0;
  // F-04-219: без кода абонемент/сертификат «намертво» привязывается к клиенту — код тогда не нужен.
  const codeMissing =
    Boolean(selectedItem?.requiresCode) && !code.trim() && !saleClient;
  const outOfStock =
    selectedItem?.kind === "product" && selectedItem.stock < qty;
  const canSubmit = Boolean(selectedItem) && !codeMissing && !outOfStock;

  const handleSell = async () => {
    if (!selectedItem) return;
    try {
      await sellMutation.mutate({
        itemId: selectedItem.id,
        qty,
        paymentMethod,
        code: code.trim() || undefined,
        clientId: saleClient?.id,
        clientName: saleClient?.name || saleClient?.phone,
        locationId: sellLocationId,
      });
      toast.success(t("header.sell.quickSaleSuccess"));
      catalogQuery.refetch();
      setSaleKind(undefined);
    } catch {
      toast.error(tc("states.actionFailed"));
    }
  };

  return (
    <>
      <div data-f="F-01-010">
        <DropdownMenu
          label={t("header.sell.title")}
          trigger={(p) => (
            <Button
              {...p}
              type="button"
              variant="outline"
              size="sm"
            >
              {t("header.sell.title")}
            </Button>
          )}
          items={[
            {
              id: "product",
              label: t("header.sell.product"),
              onSelect: () => openSale("product"),
            },
            {
              id: "subscription",
              label: t("header.sell.subscription"),
              onSelect: () =>
                hasKind("subscription")
                  ? openSale("subscription")
                  : setEmptyKind("subscription"),
            },
            {
              id: "certificate",
              label: t("header.sell.certificate"),
              onSelect: () =>
                hasKind("certificate")
                  ? openSale("certificate")
                  : setEmptyKind("certificate"),
            },
          ]}
        />
      </div>

      {/* F-01-010 «Готово когда»: без типов абонементов/сертификатов — приглашение создать тип
          (тип абонемента/сертификата — раздел «Лояльность», ещё не построен). */}
      <Modal
        open={Boolean(emptyKind)}
        onOpenChange={(o) => !o && setEmptyKind(undefined)}
        title={t(
          `header.sell.emptyTitle.${emptyKind ?? "subscription"}` as never,
        )}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {t(`header.sell.emptyText.${emptyKind ?? "subscription"}` as never)}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmptyKind(undefined)}
            >
              {tc("actions.close")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                router.push("/biz/loyalty");
                setEmptyKind(undefined);
              }}
            >
              {t("header.sell.emptyCreate")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* F-01-010: продажа без визита остаётся В журнале — не /biz/stock, не /biz/loyalty */}
      <Modal
        open={Boolean(saleKind)}
        onOpenChange={(o) => !o && setSaleKind(undefined)}
        title={t(
          `header.sell.quickSaleTitle.${saleKind ?? "product"}` as never,
        )}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {saleItems.length === 0 ? (
            <EmptyState
              compact
              title={t("header.sell.quickSaleEmpty")}
              action={
                saleKind !== "product" ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      router.push("/biz/loyalty");
                      setSaleKind(undefined);
                    }}
                  >
                    {t("header.sell.emptyCreate")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <FormField label={t("header.sell.quickSaleItem")}>
                <Select
                  value={itemId}
                  onValueChange={(v) => {
                    setItemId(v);
                    setCode("");
                  }}
                  placeholder={t("header.sell.quickSaleItemPlaceholder")}
                  options={saleItems.map((g) => ({
                    value: g.id,
                    label: `${g.name} · ${format.money(g.price)}`,
                    disabled: g.kind === "product" && g.stock <= 0,
                  }))}
                />
              </FormField>

              <div data-f="F-04-219">
                <SellClientField client={saleClient} onChange={setSaleClient} />
              </div>

              {selectedItem?.kind === "product" && (
                <FormField
                  label={t("header.sell.quickSaleQty")}
                  hint={t("header.sell.quickSaleStock", {
                    count: selectedItem.stock,
                  })}
                  error={
                    outOfStock
                      ? t("header.sell.quickSaleOutOfStock")
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, selectedItem.stock)}
                    value={qty}
                    onChange={(e) =>
                      setQty(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </FormField>
              )}

              {selectedItem?.requiresCode && (
                <FormField
                  label={t("header.sell.quickSaleCode")}
                  error={
                    codeMissing
                      ? t("header.sell.quickSaleCodeRequired")
                      : undefined
                  }
                >
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      value={code}
                      placeholder={t("header.sell.quickSaleCodePlaceholder")}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <IconButton
                      icon={<RefreshCw aria-hidden />}
                      label={t("header.sell.quickSaleCodeGenerate")}
                      variant="outline"
                      onClick={() =>
                        setCode(newId("code").slice(-6).toUpperCase())
                      }
                    />
                  </div>
                </FormField>
              )}

              <div data-f="F-00-194">
                <FormField label={t("header.sell.quickSalePayment")}>
                  <SegmentedControl
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as "cash" | "card")}
                    options={[
                      { value: "cash", label: t("header.sell.quickSaleCash") },
                      { value: "card", label: t("header.sell.quickSaleCard") },
                    ]}
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted">
                  {t("header.sell.quickSaleTotal")}
                </span>
                <span className="font-semibold text-fg">
                  {format.money(total)}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSaleKind(undefined)}
                >
                  {tc("actions.cancel")}
                </Button>
                <Button
                  type="button"
                  loading={sellMutation.isPending}
                  disabled={!canSubmit}
                  onClick={handleSell}
                >
                  {t("header.sell.quickSaleSubmit")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
