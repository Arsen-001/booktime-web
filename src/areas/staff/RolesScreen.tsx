"use client";

/**
 * /biz/staff/roles — «Роли и права» (С19 обзора «Сотрудники», 27.09.2026: пункт меню вёл на заглушку «скоро»).
 * Готовые роли (F-10-053…061): сколько людей на каждой и кто, что роль разрешает. Правка прав роли применяется ко
 * всем её сотрудникам разом (applyRoleRights) — тонкая настройка одного человека остаётся в его карточке.
 * Права по разделам — грубые права фундамента; подпись — первые строки каталога тонких прав, сведённых к нему.
 */
import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { applyRoleRights, listRoleSummaries } from "@/api/staff";
import { useApiMutation, useApiQuery } from "@/api/request";
import { NoAccessState } from "@/areas/staff/components/NoAccessState";
import { ROLE_TEMPLATE_COARSE } from "@/areas/staff/permissions/roleDefaults";
import { ALL_FINE_PERMISSIONS, STANDALONE_PERMISSIONS } from "@/areas/staff/permissions/catalog";
import { PERMISSIONS, type Permission } from "@/config/permissions";
import { useCan, useCurrent, useTerms } from "@/demo/hooks";
import { ROLE_TEMPLATES, roleTemplateLabel, type StaffRoleTemplateId } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { SkeletonText } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

const GROUPS = [
  "journal",
  "clients",
  "schedule",
  "services",
  "staff",
  "online",
  "notify",
  "loyalty",
  "finance",
  "stock",
  "payroll",
  "resources",
  "reports",
  "network",
  "integrations",
  "settings",
  "billing",
] as const;

const ROLE_PERMISSIONS = PERMISSIONS.filter((p) => p !== "platform.access");

function labelOf(perm: Permission, locale: string): string {
  const items = [...ALL_FINE_PERMISSIONS, ...STANDALONE_PERMISSIONS].filter((i) => i.perm === perm);
  const pick = (i: (typeof items)[number]) => (locale === "en" ? i.label.en : i.label.ru);
  if (!items.length) return perm;
  return items.length > 1 ? `${pick(items[0])} +${items.length - 1}` : pick(items[0]);
}

export function RolesScreen() {
  const t = useT("staff");
  const { ready, businessId } = useCurrent();
  const canManage = useCan("staff.manage");
  const canView = useCan("staff.view");
  const summariesQ = useApiQuery(["staff", "roles", businessId], () => listRoleSummaries(businessId ?? ""), {
    enabled: ready && Boolean(businessId),
  });
  const [openId, setOpenId] = useState<StaffRoleTemplateId | null>(null);

  if (ready && !canView) return <NoAccessState />;

  return (
    <div data-f="F-10-053 F-10-054 F-10-062" className="mx-auto flex w-full max-w-[760px] flex-col gap-4 md:gap-6">
      <PageHeader title={t("roles.title")} description={t("roles.subtitle")} />
      {summariesQ.isError ? (
        <ErrorState onRetry={summariesQ.refetch} />
      ) : (
        <ul className="flex flex-col gap-3">
          {ROLE_TEMPLATES.map((role) => (
            <RoleRow
              key={role.id}
              roleId={role.id}
              people={summariesQ.data?.find((s) => s.roleTemplateId === role.id)?.staff}
              loading={summariesQ.isLoading}
              open={openId === role.id}
              onToggle={() => setOpenId((v) => (v === role.id ? null : role.id))}
              canManage={canManage}
              businessId={businessId ?? ""}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RoleRow({
  roleId,
  people,
  loading,
  open,
  onToggle,
  canManage,
  businessId,
}: {
  roleId: StaffRoleTemplateId;
  people: { id: string; name: string }[] | undefined;
  loading: boolean;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  businessId: string;
}) {
  const t = useT("staff");
  const terms = useTerms();
  const [mounted, setMounted] = useState(false);
  const title = roleTemplateLabel(roleId, t(`roleTemplates.${roleId}.title` as never), terms.master);
  const count = people?.length ?? 0;
  return (
    <li className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setMounted(true);
          onToggle();
        }}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-fg">{title}</span>
          <span className="text-sm text-muted">{t(`roleTemplates.${roleId}.description` as never)}</span>
        </span>
        {/* Место под «N человек» одной ширины при любом числе и до загрузки — описание слева не переносится иначе */}
        <span className="min-w-[11ch] shrink-0 text-right text-sm text-muted tabular-nums">
          {loading ? <SkeletonText width="9ch" /> : t("roles.people", { n: count })}
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted transition-transform duration-150", open && "rotate-180")} />
      </button>
      {mounted && (
        <div hidden={!open} className="animate-fade-in border-t border-border p-4">
          <RoleBody roleId={roleId} people={people ?? []} canManage={canManage} businessId={businessId} />
        </div>
      )}
    </li>
  );
}

function RoleBody({
  roleId,
  people,
  canManage,
  businessId,
}: {
  roleId: StaffRoleTemplateId;
  people: { id: string; name: string }[];
  canManage: boolean;
  businessId: string;
}) {
  const t = useT("staff");
  const toast = useToast();
  const locale = useLocale();
  const template = ROLE_TEMPLATE_COARSE[roleId];
  const [draft, setDraft] = useState<Permission[]>(template);
  const apply = useApiMutation((a: { businessId: string; roleId: StaffRoleTemplateId; coarse: Permission[] }) =>
    applyRoleRights(a.businessId, a.roleId, a.coarse),
  );
  const isOwner = roleId === "owner";
  const changed = [...draft].sort().join() !== [...template].sort().join();
  const toggle = (p: Permission, on: boolean) => setDraft((d) => (on ? [...new Set([...d, p])] : d.filter((x) => x !== p)));

  const doApply = async () => {
    try {
      const n = await apply.mutate({ businessId, roleId, coarse: draft });
      toast.success(t("roles.applied", { n }));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {people.length === 0 ? (
        <p className="text-sm text-muted">{t("roles.nobody")}</p>
      ) : (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {people.map((p) => (
            <Link key={p.id} href={`/biz/staff/${p.id}?tab=access`} className="font-medium text-primary-text hover:underline">
              {p.name}
            </Link>
          ))}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-fg">{t("roles.rights")}</p>
        {isOwner && <p className="text-sm text-muted">{t("roles.ownerHint")}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g) => {
            const perms = ROLE_PERMISSIONS.filter((p) => p.startsWith(`${g}.`));
            if (!perms.length) return null;
            return (
              <fieldset key={g} className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
                <legend className="px-1 text-[13px] font-semibold text-fg">{t(`roles.group.${g}` as never)}</legend>
                {perms.map((p) => (
                  <Checkbox
                    key={p}
                    checked={draft.includes(p)}
                    disabled={!canManage || isOwner}
                    onCheckedChange={(on) => toggle(p, on)}
                    label={<span className="text-sm">{labelOf(p, locale)}</span>}
                  />
                ))}
              </fieldset>
            );
          })}
        </div>
      </div>
      {canManage && !isOwner && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          {changed && <span className="text-sm text-warning">{t("roles.changedHint")}</span>}
          <Button variant="ghost" disabled={!changed} onClick={() => setDraft(template)}>
            {t("roles.reset")}
          </Button>
          <Button loading={apply.isPending} disabled={people.length === 0} onClick={() => void doApply()}>
            {t("roles.apply", { n: people.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
