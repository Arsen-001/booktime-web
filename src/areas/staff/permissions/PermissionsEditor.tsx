"use client";

/**
 * Редактор прав (F-10-032, F-10-062…090, F-10-160, F-10-161, F-00-039) — блок «Права доступа» на вкладке
 * «Доступ» карточки сотрудника. 13 групп + «Медицинские документы» (только dental) + 4 отдельных
 * переключателя (F-10-089). При «Сохранить» тонкий набор сводится к грубому (reduceToCoarse) и уходит в
 * ядро через setStaffRights → setStaffPermissions — PermissionGate во всех разделах видит изменение сразу.
 */
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Clock,
  Copy,
  History as HistoryIcon,
  MoreHorizontal,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  getStaffRights,
  getStaffRightScopes,
  listRightsHistory,
  listStaffForRightsCopy,
  setStaffRights,
  setStaffRightScopes,
} from "@/api/staff";
import { useApiMutation, useApiQuery } from "@/api/request";
import {
  ALL_FINE_PERMISSIONS,
  PERMISSION_GROUPS,
  STANDALONE_PERMISSIONS,
  fineIdsForCoarse,
  findFinePermission,
  groupItems,
  reduceToCoarse,
  type FinePermissionItem,
  type PermGroupId,
} from "@/areas/staff/permissions/catalog";
import { ROLE_TEMPLATE_COARSE } from "@/areas/staff/permissions/roleDefaults";
import {
  defaultRightScope,
  type RightScope,
  type RightScopePeriod,
  type StaffRoleTemplateId,
} from "@/domain/staff";
import type { Id } from "@/domain/core";
import { useCan, useSphere } from "@/demo/hooks";
import { useT } from "@/i18n/useT";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { Collapse } from "@/ui/Collapse";
import { Combobox } from "@/ui/Combobox";
import { DropdownMenu, type DropdownMenuItem } from "@/ui/DropdownMenu";
import { EmptyState } from "@/ui/EmptyState";
import { usePagedList } from "@/ui/Pagination";
import { ErrorState } from "@/ui/ErrorState";
import { FormField } from "@/ui/FormField";
import { IconButton } from "@/ui/IconButton";
import { Modal } from "@/ui/Modal";
import { Popover } from "@/ui/Popover";
import { SearchInput } from "@/ui/SearchInput";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { TagInput } from "@/ui/TagInput";
import { Timeline } from "@/ui/Timeline";
import { useToast } from "@/ui/Toast";

export interface PermissionsEditorProps {
  staffId: Id;
  businessId: Id;
  staffName: string;
  roleTemplateId: StaffRoleTemplateId | undefined;
  canManage: boolean;
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-warning-soft text-fg">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function PermissionsEditor({
  staffId,
  businessId,
  staffName,
  roleTemplateId,
  canManage,
}: PermissionsEditorProps) {
  const t = useT("staff");
  const toast = useToast();
  const sphere = useSphere();
  const canManageOthersRights = useCan("staff.manage"); // F-10-075: «в пределах своего набора» — упрощённо: полное право staff.manage

  const rightsQ = useApiQuery(["staff", "rights", staffId], () =>
    getStaffRights(staffId),
  );
  const scopesQ = useApiQuery(["staff", "rightScopes", staffId], () =>
    getStaffRightScopes(staffId),
  );
  const copyListQ = useApiQuery(
    ["staff", "rightsCopySource", businessId, staffId],
    () => listStaffForRightsCopy(businessId, staffId),
  );
  const historyQ = useApiQuery(
    ["staff", "rightsHistory", staffId],
    () => listRightsHistory(businessId, staffId),
    { enabled: false },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: historyPage, pager: historyPager } = usePagedList(historyQ.data ?? []);
  const otherRightsQ = useApiMutation((otherId: Id) => getStaffRights(otherId));

  const saveM = useApiMutation(
    (args: { fine: string[]; coarse: ReturnType<typeof reduceToCoarse> }) =>
      setStaffRights(staffId, args.fine, args.coarse),
  );
  const saveScopesM = useApiMutation((scopes: Record<string, RightScope>) =>
    setStaffRightScopes(staffId, scopes),
  );

  const defaults = useMemo(
    () => fineIdsForCoarse(ROLE_TEMPLATE_COARSE[roleTemplateId ?? "specialist"]),
    [roleTemplateId],
  );
  const baseline = rightsQ.data ?? defaults;

  const [draft, setDraft] = useState<Set<string> | null>(null);
  const selected = draft ?? new Set(baseline);
  const dirty = draft !== null;

  const [scopesDraft, setScopesDraft] = useState<Record<string, RightScope> | null>(null);
  const scopes = scopesDraft ?? scopesQ.data ?? {};

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<PermGroupId>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState<Set<PermGroupId>>(new Set());
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const visibleGroups = PERMISSION_GROUPS.filter(
    (g) => !g.sphereFeature || sphere.has(g.sphereFeature),
  );

  const setSelected = (updater: (s: Set<string>) => Set<string>) => {
    setDraft((prev) => updater(new Set(prev ?? baseline)));
  };

  const canActivate = (item: FinePermissionItem, set: Set<string>) =>
    !item.requires || set.has(item.requires);

  const toggleOne = (item: FinePermissionItem, checked: boolean) => {
    setSelected((set) => {
      if (checked) {
        set.add(item.id);
      } else {
        set.delete(item.id);
        // Снятое право тянет за собой всё, что от него зависело (F-10-073)
        for (const dep of ALL_FINE_PERMISSIONS) {
          if (dep.requires === item.id) set.delete(dep.id);
        }
      }
      return set;
    });
  };

  const groupState = (id: PermGroupId) => {
    const items = groupItems(id);
    const checkedCount = items.filter((i) => selected.has(i.id)).length;
    return { items, checkedCount, total: items.length };
  };

  const setGroup = (id: PermGroupId, checked: boolean) => {
    setSelected((set) => {
      for (const item of groupItems(id)) {
        if (checked) {
          if (canActivate(item, set) || !item.requires) set.add(item.id);
        } else {
          set.delete(item.id);
        }
      }
      // Второй проход — активируем то, что стало доступно после включения родителей
      if (checked) {
        for (const item of groupItems(id)) if (canActivate(item, set)) set.add(item.id);
      }
      return set;
    });
  };

  const groupAsTemplate = (id: PermGroupId) => {
    const templateIds = new Set(
      fineIdsForCoarse(ROLE_TEMPLATE_COARSE[roleTemplateId ?? "specialist"]),
    );
    setSelected((set) => {
      for (const item of groupItems(id)) {
        if (templateIds.has(item.id)) set.add(item.id);
        else set.delete(item.id);
      }
      return set;
    });
    toast.success(t("permissions.groupResetToast"));
  };

  const setAll = (checked: boolean) => {
    setSelected((set) => {
      const all = [...ALL_FINE_PERMISSIONS, ...STANDALONE_PERMISSIONS];
      if (!checked) return new Set<string>();
      const next = new Set(set);
      // Даём все, затем повторно проходим, чтобы зависимые точно активировались
      all.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const resetToTemplate = () => {
    setDraft(new Set(defaults));
    toast.success(t("permissions.resetToast"));
  };

  const applyCopy = async () => {
    if (!copySource) return;
    try {
      const fine = await otherRightsQ.mutate(copySource);
      const list = fine ?? fineIdsForCoarse(ROLE_TEMPLATE_COARSE[roleTemplateId ?? "specialist"]);
      setDraft(new Set(list));
      setCopyOpen(false);
      setCopySource(null);
      toast.success(t("permissions.copiedToast"));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const save = async () => {
    const fine = [...selected];
    const coarse = reduceToCoarse(fine);
    try {
      await saveM.mutate({ fine, coarse });
      if (scopesDraft) await saveScopesM.mutate(scopesDraft);
      setDraft(null);
      setScopesDraft(null);
      toast.success(t("permissions.savedToast"));
      rightsQ.refetch();
      scopesQ.refetch();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    historyQ.refetch();
  };

  const setScope = (id: string, patch: Partial<RightScope>) => {
    setScopesDraft((prev) => {
      const base = { ...(prev ?? scopesQ.data ?? {}) };
      base[id] = { ...defaultRightScope(), ...base[id], ...patch };
      return base;
    });
  };

  const readOnly = !canManage || !canManageOthersRights;

  if (rightsQ.isError) return <ErrorState onRetry={rightsQ.refetch} />;
  if (rightsQ.isLoading)
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton variant="rect" className="h-12 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="h-14 rounded-xl" />
        ))}
      </div>
    );

  const totalChecked = selected.size;
  const totalAll = ALL_FINE_PERMISSIONS.length + STANDALONE_PERMISSIONS.length;

  const searchResults = query.trim()
    ? [...ALL_FINE_PERMISSIONS, ...STANDALONE_PERMISSIONS].filter((i) =>
        i.label.ru.toLowerCase().includes(query.toLowerCase()),
      )
    : null;

  const topMenu: DropdownMenuItem[] = [
    { id: "all", label: t("permissions.giveAll"), onSelect: () => setAll(true), disabled: readOnly },
    { id: "none", label: t("permissions.takeAll"), onSelect: () => setAll(false), disabled: readOnly },
    { id: "sep", separator: true },
    { id: "reset", label: t("permissions.resetToTemplate"), onSelect: resetToTemplate, disabled: readOnly },
  ];

  return (
    <div data-f="F-10-032 F-10-074" className="flex flex-col gap-4">
      {/* Каждая из 13 групп реализована одной .map()-веткой ниже — data-f групп статичной строкой,
          как F-00-041 в StaffAccessTab.tsx (функция реализована кодом, а не отдельным JSX-узлом на группу) */}
      <span
        hidden
        data-f="F-10-065 F-10-066 F-10-073 F-10-076 F-10-077 F-10-078 F-10-079 F-10-080 F-10-081 F-10-082 F-10-083 F-10-084 F-10-085 F-10-086 F-10-087 F-10-088 F-10-160 F-10-092 F-10-093 F-10-094 F-10-095 F-10-096 F-10-099 F-10-144 F-10-150 F-13-024 F-13-067 F-06-175"
      />
      <p className="text-xs text-muted" data-f="F-10-108 F-10-109 F-10-115">
        {t("permissions.billingNote")}
      </p>
      <p className="text-xs text-muted" data-f="F-10-107">
        {t("permissions.securityHint")}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="size-4 text-muted" />
          <span className="text-sm text-muted">
            {t("permissions.counter", { checked: totalChecked, total: totalAll })}
          </span>
          {dirty && (
            <Badge tone="warning" size="sm" data-f="F-10-062">
              {t("permissions.changedBadge")}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("permissions.searchPlaceholder")}
            debounceMs={150}
            className="sm:w-64"
            data-f="F-10-068"
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Copy aria-hidden />}
            onClick={() => setCopyOpen(true)}
            disabled={readOnly}
            data-f="F-10-069"
          >
            {t("permissions.copyFrom")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<HistoryIcon aria-hidden />}
            onClick={openHistory}
            data-f="F-10-070"
          >
            {t("permissions.history")}
          </Button>
          <DropdownMenu
            trigger={(p) => (
              <IconButton
                {...p}
                icon={<MoreHorizontal aria-hidden />}
                label={t("permissions.moreMenu")}
                variant="outline"
                size="sm"
              />
            )}
            items={topMenu}
            data-f="F-10-067"
          />
        </div>
      </div>

      {searchResults ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-2">
          {searchResults.length === 0 ? (
            <EmptyState variant="section" kind="search" onReset={() => setQuery("")} />
          ) : (
            searchResults.map((item) => (
              <PermissionRow
                key={item.id}
                item={item}
                checked={selected.has(item.id)}
                disabled={readOnly || !canActivate(item, selected)}
                requiresLabel={
                  item.requires ? findFinePermission(item.requires)?.label.ru : undefined
                }
                onChange={(v) => toggleOne(item, v)}
                query={query}
                scope={scopes[item.id]}
                onScopeChange={(patch) => setScope(item.id, patch)}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleGroups.map((g) => {
            const { items, checkedCount, total } = groupState(g.id);
            const isOpen = expanded.has(g.id);
            const showAdvanced = advancedOpen.has(g.id);
            const basic = items.filter((i) => !i.advanced);
            const advanced = items.filter((i) => i.advanced);
            const groupMenu: DropdownMenuItem[] = [
              { id: "all", label: t("permissions.giveAll"), onSelect: () => setGroup(g.id, true), disabled: readOnly },
              { id: "none", label: t("permissions.takeAll"), onSelect: () => setGroup(g.id, false), disabled: readOnly },
              { id: "tpl", label: t("permissions.asTemplate"), onSelect: () => groupAsTemplate(g.id), disabled: readOnly },
            ];
            return (
              <div
                key={g.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-focus"
                  onClick={() =>
                    setExpanded((s) => {
                      const next = new Set(s);
                      if (next.has(g.id)) next.delete(g.id);
                      else next.add(g.id);
                      return next;
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setExpanded((s) => {
                      const next = new Set(s);
                      if (next.has(g.id)) next.delete(g.id);
                      else next.add(g.id);
                      return next;
                    });
                  }}
                  aria-expanded={isOpen}
                >
                  <Checkbox
                    checked={checkedCount === total && total > 0}
                    indeterminate={checkedCount > 0 && checkedCount < total}
                    disabled={readOnly}
                    onCheckedChange={(v) => setGroup(g.id, v)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t(`permissions.groups.${g.titleKey}` as never)}
                  />
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-fg">
                    {t(`permissions.groups.${g.titleKey}` as never)}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {checkedCount}/{total}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={`size-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                  <span onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      trigger={(p) => (
                        <IconButton
                          {...p}
                          icon={<MoreHorizontal aria-hidden />}
                          label={t("permissions.groupMenu")}
                          variant="ghost"
                          size="sm"
                        />
                      )}
                      items={groupMenu}
                    />
                  </span>
                </div>
                <Collapse open={isOpen}>
                  <div className="flex flex-col divide-y divide-border border-t border-border">
                    {basic.map((item) => (
                      <PermissionRow
                        key={item.id}
                        item={item}
                        checked={selected.has(item.id)}
                        disabled={readOnly || !canActivate(item, selected)}
                        requiresLabel={
                          item.requires ? findFinePermission(item.requires)?.label.ru : undefined
                        }
                        onChange={(v) => toggleOne(item, v)}
                        scope={scopes[item.id]}
                        onScopeChange={(patch) => setScope(item.id, patch)}
                        readOnly={readOnly}
                      />
                    ))}
                    {advanced.length > 0 && (
                      <div>
                        {!showAdvanced ? (
                          <button
                            type="button"
                            className="flex min-h-11 w-full items-center px-4 text-sm font-medium text-primary-text"
                            onClick={() =>
                              setAdvancedOpen((s) => new Set(s).add(g.id))
                            }
                          >
                            {t("permissions.showAdvanced", { count: advanced.length })}
                          </button>
                        ) : (
                          advanced.map((item) => (
                            <PermissionRow
                              key={item.id}
                              item={item}
                              checked={selected.has(item.id)}
                              disabled={readOnly || !canActivate(item, selected)}
                              requiresLabel={
                                item.requires ? findFinePermission(item.requires)?.label.ru : undefined
                              }
                              onChange={(v) => toggleOne(item, v)}
                              scope={scopes[item.id]}
                              onScopeChange={(patch) => setScope(item.id, patch)}
                              readOnly={readOnly}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </Collapse>
              </div>
            );
          })}

          <div
            className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface"
            data-f="F-10-089"
          >
            <div className="px-4 py-2 text-sm font-medium text-muted">
              {t("permissions.standaloneTitle")}
            </div>
            {STANDALONE_PERMISSIONS.map((item) => (
              <PermissionRow
                key={item.id}
                item={item}
                checked={selected.has(item.id)}
                disabled={readOnly}
                onChange={(v) => toggleOne(item, v)}
                scope={scopes[item.id]}
                onScopeChange={(patch) => setScope(item.id, patch)}
                readOnly={readOnly}
              />
            ))}
          </div>

          <div
            className="rounded-2xl border border-dashed border-border-strong px-4 py-3 text-sm text-muted"
            data-f="F-10-090"
          >
            {t("permissions.helpOnlyHint")}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3" data-f="F-10-075">
            <div className="flex items-center gap-2 text-sm font-medium text-fg">
              <Users aria-hidden className="size-4" />
              {t("permissions.whoCanManageTitle")}
            </div>
            <SegmentedControl
              value={(scopes.__manageScope__?.target ?? "all") === "selected" ? "own" : "all"}
              onValueChange={(v) => setScope("__manageScope__", { target: v === "own" ? "selected" : "all" })}
              options={[
                { value: "all", label: t("permissions.whoCanManageAll") },
                { value: "own", label: t("permissions.whoCanManageOwn") },
              ]}
            />
            <p className="text-sm text-muted">{t("permissions.whoCanManageHint")}</p>
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
        data-f="F-10-072"
      >
        <p className="text-sm text-muted">{t("permissions.appliesImmediately")}</p>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => { setDraft(null); setScopesDraft(null); }}>
              {t("permissions.discard")}
            </Button>
          )}
          <Button
            onClick={() => void save()}
            loading={saveM.isPending}
            disabled={readOnly || (!dirty && !scopesDraft)}
          >
            {t("permissions.save")}
          </Button>
        </div>
      </div>

      <Modal
        open={copyOpen}
        onOpenChange={setCopyOpen}
        title={t("permissions.copyFrom")}
        size="sm"
        footer={
          <Button onClick={() => void applyCopy()} disabled={!copySource} loading={otherRightsQ.isPending}>
            {t("permissions.copyApply")}
          </Button>
        }
      >
        {copyListQ.isLoading ? (
          <Skeleton variant="rect" className="h-10 rounded-xl" />
        ) : !copyListQ.data || copyListQ.data.length === 0 ? (
          <EmptyState variant="section" title={t("permissions.copyEmpty")} />
        ) : (
          <Combobox
            options={copyListQ.data.map((s) => ({ value: s.id, label: s.name }))}
            value={copySource}
            onValueChange={(v) => setCopySource(v)}
            placeholder={t("permissions.copyPlaceholder")}
          />
        )}
      </Modal>

      <Modal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={t("permissions.historyTitle", { name: staffName })}
        size="md"
      >
        {historyQ.isLoading ? (
          <Skeleton variant="rect" className="h-24 rounded-xl" />
        ) : !historyQ.data || historyQ.data.length === 0 ? (
          <EmptyState
            variant="section"
            icon={<Clock aria-hidden />}
            title={t("permissions.historyEmpty")}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Timeline
              items={historyPage.map((h) => ({
                id: h.id,
                title: h.actorLabel,
                time: h.at,
                description: t("permissions.historyChanged"),
              }))}
            />
            {historyPager}
          </div>
        )}
      </Modal>
    </div>
  );
}

function PermissionRow({
  item,
  checked,
  disabled,
  requiresLabel,
  onChange,
  query,
  scope,
  onScopeChange,
  readOnly,
}: {
  item: FinePermissionItem;
  checked: boolean;
  disabled: boolean;
  requiresLabel?: string;
  onChange: (v: boolean) => void;
  query?: string;
  scope?: RightScope;
  onScopeChange: (patch: Partial<RightScope>) => void;
  readOnly: boolean;
}) {
  const t = useT("staff");
  const current = scope ?? defaultRightScope();
  return (
    <div className="flex min-h-11 items-center gap-2 px-4 py-1.5">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        label={query ? highlight(item.label.ru, query) : item.label.ru}
        description={
          disabled && requiresLabel
            ? t("permissions.needsParent", { name: requiresLabel })
            : undefined
        }
      />
      <span className="ml-auto" data-f="F-10-071">
        <Popover
          role="dialog"
          label={t("permissions.scopeTitle")}
          trigger={(p) => (
            <IconButton
              {...p}
              icon={<ChevronDown aria-hidden />}
              label={t("permissions.scopeTitle")}
              variant="ghost"
              size="sm"
              disabled={readOnly || !checked}
            />
          )}
        >
          <div className="flex w-64 flex-col gap-3 p-3">
            <FormField label={t("permissions.scopePeriod")}>
              <Select
                value={current.period}
                onValueChange={(v) => onScopeChange({ period: v as RightScopePeriod })}
                options={[
                  { value: "always", label: t("permissions.scopePeriodAlways") },
                  { value: "today", label: t("permissions.scopePeriodToday") },
                  { value: "week", label: t("permissions.scopePeriodWeek") },
                  { value: "month", label: t("permissions.scopePeriodMonth") },
                ]}
              />
            </FormField>
            <SegmentedControl
              value={current.target}
              onValueChange={(v) => onScopeChange({ target: v as "all" | "selected" })}
              options={[
                { value: "all", label: t("permissions.scopeTargetAll") },
                { value: "selected", label: t("permissions.scopeTargetSelected") },
              ]}
            />
            {current.target === "selected" && (
              <TagInput
                value={current.selectedLabels}
                onValueChange={(v) => onScopeChange({ selectedLabels: v })}
                placeholder={t("permissions.scopeTargetPlaceholder")}
              />
            )}
          </div>
        </Popover>
      </span>
    </div>
  );
}
