"use client";

/**
 * /biz/payroll/bonuses — справочник «Премии и штрафы» (F-09-072). Принадлежит разделу «payroll».
 * Шаблоны со стандартной суммой; их выбор подставляет сумму при начислении во «Взаиморасчётах»
 * (F-09-073/074, экран finance — см. qa/requests/payroll.md о подключении этого справочника туда).
 */
import { useState } from "react";
import { Gift, Minus, Plus, Trash2 } from "lucide-react";
import {
  deleteBonusPenaltyType,
  listBonusPenaltyTypes,
  saveBonusPenaltyType,
} from "@/api/payroll";
import { useApiMutation, useApiQuery } from "@/api/request";
import type { BonusPenaltyKind, BonusPenaltyType } from "@/domain/payroll";
import { useCurrent } from "@/demo/hooks";
import { usePayrollAccess } from "@/areas/payroll/access";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { MoneyInput } from "@/ui/MoneyInput";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { SkeletonText } from "@/ui/Skeleton";
import { useConfirm, useToast } from "@/ui/Toast";

function KindList({ kind }: { kind: BonusPenaltyKind }) {
  const t = useT("payroll");
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  // F-09-085: справочник премий/штрафов — под тем же правом «Доступ к схемам расчёта», что и схемы
  const canManage = usePayrollAccess().schemesAccess;

  const q = useApiQuery(
    ["payroll", "bonusPenaltyTypes", businessId, kind],
    () => listBonusPenaltyTypes(businessId!, kind),
    {
      enabled: ready && Boolean(businessId),
    },
  );

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState<number | undefined>(undefined);

  const saveM = useApiMutation(
    (args: { id?: string; name: string; amount: number }) =>
      saveBonusPenaltyType({
        id: args.id,
        businessId: businessId!,
        kind,
        name: args.name,
        defaultAmount: args.amount,
      }),
  );
  const deleteM = useApiMutation((id: string) =>
    deleteBonusPenaltyType(businessId!, id),
  );

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await saveM.mutate({ name: name.trim(), amount: amount ?? 0 });
      toast.success(t("bonuses.saved"));
      setName("");
      setAmount(undefined);
      setAdding(false);
      q.refetch();
    } catch {
      toast.error(t("bonuses.saveFailed"));
    }
  };

  const startEdit = (row: BonusPenaltyType) => {
    setEditingId(row.id);
    setEditName(row.name);
    setEditAmount(row.defaultAmount);
  };

  const handleEditSave = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await saveM.mutate({
        id,
        name: editName.trim(),
        amount: editAmount ?? 0,
      });
      toast.success(t("bonuses.saved"));
      setEditingId(null);
      q.refetch();
    } catch {
      toast.error(t("bonuses.saveFailed"));
    }
  };

  const handleDelete = async (row: BonusPenaltyType) => {
    const ok = await confirm({
      title: t("bonuses.deleteTitle"),
      description: t("bonuses.deleteText", { name: row.name }),
      tone: "danger",
      confirmLabel: t("bonuses.deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteM.mutate(row.id);
      toast.success(t("bonuses.deleted"));
      q.refetch();
    } catch {
      toast.error(t("bonuses.saveFailed"));
    }
  };

  const Icon = kind === "bonus" ? Gift : Minus;

  return (
    <SectionCard title={t(`bonuses.kind.${kind}`)} padding="sm">
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !ready || q.isLoading ? (
        // Те же строки «название · сумма · корзина» (в демо — по две на вид) и кнопка «Добавить» на своём месте
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {["18ch", "22ch"].map((w) => (
              <li key={w} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="-my-1.5 flex min-h-10 min-w-0 flex-1 items-center text-sm font-medium text-fg">
                  <SkeletonText width={w} />
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  <SkeletonText width="8ch" />
                </span>
                {canManage && <span aria-hidden className="size-11 shrink-0 md:size-10" />}
              </li>
            ))}
          </ul>
          {canManage && (
            <Button size="sm" variant="secondary" leftIcon={<Plus aria-hidden className="size-4" />} disabled>
              {t(`bonuses.add.${kind}`)}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(q.data ?? []).length === 0 && !adding && (
            <EmptyState
              compact
              icon={<Icon aria-hidden className="size-6" />}
              title={t(`bonuses.empty.${kind}`)}
            />
          )}
          <ul className="flex flex-col gap-2">
            {pageItems.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                {editingId === row.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t("bonuses.namePlaceholder")}
                      className="min-w-0 flex-1"
                    />
                    <div className="w-28 shrink-0">
                      <MoneyInput
                        value={editAmount}
                        onValueChange={setEditAmount}
                      />
                    </div>
                    <Button
                      size="sm"
                      loading={saveM.isPending}
                      disabled={!editName.trim()}
                      onClick={() => handleEditSave(row.id)}
                    >
                      {t("bonuses.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      {t("bonuses.cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => canManage && startEdit(row)}
                      className="-my-1.5 flex min-h-10 min-w-0 flex-1 items-center truncate text-left text-sm font-medium text-fg"
                      disabled={!canManage}
                    >
                      {row.name}
                    </button>
                    <span className="shrink-0 text-sm tabular-nums text-muted">
                      {format.money(row.defaultAmount)}
                    </span>
                    {canManage && (
                      <IconButton
                        icon={<Trash2 aria-hidden className="size-4" />}
                        label={t("bonuses.deleteEntry")}
                        onClick={() => handleDelete(row)}
                        disabled={deleteM.isPending}
                      />
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {pager}

          {canManage &&
            (adding ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("bonuses.namePlaceholder")}
                  className="min-w-0 flex-1"
                  autoFocus
                />
                <div className="w-28 shrink-0">
                  <MoneyInput value={amount} onValueChange={setAmount} />
                </div>
                <Button
                  size="sm"
                  loading={saveM.isPending}
                  disabled={!name.trim()}
                  onClick={handleAdd}
                >
                  {t("bonuses.save")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setName("");
                    setAmount(undefined);
                  }}
                >
                  {t("bonuses.cancel")}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Plus aria-hidden className="size-4" />}
                onClick={() => setAdding(true)}
              >
                {t(`bonuses.add.${kind}`)}
              </Button>
            ))}
        </div>
      )}
    </SectionCard>
  );
}

export function BonusesScreen() {
  const t = useT("payroll");
  return (
    <div
      data-f="F-09-072 F-09-082"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t("nav.bonuses")}
        description={t("bonuses.description")}
      />
      <KindList kind="bonus" />
      <KindList kind="penalty" />
    </div>
  );
}
