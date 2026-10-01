"use client";

/**
 * /biz/payroll/rules — «Правила расчета» классической модели (F-09-049). Принадлежит разделу «payroll».
 * Видны только когда «Основные настройки» переключены на классическую модель (F-09-002).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import {
  createEmptyRule,
  deleteRule,
  listRules,
  saveRule,
} from "@/api/payroll";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { IconButton } from "@/ui/IconButton";
import { PageHeader } from "@/ui/PageHeader";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { useConfirm, useToast } from "@/ui/Toast";
import { usePayrollAccess } from "@/areas/payroll/access";

export function RulesListScreen() {
  const t = useT("payroll");
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  const access = usePayrollAccess();
  const router = useRouter();
  const q = useApiQuery(
    ["payroll", "rules", businessId],
    () => listRules(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  const [creating, setCreating] = useState(false);
  const deleteM = useApiMutation(deleteRule);

  const handleAdd = async () => {
    if (!businessId) return;
    setCreating(true);
    try {
      const draft = createEmptyRule(businessId, t("classic.rules.newName"));
      const saved = await saveRule(draft);
      toast.success(t("classic.rules.created"));
      q.refetch();
      router.push(`/biz/payroll/rules/${saved.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: t("classic.rules.deleteTitle"),
      description: t("classic.rules.deleteText", { name }),
      tone: "danger",
      confirmLabel: t("classic.rules.deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteM.mutate(id);
      toast.success(t("classic.rules.deleted"));
      q.refetch();
    } catch {
      toast.error(t("classic.rules.deleteFailed"));
    }
  };

  return (
    <div data-f="F-09-049" className="flex flex-col gap-6">
      <PageHeader
        title={t("classic.rules.title")}
        description={t("classic.rules.subtitle")}
        actions={
          access.schemesAccess && (
            <Button
              leftIcon={<Plus aria-hidden />}
              loading={creating}
              onClick={handleAdd}
            >
              {t("classic.rules.add")}
            </Button>
          )
        }
      />
      {q.isLoading ? (
        // В демо классических правил чаще нет — скелетон в форме пустого состояния (значок, заголовок, подсказка),
        // а не карточки, которые потом исчезнут
        <EmptyState
          icon={<ClipboardList aria-hidden className="size-8 text-muted" />}
          title={<SkeletonText width="16ch" />}
          description={<Skeleton lines={2} />}
          // Без «подъёма» при появлении: скелетон стоит там же, где потом встанет пустое состояние
          className="animate-none!"
        />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList aria-hidden className="size-8 text-muted" />}
          title={t("classic.rules.empty")}
          description={t("classic.rules.emptyHint")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {q.data.map((rule) => (
            <Card
              key={rule.id}
              padding="sm"
              className="flex items-center justify-between gap-3"
            >
              <Link
                href={`/biz/payroll/rules/${rule.id}`}
                className="flex-1 min-w-0 py-1"
              >
                <p className="truncate font-medium text-fg">{rule.name}</p>
              </Link>
              {access.schemesAccess && (
                <IconButton
                  icon={<Trash2 aria-hidden className="size-4" />}
                  label={t("classic.rules.deleteConfirm")}
                  onClick={() => handleDelete(rule.id, rule.name)}
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
