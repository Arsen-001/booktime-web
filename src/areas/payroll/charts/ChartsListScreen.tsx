"use client";

/**
 * /biz/payroll/charts — «Схемы расчета» классической модели (F-09-053). Принадлежит разделу «payroll».
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutList, Plus, Trash2 } from "lucide-react";
import {
  createEmptyChart,
  deleteChart,
  listCharts,
  saveChart,
} from "@/api/payroll";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { IconButton } from "@/ui/IconButton";
import { PageHeader } from "@/ui/PageHeader";
import { SkeletonText } from "@/ui/Skeleton";
import { useConfirm, useToast } from "@/ui/Toast";
import { usePayrollAccess } from "@/areas/payroll/access";

export function ChartsListScreen() {
  const t = useT("payroll");
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const access = usePayrollAccess();
  const q = useApiQuery(
    ["payroll", "charts", businessId],
    () => listCharts(businessId!),
    { enabled: ready && Boolean(businessId) },
  );
  const [creating, setCreating] = useState(false);
  const deleteM = useApiMutation(deleteChart);

  const handleAdd = async () => {
    if (!businessId) return;
    setCreating(true);
    try {
      const draft = createEmptyChart(
        businessId,
        t("classic.charts.newName"),
        "standard",
      );
      const saved = await saveChart(draft);
      toast.success(t("classic.charts.created"));
      q.refetch();
      router.push(`/biz/payroll/charts/${saved.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: t("classic.charts.deleteTitle"),
      description: t("classic.charts.deleteText", { name }),
      tone: "danger",
      confirmLabel: t("classic.charts.deleteConfirm"),
    });
    if (!ok) return;
    try {
      await deleteM.mutate(id);
      toast.success(t("classic.charts.deleted"));
      q.refetch();
    } catch {
      toast.error(t("classic.charts.deleteFailed"));
    }
  };

  return (
    <div data-f="F-09-053" className="flex flex-col gap-6">
      <PageHeader
        title={t("classic.charts.title")}
        description={t("classic.charts.subtitle")}
        actions={
          access.schemesAccess && (
            <Button
              leftIcon={<Plus aria-hidden />}
              loading={creating}
              onClick={handleAdd}
            >
              {t("classic.charts.add")}
            </Button>
          )
        }
      />
      {q.isLoading ? (
        // В демо классических правил чаще нет — скелетон в форме пустого состояния (значок, заголовок, подсказка),
        // а не карточки, которые потом исчезнут
        <EmptyState
          icon={<LayoutList aria-hidden className="size-8 text-muted" />}
          title={<SkeletonText width="16ch" />}
          description={<SkeletonText width="34ch" />}
          className="animate-none!"
        />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState
          icon={<LayoutList aria-hidden className="size-8 text-muted" />}
          title={t("classic.charts.empty")}
          description={t("classic.charts.emptyHint")}
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
                href={`/biz/payroll/charts/${c.id}`}
                className="flex-1 min-w-0 py-1 flex items-center gap-2"
              >
                <p className="truncate font-medium text-fg">{c.name}</p>
                <Badge tone={c.type === "planned" ? "info" : "neutral"}>
                  {t(`classic.charts.type.${c.type}`)}
                </Badge>
              </Link>
              {access.schemesAccess && (
                <IconButton
                  icon={<Trash2 aria-hidden className="size-4" />}
                  label={t("classic.charts.deleteConfirm")}
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
