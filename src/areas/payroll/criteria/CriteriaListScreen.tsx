"use client";

/**
 * /biz/payroll/criteria — «Критерии расчета» классической модели (F-09-051). Принадлежит разделу «payroll».
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Plus, Trash2 } from "lucide-react";
import {
  createEmptyCriterion,
  deleteCriterion,
  listCriteria,
  saveCriterion,
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

export function CriteriaListScreen() {
  const t = useT("payroll");
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const access = usePayrollAccess();
  const q = useApiQuery(
    ["payroll", "criteria", businessId],
    () => listCriteria(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  const [creating, setCreating] = useState(false);
  const deleteM = useApiMutation(deleteCriterion);

  const handleAdd = async () => {
    if (!businessId) return;
    setCreating(true);
    try {
      const draft = createEmptyCriterion(
        businessId,
        t("classic.criteria.newName"),
      );
      const saved = await saveCriterion(draft);
      toast.success(t("classic.criteria.created"));
      q.refetch();
      router.push(`/biz/payroll/criteria/${saved.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: t("classic.criteria.deleteTitle"),
      description: t("classic.criteria.deleteText", { name }),
      tone: "danger",
      confirmLabel: t("classic.criteria.deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteM.mutate(id);
      toast.success(t("classic.criteria.deleted"));
      q.refetch();
    } catch {
      toast.error(t("classic.criteria.deleteFailed"));
    }
  };

  return (
    <div data-f="F-09-051" className="flex flex-col gap-6">
      <PageHeader
        title={t("classic.criteria.title")}
        description={t("classic.criteria.subtitle")}
        actions={
          access.schemesAccess && (
            <Button
              leftIcon={<Plus aria-hidden />}
              loading={creating}
              onClick={handleAdd}
            >
              {t("classic.criteria.add")}
            </Button>
          )
        }
      />
      {q.isLoading ? (
        // В демо классических правил чаще нет — скелетон в форме пустого состояния (значок, заголовок, подсказка),
        // а не карточки, которые потом исчезнут
        <EmptyState
          icon={<Target aria-hidden className="size-8 text-muted" />}
          title={<SkeletonText width="16ch" />}
          description={
            // Подсказка на телефоне — в две строки, на компьютере — в одну
            <>
              <span className="block sm:hidden">
                <Skeleton lines={2} />
              </span>
              <span className="hidden sm:inline">
                <SkeletonText width="34ch" />
              </span>
            </>
          }
          className="animate-none!"
        />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState
          icon={<Target aria-hidden className="size-8 text-muted" />}
          title={t("classic.criteria.empty")}
          description={t("classic.criteria.emptyHint")}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {q.data.map((c) => (
            <Card
              key={c.id}
              padding="sm"
              className="flex items-center justify-between gap-3"
            >
              <Link
                href={`/biz/payroll/criteria/${c.id}`}
                className="flex-1 min-w-0 py-1"
              >
                <p className="truncate font-medium text-fg">{c.name}</p>
                <p className="truncate text-sm text-muted">
                  {t(`classic.criteria.metric.${c.metric}`)} ·{" "}
                  {t(`classic.criteria.period.${c.period}`)}
                </p>
              </Link>
              {access.schemesAccess && (
                <IconButton
                  icon={<Trash2 aria-hidden className="size-4" />}
                  label={t("classic.criteria.deleteConfirm")}
                  onClick={() => handleDelete(c.id, c.name)}
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
