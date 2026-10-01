"use client";

/**
 * /biz/staff/[staffId] — карточка сотрудника (хост расширений «staffCard», F-10-024…039, F-10-097/098/119/137,
 * F-00-045/046/048). Обзор «Сотрудники» 27.09.2026:
 *  - шапка — имя, маленькое фото и одна строка «должность · место»; плашки сбоку больше нет (С16);
 *  - 5 вкладок вместо 9 (С15): «Информация» (+ свёрнутые «Дополнительно» и «Юр. информация»), «Услуги»,
 *    «График и запись», «Зарплата», «Доступ и уведомления»; на телефоне — выпадающий список разделов;
 *  - одно правило сохранения (С2): поля формы — общей «Сохранить» с видимым «есть несохранённое» и вопросом при
 *    уходе; мгновенные переключатели — сами, с тихим «Сохранено ✓»;
 *  - «Уволить» — отдельной кнопкой внизу; «Удалить навсегда» — только в «Архиве» списка (С3, С4);
 *  - рамка, шапка и вкладки рисуются сразу (данные строки списка — cardSeed), у каждого блока свой скелет (М1, М2);
 *    открытая вкладка остаётся смонтированной — повторный заход её не пересоздаёт (М6).
 * Ширина — 760 px, как у всех форм кабинета (DESIGN.md → Page width).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarX2, RotateCcw, UserMinus } from "lucide-react";
import {
  applyDueDismissals,
  getStaffCard,
  restoreStaff,
  type StaffCardData,
  type StaffListRow,
} from "@/api/staff";
import { ApiError, useApiMutation, useApiQuery } from "@/api/request";
import { DismissStaffModal } from "@/areas/staff/components/DismissStaffModal";
import { NoAccessState } from "@/areas/staff/components/NoAccessState";
import { StaffAccessTab } from "@/areas/staff/components/card/StaffAccessTab";
import { StaffCardHeader } from "@/areas/staff/components/card/StaffCardHeader";
import { StaffClientPageSection } from "@/areas/staff/components/card/StaffClientPageSection";
import { StaffInfoTab, StaffInfoTabSkeleton } from "@/areas/staff/components/card/StaffInfoTab";
import { StaffOwnNotifyTab } from "@/areas/staff/components/card/StaffOwnNotifyTab";
import { StaffSetupPanel } from "@/areas/staff/components/card/StaffSetupPanel";
import { RevealWhenReady } from "@/areas/staff/components/card/RevealWhenReady";
import { CardFormProvider, CardSaveBar, useCardFormHost } from "@/areas/staff/components/card/cardForm";
import { useCan, useCurrent, useDemo } from "@/demo/hooks";
import { normalizeCardTab, type StaffCardTab } from "@/domain/staff";
import { ExtensionSlot } from "@/extensions/ExtensionSlot";
import { useExtensions } from "@/extensions/useExtensions";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { PageHeader } from "@/ui/PageHeader";
import { Select } from "@/ui/Select";
import { Skeleton, SkeletonText } from "@/ui/Skeleton";
import { Tabs, type TabItem } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";
import { useEscape } from "@/ui/hooks/useEscape";
import { useUnsavedGuard } from "@/ui/hooks/useUnsavedGuard";

export function StaffCardScreen() {
  const t = useT("staff");
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ staffId: string }>();
  const searchParams = useSearchParams();
  const staffId = params.staffId;
  const { ready, staffId: myStaffId, businessId, businessIds } = useCurrent();
  const { persona } = useDemo();
  const canManage = useCan("staff.manage");
  const canView = useCan("staff.view");
  const isOwnerLike = persona === "owner" || persona === "network" || persona === "individual";
  const isSelf = myStaffId === staffId;

  const cardQ = useApiQuery(["staff", "card", staffId], () => getStaffCard(staffId), {
    enabled: ready && Boolean(staffId),
  });
  const card = cardQ.data;
  const staff = card?.staff;

  const [tab, setTab] = useState<StaffCardTab>(() => normalizeCardTab(searchParams.get("tab")));
  const [visited, setVisited] = useState<StaffCardTab[]>(() => [normalizeCardTab(searchParams.get("tab"))]);
  const [setupOpen, setSetupOpen] = useState(() => searchParams.get("setup") === "1");
  const [dismissOpen, setDismissOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { form, dirty, saveAll } = useCardFormHost();
  const restoreM = useApiMutation(restoreStaff);
  const dueM = useApiMutation(applyDueDismissals);
  // Запланированное увольнение, чей день настал, вступает в силу (С3)
  useEffect(() => {
    if (ready && businessId) void dueM.mutate(businessId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, businessId]);

  const back = () => router.push("/biz/staff");
  const { confirmLeave } = useUnsavedGuard(dirty);
  useEscape(true, () => {
    void confirmLeave().then((ok) => ok && back());
  });

  const selectTab = (next: StaffCardTab) => {
    setTab(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAll();
      toast.success(t("cardView.saved"));
    } catch {
      toast.error(t("cardView.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const doRestore = async (successKey: "toast.restored" | "toast.dismissalCancelled") => {
    try {
      await restoreM.mutate(staffId);
      toast.success(t(successKey, { name: staff?.name ?? "" }));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  const extensions = useExtensions("staffCard");
  const extensionFor = (area: string) => extensions.find((e) => e.area === area);
  const scheduleExt = extensionFor("schedule");
  const onlineExt = extensionFor("online");
  const payrollExt = extensionFor("payroll");
  const servicesExt = extensionFor("services");
  const notifyExt = extensionFor("notify");

  if (cardQ.isError) {
    const isDeleted = cardQ.error instanceof ApiError && cardQ.error.code === "not_found";
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t("title")} back={{ href: "/biz/staff", label: t("cardView.back") }} />
        {isDeleted ? (
          <EmptyState title={t("cardView.deletedTitle")} description={t("cardView.deletedText")} />
        ) : (
          <ErrorState onRetry={cardQ.refetch} />
        )}
      </div>
    );
  }

  if (ready && !canView && !isSelf) return <NoAccessState />;
  // Карточка чужого бизнеса по прямой ссылке (id из другого салона) — не показываем и не даём править
  if (ready && staff && !businessIds.includes(staff.businessId)) return <NoAccessState />;

  const tabs: TabItem[] = [
    { value: "info", label: t("cardView.tabs.info") },
    ...(servicesExt
      ? [{ value: "services", label: t("cardView.tabs.services"), badge: !card ? <SkeletonText width="2ch" /> : staff?.serviceIds.length || undefined }]
      : []),
    ...(scheduleExt || onlineExt ? [{ value: "schedule", label: t("cardView.tabs.schedule") }] : []),
    ...(payrollExt ? [{ value: "payroll", label: t("cardView.tabs.payroll") }] : []),
    { value: "access", label: t("cardView.tabs.access") },
  ];
  const activeTab = (tabs.some((x) => x.value === tab) ? tab : "info") as StaffCardTab;
  const mounted = visited.includes(activeTab) ? visited : [...visited, activeTab];

  const slot = (entry: ReturnType<typeof extensionFor>, f: string) =>
    entry && staff ? (
      <div data-f={f}>
        <ExtensionSlot entry={entry} props={{ staffId, businessId: staff.businessId }} />
      </div>
    ) : null;

  const panel = (value: StaffCardTab): ReactNode => {
    if (!card || !staff)
      return value === "info" ? (
        <StaffInfoTabSkeleton canEdit={canManage || isSelf} showExtra={isOwnerLike} showLegal={canManage} />
      ) : (
        <PanelSkeleton />
      );
    switch (value) {
      case "info":
        return (
          <StaffInfoTab
            staff={staff}
            businessName={card.businessName}
            canEdit={canManage || isSelf}
            showExtra={isOwnerLike}
            showLegal={canManage}
          />
        );
      case "services":
        return slot(servicesExt, "F-10-027") ?? <EmptyState compact title={t("cardView.tabPending")} />;
      case "schedule":
        return (
          <RevealWhenReady estimate={2200}>
          <div className="flex flex-col gap-5">
            {slot(scheduleExt, "F-10-030")}
            {slot(onlineExt, "F-10-028")}
            <StaffClientPageSection card={card} canEdit={canManage || isSelf} onOpenInfo={() => selectTab("info")} />
          </div>
          </RevealWhenReady>
        );
      case "payroll":
        return slot(payrollExt, "F-10-029") ?? <EmptyState compact title={t("cardView.tabPending")} />;
      case "access":
        return (
          <RevealWhenReady estimate={canManage && staff.role !== "owner" ? 1700 : 700}>
          <div className="flex flex-col gap-6">
            {canManage && staff.role !== "owner" && (
              <StaffAccessTab staffId={staffId} canManage={canManage} onOpenInfo={() => selectTab("info")} />
            )}
            <section data-f="F-10-033 F-10-097 F-10-119 F-13-094" className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-fg">{t("cardView.notifyTitle")}</h2>
              {notifyExt && canManage ? (
                <ExtensionSlot entry={notifyExt} props={{ staffId, businessId: staff.businessId }} />
              ) : notifyExt && isSelf ? (
                <StaffOwnNotifyTab staffId={staffId} />
              ) : (
                <EmptyState compact title={t("cardView.notifyForbidden")} />
              )}
            </section>
          </div>
          </RevealWhenReady>
        );
    }
  };

  const fireControl =
    canManage && !card ? (
      // Пока карточка читается — «Уволить» на своём месте (неактивна): панель сохранения не перестраивается
      <Button variant="outline" size="sm" className="text-danger hover:text-danger" leftIcon={<UserMinus aria-hidden />} disabled>
        {t("cardView.fire")}
      </Button>
    ) : canManage && staff && staff.role !== "owner" ? (
      staff.status === "fired" ? (
        <Button variant="outline" size="sm" leftIcon={<RotateCcw aria-hidden />} loading={restoreM.isPending} onClick={() => void doRestore("toast.restored")}>
          {t("cardView.restore")}
        </Button>
      ) : card?.dismissal?.scheduled ? (
        <Button variant="outline" size="sm" leftIcon={<CalendarX2 aria-hidden />} loading={restoreM.isPending} onClick={() => void doRestore("toast.dismissalCancelled")}>
          {t("cardView.cancelDismissal")}
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="text-danger hover:text-danger" leftIcon={<UserMinus aria-hidden />} onClick={() => setDismissOpen(true)}>
          {t("cardView.fire")}
        </Button>
      )
    ) : undefined;

  const dismissRow: StaffListRow | null =
    dismissOpen && card
      ? {
          staff: card.staff,
          order: 0,
          seat: card.seat,
          positionLabel: card.positionLabel,
          scheduleUntil: card.scheduleUntil,
          servicesCount: card.staff.serviceIds.length,
          dismissal: card.dismissal,
        }
      : null;

  return (
    <CardFormProvider form={form}>
      <div data-f="F-10-024 F-10-039 F-00-045 F-00-046 F-00-048" className="mx-auto flex w-full max-w-[760px] flex-col gap-5 pb-24 lg:pb-6">
        {/* Вкладки-вклады других разделов (метки на самих слотах — строятся из переменной, сканер их не видит) */}
        <span data-f="F-10-027 F-10-028 F-10-029 F-10-030" hidden />
        <StaffCardHeader card={card} onSetup={() => setSetupOpen(true)} />

        {setupOpen && card && staff?.status !== "fired" && (
          <StaffSetupPanel
            card={card}
            onDone={() => {
              setSetupOpen(false);
              if (searchParams.get("setup")) router.replace(`/biz/staff/${staffId}`);
            }}
            onOpenSchedule={() => selectTab("schedule")}
          />
        )}

        <div>
          <div className="max-md:hidden">
            <Tabs items={tabs} value={activeTab} onValueChange={(v) => selectTab(v as StaffCardTab)} />
          </div>
          <div className="md:hidden">
            <Select
              aria-label={t("cardView.section")}
              value={activeTab}
              onValueChange={(v) => selectTab(v as StaffCardTab)}
              options={tabs.map((x) => ({ value: x.value, label: typeof x.label === "string" ? x.label : x.value }))}
            />
          </div>
        </div>

        {tabs
          .map((x) => x.value as StaffCardTab)
          .filter((v) => mounted.includes(v))
          .map((v) => (
            <div key={v} role="tabpanel" aria-label={tabs.find((x) => x.value === v)?.label as string} hidden={v !== activeTab}>
              {panel(v)}
            </div>
          ))}

        {activeTab === "info" && (
          <CardSaveBar dirty={dirty} saving={saving} onSave={() => void handleSave()} secondary={fireControl} canEdit={canManage || isSelf} />
        )}

        <DismissStaffModal row={dismissRow} onOpenChange={setDismissOpen} onDismissed={() => undefined} />
      </div>
    </CardFormProvider>
  );
}

/** Скелет вкладок-вкладов (график, услуги, доступ) — их разметку строят другие разделы */
function PanelSkeleton() {
  return (
    <div data-skeleton className="flex flex-col gap-4" aria-busy>
      <Skeleton variant="rect" className="h-48 rounded-2xl" />
      <Skeleton variant="rect" className="h-32 rounded-2xl" />
    </div>
  );
}
