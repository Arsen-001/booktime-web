"use client";

/**
 * /biz/network/clients/[phone] — карточка клиента сети (F-11-045…050): данные по каждой посещённой локации,
 * доп. поля, история визитов по всей сети, отправленные сообщения, лояльность (выдать карту/начислить —
 * F-11-049) и счета клиентов (только просмотр — пополнение только в локации, F-11-050).
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bell, CalendarPlus, CreditCard, History, ListPlus, UserRound, Wallet } from "lucide-react";
import { setLocationId as selectHeaderLocation } from "@/demo/store";
import { DropdownMenu } from "@/ui/DropdownMenu";
import {
  listNetworkLocations,
  getNetworkClientCard,
  getNetworkClientHistory,
  getNetworkClientMessages,
  listNetworkMarketingOptOut,
  setNetworkMarketingOptOut,
} from "@/api/network";
import {
  adjustCardBalance,
  deleteCard,
  issueCard,
  listCardTypes,
  listCards,
  listClientAccounts,
} from "@/api/loyalty";
import { useApiMutation, useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { nowDateTime } from "@/lib/date";
import { useFormat } from "@/i18n/useFormat";
import { formatPhone } from "@/lib/phone";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { PageHeader } from "@/ui/PageHeader";
import { usePagedList } from "@/ui/Pagination";
import { SectionCard } from "@/ui/SectionCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { Select } from "@/ui/Select";
import { Skeleton } from "@/ui/Skeleton";
import { Switch } from "@/ui/Switch";
import { Tabs, type TabItem } from "@/ui/Tabs";
import { useToast } from "@/ui/Toast";
import { useNetwork } from "@/areas/network/lib/useNetwork";

type Tab = "about" | "fields" | "history" | "messages" | "loyalty" | "accounts";

export function ClientCardScreen() {
  const t = useT("network");
  const format = useFormat();
  const toast = useToast();
  const params = useParams<{ phone: string }>();
  const phone = decodeURIComponent(params.phone);
  const { ready, networkId, isError, refetch } = useNetwork();
  const [tab, setTab] = useState<Tab>("about");
  const [locationId, setLocationId] = useState<string | null>(null);
  const router = useRouter();
  // Сеть14: записать клиента сети в любой филиал — филиал выбирается в шапке, журнал открывается на нём
  const branchesQ = useApiQuery(["network", "locations", networkId], () => listNetworkLocations(networkId!), {
    enabled: ready && Boolean(networkId),
  });

  const cardQ = useApiQuery(
    ["network", "clientCard", networkId, phone],
    () => getNetworkClientCard(networkId!, phone),
    { enabled: ready && Boolean(networkId) },
  );
  const card = cardQ.data;
  const activeLocationId = locationId ?? card?.byLocation[0]?.businessId ?? null;

  // F-11-058: согласие на рекламные рассылки — «Не отправлять» исключает клиента из сетевой рассылки
  const optOutQ = useApiQuery(
    ["network", "marketingOptOut", networkId],
    () => listNetworkMarketingOptOut(networkId!),
    { enabled: ready && Boolean(networkId) },
  );
  const setOptOut = useApiMutation(
    (args: { phone: string; optOut: boolean }) =>
      setNetworkMarketingOptOut(args.phone, args.optOut),
  );
  const isOptedOut = (optOutQ.data ?? []).includes(phone);

  if (isError || cardQ.isError) {
    const notFound = cardQ.isError;
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("clientCard.title")}
          back={{ href: "/biz/network/clients", label: t("clientCard.back") }}
        />
        {notFound ? (
          <ErrorState title={t("clientCard.notFound")} description={t("clientCard.notFoundText")} />
        ) : (
          <ErrorState onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  if (!ready || cardQ.isLoading || !card) {
    return (
      <div className="flex w-full flex-col gap-6" aria-busy>
        <PageHeader title={t("clientCard.title")} back={{ href: "/biz/network/clients", label: t("clientCard.back") }} />
        <Skeleton variant="rect" className="h-40 rounded-2xl" />
        <Skeleton variant="rect" className="h-64 rounded-2xl" />
      </div>
    );
  }

  const tabs: TabItem[] = [
    { value: "about", label: t("clientCard.tabs.about"), icon: <UserRound aria-hidden /> },
    { value: "fields", label: t("clientCard.tabs.fields"), icon: <ListPlus aria-hidden /> },
    { value: "history", label: t("clientCard.tabs.history"), icon: <History aria-hidden /> },
    { value: "messages", label: t("clientCard.tabs.messages"), icon: <Bell aria-hidden /> },
    { value: "loyalty", label: t("clientCard.tabs.loyalty"), icon: <CreditCard aria-hidden /> },
    { value: "accounts", label: t("clientCard.tabs.accounts"), icon: <Wallet aria-hidden /> },
  ];

  return (
    <div data-f="F-11-045 F-11-046 F-11-047 F-11-048 F-11-049 F-11-050 F-11-059 F-04-183" className="flex w-full flex-col gap-6">
      <PageHeader
        title={card.name}
        description={formatPhone(card.phone)}
        back={{ href: "/biz/network/clients", label: t("clientCard.back") }}
        actions={
          <DropdownMenu
            trigger={(triggerProps) => (
              <Button {...triggerProps} size="sm" leftIcon={<CalendarPlus aria-hidden />}>
                {t("clientCard.bookInBranch")}
              </Button>
            )}
            items={(branchesQ.data ?? []).map((row) => ({
              id: row.business.id,
              label: row.business.name,
              onSelect: () => {
                const loc = row.location?.id ?? row.business.locationIds[0];
                if (loc) selectHeaderLocation(loc);
                // Журнал: ?new=1&phone= — окно новой записи с этим клиентом (в филиале найдётся по номеру)
                router.push(`/biz/journal?new=1&phone=${encodeURIComponent(card.phone)}&name=${encodeURIComponent(card.name)}`);
              },
            }))}
          />
        }
      />

      <Tabs items={tabs} value={tab} onValueChange={(v) => setTab(v as Tab)} />

      {tab === "about" && (
        <AboutTab
          card={card}
          format={format}
          t={t}
          optedOut={isOptedOut}
          onToggleOptOut={async (value) => {
            try {
              await setOptOut.mutate({ phone, optOut: value });
              optOutQ.refetch();
            } catch {
              toast.error(t("clientCard.optOutFailed"));
            }
          }}
        />
      )}
      {tab === "fields" && (
        <SectionCard title={t("clientCard.tabs.fields")}>
          <EmptyState compact icon={<ListPlus aria-hidden />} title={t("clientCard.fieldsEmpty")} />
        </SectionCard>
      )}
      {tab === "history" && networkId && (
        <HistoryTab networkId={networkId} phone={phone} />
      )}
      {tab === "messages" && networkId && (
        <MessagesTab networkId={networkId} phone={phone} />
      )}
      {tab === "loyalty" && (
        <LoyaltyTab
          byLocation={card.byLocation}
          activeLocationId={activeLocationId}
          onLocationChange={setLocationId}
          toast={toast}
        />
      )}
      {tab === "accounts" && (
        <AccountsTab
          byLocation={card.byLocation}
          activeLocationId={activeLocationId}
          onLocationChange={setLocationId}
        />
      )}
    </div>
  );
}

function LocationPicker({
  byLocation,
  activeLocationId,
  onLocationChange,
}: {
  byLocation: { businessId: string; businessName: string }[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
}) {
  if (byLocation.length <= 1) return null;
  return (
    <SegmentedControl
      options={byLocation.map((l) => ({ value: l.businessId, label: l.businessName }))}
      value={activeLocationId ?? byLocation[0].businessId}
      onValueChange={onLocationChange}
    />
  );
}

function AboutTab({
  card,
  format,
  t,
  optedOut,
  onToggleOptOut,
}: {
  card: Awaited<ReturnType<typeof getNetworkClientCard>>;
  format: ReturnType<typeof useFormat>;
  t: ReturnType<typeof useT<'network'>>;
  optedOut: boolean;
  onToggleOptOut: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t("clientCard.tabs.about")} padding="none">
        <div className="main-scrollbar overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2.5">{t("clientCard.colBranch")}</th>
                <th className="px-4 py-2.5">{t("clientCard.colCategory")}</th>
                <th className="px-4 py-2.5">{t("clientCard.colDiscount")}</th>
                <th className="px-4 py-2.5 text-right">{t("clientCard.colSpend")}</th>
              </tr>
            </thead>
            <tbody>
              {card.byLocation.map((row) => (
                <tr key={row.businessId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-fg">{row.businessName}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.discountPct ? `${row.discountPct}%` : "—"}</td>
                  <td className="px-4 py-3 text-right">{format.money(row.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div data-f="F-11-058">
        <SectionCard title={t("clientCard.marketingTitle")}>
          <Switch
            checked={optedOut}
            onCheckedChange={onToggleOptOut}
            label={t("clientCard.marketingOptOut")}
            description={t("clientCard.marketingOptOutHint")}
          />
        </SectionCard>
      </div>
    </div>
  );
}

function HistoryTab({ networkId, phone }: { networkId: string; phone: string }) {
  const t = useT("network");
  const format = useFormat();
  const q = useApiQuery(
    ["network", "clientHistory", networkId, phone],
    () => getNetworkClientHistory(networkId, phone),
  );
  // 01.10.2026: история — только прошедшие визиты; будущие записи — отдельным блоком «Предстоящие» над ней
  const now = nowDateTime();
  const all = q.data ?? [];
  const past = all.filter((r) => r.booking.start <= now);
  const upcoming = all.filter((r) => r.booking.start > now).reverse();
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(past);
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton lines={4} />;
  const row = (r: (typeof all)[number]) => (
    <li key={r.booking.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-fg">{format.dateTime(r.booking.start)}</span>
        <Badge tone="neutral" size="sm">
          {r.businessName}
        </Badge>
      </div>
      <span className="text-muted">
        {r.serviceNames.join(", ") || "—"} · {format.money(r.booking.total)}
      </span>
    </li>
  );
  return (
    <div className="flex flex-col gap-4">
      {upcoming.length > 0 && (
        <SectionCard title={t("clientCard.upcomingTitle")} padding="none">
          <ul className="divide-y divide-border">{upcoming.map(row)}</ul>
        </SectionCard>
      )}
      {!past.length ? (
        <SectionCard title={t("clientCard.tabs.history")}>
          <EmptyState compact icon={<History aria-hidden />} title={t("clientCard.historyEmpty")} />
        </SectionCard>
      ) : (
        <SectionCard title={t("clientCard.tabs.history")} padding="none">
          <ul className="divide-y divide-border">{pageItems.map(row)}</ul>
          {pager && <div className="border-t border-border px-4 py-3">{pager}</div>}
        </SectionCard>
      )}
    </div>
  );
}

function MessagesTab({ networkId, phone }: { networkId: string; phone: string }) {
  const t = useT("network");
  const format = useFormat();
  const q = useApiQuery(
    ["network", "clientMessages", networkId, phone],
    () => getNetworkClientMessages(networkId, phone),
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton lines={4} />;
  const rows = q.data ?? [];
  if (!rows.length)
    return (
      <SectionCard title={t("clientCard.tabs.messages")}>
        <EmptyState compact icon={<Bell aria-hidden />} title={t("clientCard.messagesEmpty")} />
      </SectionCard>
    );
  return (
    <SectionCard title={t("clientCard.tabs.messages")} padding="none">
      <ul className="divide-y divide-border">
        {pageItems.map((r) => (
          <li key={r.message.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-fg">{r.message.typeLabel.ru}</span>
              <Badge tone={r.message.status === "notDelivered" ? "danger" : "success"} size="sm">
                {r.message.status}
              </Badge>
            </div>
            <span className="text-muted">
              {r.businessName} · {r.message.channel} · {format.dateTime(r.message.createdAt)}
            </span>
            <span className="text-fg">{r.message.text.ru}</span>
          </li>
        ))}
      </ul>
      {pager && <div className="border-t border-border px-4 py-3">{pager}</div>}
    </SectionCard>
  );
}

function LoyaltyTab({
  byLocation,
  activeLocationId,
  onLocationChange,
  toast,
}: {
  byLocation: { businessId: string; businessName: string; clientId: string }[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const t = useT("network");
  const format = useFormat();
  const loc = byLocation.find((l) => l.businessId === activeLocationId) ?? byLocation[0];
  // Не `loc!.businessId`: React Compiler по «!» считает loc не-null и выносит чтение поля в рендер.
  const cardsQ = useApiQuery(
    ["loyalty", "cards", loc?.businessId, loc?.clientId],
    () => listCards(loc?.businessId ?? "", { clientId: loc?.clientId ?? "" }),
    { enabled: Boolean(loc) },
  );
  const typesQ = useApiQuery(
    ["loyalty", "cardTypes", loc?.businessId],
    () => listCardTypes(loc?.businessId ?? ""),
    { enabled: Boolean(loc) },
  );
  const issue = useApiMutation((args: { businessId: string; clientId: string; cardTypeId: string }) =>
    issueCard(args.businessId, args.clientId, args.cardTypeId),
  );
  const adjust = useApiMutation(
    (args: { businessId: string; cardId: string; locationId: string; amount: number }) =>
      adjustCardBalance(args.businessId, args.cardId, args.locationId, args.amount),
  );
  const remove = useApiMutation((args: { businessId: string; cardId: string }) =>
    deleteCard(args.businessId, args.cardId),
  );
  const [issueTypeId, setIssueTypeId] = useState("");
  const [adjustCard, setAdjustCard] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: cardsPage, pager: cardsPager } = usePagedList(cardsQ.data ?? []);

  if (!loc) return null;

  const runIssue = async () => {
    if (!issueTypeId) return;
    try {
      await issue.mutate({ businessId: loc.businessId, clientId: loc.clientId, cardTypeId: issueTypeId });
      toast.success(t("clientCard.cardIssued"));
      setIssueTypeId("");
      void cardsQ.refetch();
    } catch {
      toast.error(t("clientCard.cardIssueFailed"));
    }
  };

  const runAdjust = async () => {
    if (!adjustCard) return;
    const value = Number(amount);
    if (!value) return;
    try {
      await adjust.mutate({ businessId: loc.businessId, cardId: adjustCard, locationId: loc.businessId, amount: value });
      toast.success(t("clientCard.cardAdjusted"));
      setAdjustCard(null);
      setAmount("");
      void cardsQ.refetch();
    } catch {
      toast.error(t("clientCard.cardAdjustFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <LocationPicker byLocation={byLocation} activeLocationId={activeLocationId} onLocationChange={onLocationChange} />
      <SectionCard title={t("clientCard.tabs.loyalty")}>
        {cardsQ.isLoading || typesQ.isLoading ? (
          <Skeleton lines={3} />
        ) : !cardsQ.data?.length ? (
          <EmptyState compact icon={<CreditCard aria-hidden />} title={t("clientCard.loyaltyEmpty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {cardsPage.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <div className="font-medium text-fg">{c.cardTypeName} · №{c.number}</div>
                  <div className="text-sm text-muted">
                    {t("clientCard.balance")}: {format.money(c.balance)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAdjustCard(c.id)}>
                    {t("clientCard.accrue")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(c.id)}>
                    {t("clientCard.deleteCard")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {cardsPager && <div className="mt-4">{cardsPager}</div>}
        {Boolean(typesQ.data?.length) && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Select
              options={(typesQ.data ?? []).map((ct) => ({ value: ct.id, label: ct.name }))}
              value={issueTypeId}
              onValueChange={setIssueTypeId}
              placeholder={t("clientCard.chooseCardType")}
            />
            <Button disabled={!issueTypeId} loading={issue.isPending} onClick={runIssue}>
              {t("clientCard.issueCard")}
            </Button>
          </div>
        )}
      </SectionCard>

      <Modal open={Boolean(adjustCard)} onOpenChange={(o) => !o && setAdjustCard(null)} title={t("clientCard.accrueTitle")} size="sm">
        <div className="flex flex-col gap-3">
          <Input
            inputMode="numeric"
            placeholder={t("clientCard.accrueAmount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button loading={adjust.isPending} onClick={runAdjust}>
            {t("clientCard.accrueSave")}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={t("clientCard.deleteCard")}
        tone="danger"
        onConfirm={async () => {
          if (!confirmDelete) return;
          await remove.mutate({ businessId: loc.businessId, cardId: confirmDelete });
          setConfirmDelete(null);
          void cardsQ.refetch();
        }}
      />
    </div>
  );
}

function AccountsTab({
  byLocation,
  activeLocationId,
  onLocationChange,
}: {
  byLocation: { businessId: string; businessName: string; clientId: string }[];
  activeLocationId: string | null;
  onLocationChange: (id: string) => void;
}) {
  const t = useT("network");
  const format = useFormat();
  const loc = byLocation.find((l) => l.businessId === activeLocationId) ?? byLocation[0];
  // Не `loc!.businessId`: React Compiler по «!» считает loc не-null и выносит чтение поля в рендер.
  const q = useApiQuery(
    ["loyalty", "accounts", loc?.businessId, loc?.clientId],
    () => listClientAccounts(loc?.businessId ?? "", loc?.clientId ?? ""),
    { enabled: Boolean(loc) },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);
  if (!loc) return null;
  return (
    <div className="flex flex-col gap-4">
      <LocationPicker byLocation={byLocation} activeLocationId={activeLocationId} onLocationChange={onLocationChange} />
      <SectionCard title={t("clientCard.tabs.accounts")}>
        {q.isLoading ? (
          <Skeleton lines={3} />
        ) : !q.data?.length ? (
          <EmptyState compact icon={<Wallet aria-hidden />} title={t("clientCard.accountsEmpty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {pageItems.map((a) => (
              <li key={a.id} className="rounded-xl border border-border p-3">
                <div className="font-medium text-fg">{a.typeName}</div>
                <div className="text-sm text-muted">
                  {t("clientCard.balance")}: {format.money(a.balance)}
                </div>
              </li>
            ))}
          </ul>
        )}
        {pager && <div className="mt-4">{pager}</div>}
        <p className="mt-3 text-xs text-muted">{t("clientCard.topupDisabled")}</p>
      </SectionCard>
    </div>
  );
}
