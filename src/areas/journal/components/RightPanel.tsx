"use client";

/**
 * F-01-017: правая панель журнала — вкладки «Клиенты» (F-01-163) и «Чат» (F-01-164). Не закрывает
 * сетку, не сбрасывается при смене дня/вида (состояние держит JournalScreen, панель — чистый вид).
 * Поиск по имени или номеру сразу показывает записи клиента — JournalSearchResults (⭐ 29.09.2026).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import type { Id, ISODate } from "@/domain/core";
import {
  getClientRecentBookings,
  getJournalSettings,
} from "@/api/journal";
import {
  JournalSearchResults,
  isJournalSearchActive,
} from "@/areas/journal/components/JournalSearchResults";
import { useApiQuery } from "@/api/request";
import { useT } from "@/i18n/useT";
import { useFormat } from "@/i18n/useFormat";
import { useJournalHourFormat } from "@/areas/journal/lib/useJournalHourFormat";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/ui/EmptyState";
import { IconButton } from "@/ui/IconButton";
import { Input } from "@/ui/Input";
import { SearchInput } from "@/ui/SearchInput";
import { Skeleton } from "@/ui/Skeleton";
import { Tabs } from "@/ui/Tabs";
import { Button } from "@/ui/Button";

export interface RightPanelProps {
  businessId: Id;
  date: ISODate;
  onOpenBooking: (query: Record<string, string>) => void;
  /** F-01-163: «Расписание специалиста» — переключает журнал на недельный вид этого сотрудника */
  onOpenStaffWeek: (staffId: Id) => void;
  /** F-01-017: панель открыта в Sheet на телефоне (390×844) — без своей ширины/рамки/фона */
  inSheet?: boolean;
}

type PanelTab = "clients" | "chat";

export function RightPanel({
  businessId,
  date,
  onOpenBooking,
  onOpenStaffWeek,
  inSheet,
}: RightPanelProps) {
  const t = useT("journal");
  const router = useRouter();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const [tab, setTab] = useState<PanelTab>("clients");
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<Id | undefined>(
    undefined,
  );
  // F-13-168: чат «находит» клиента через ту же панель поиска, что и вкладка «Клиенты» — выбор
  // клиента общий для обеих вкладок, поэтому храним имя/телефон рядом с id, не перезапрашивая их.
  const [selectedClientBrief, setSelectedClientBrief] = useState<
    { id: Id; name: string; phone: string } | undefined
  >(undefined);
  // Демо-переписка живёт только в состоянии панели (F-13-168) — своего мессенджера у сервиса нет,
  // партнёр присылал бы историю и её статусы сам.
  const [chatThreads, setChatThreads] = useState<
    Record<Id, { from: "client" | "me"; text: string }[]>
  >({});
  const [chatDraft, setChatDraft] = useState("");

  const recentQuery = useApiQuery(
    ["journal", "right-panel-recent", selectedClientId],
    () => getClientRecentBookings(selectedClientId!),
    { enabled: Boolean(selectedClientId) },
  );
  // Не `recentQuery.data![0]`: React Compiler по «!» считает recentQuery.data не-null и выносит чтение поля в рендер.
  const firstRecentStaffId = recentQuery.data?.[0]?.staffId;
  // F-13-167/168: чат появляется только при подключённом демо-партнёре (F-01-165/166, «Настройки
  // цифрового журнала» → «Чат») — до этого вкладка только объясняет и ведёт туда.
  const settingsQuery = useApiQuery(["journal", "settings"], () =>
    getJournalSettings(),
  );
  const chatConnected = settingsQuery.data?.chatIntegrationConnected ?? false;

  const selectClient = (c: { id: Id; name: string; phone: string }) => {
    setSelectedClientId(c.id);
    setSelectedClientBrief(c);
    setChatThreads((prev) =>
      prev[c.id]
        ? prev
        : {
            ...prev,
            [c.id]: [
              { from: "client", text: t("rightPanel.chat.demoIncoming") },
            ],
          },
    );
  };

  const sendChatMessage = () => {
    const text = chatDraft.trim();
    if (!text || !selectedClientBrief) return;
    setChatThreads((prev) => ({
      ...prev,
      [selectedClientBrief.id]: [
        ...(prev[selectedClientBrief.id] ?? []),
        { from: "me", text },
      ],
    }));
    setChatDraft("");
  };

  return (
    <div
      data-f="F-01-017"
      className={cn(
        "flex flex-col gap-3",
        inSheet
          ? "w-full"
          : "w-72 shrink-0 border-l border-border bg-surface p-3",
      )}
    >
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as PanelTab)}
        items={[
          { value: "clients", label: t("rightPanel.tabs.clients") },
          { value: "chat", label: t("rightPanel.tabs.chat") },
        ]}
      />

      {tab === "clients" ? (
        <div data-f="F-01-163 F-04-103" className="flex flex-col gap-3">
          <SearchInput
            autoFocus={inSheet}
            debounceMs={200}
            defaultValue={query}
            onValueChange={(v) => {
              setQuery(v);
              setSelectedClientId(undefined);
            }}
            placeholder={t("rightPanel.clients.searchPlaceholder")}
            aria-label={t("rightPanel.clients.searchPlaceholder")}
          />

          {!selectedClientId ? (
            !isJournalSearchActive(query) ? (
              <EmptyState title={t("rightPanel.clients.emptyTitle")} />
            ) : (
              <JournalSearchResults
                businessId={businessId}
                query={query}
                onSelectClient={selectClient}
                onOpenBooking={onOpenBooking}
              />
            )
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setSelectedClientId(undefined)}
              >
                ← {t("rightPanel.clients.backToSearch")}
              </Button>
              {recentQuery.isLoading ? (
                <Skeleton lines={4} />
              ) : (recentQuery.data ?? []).length === 0 ? (
                <EmptyState title={t("rightPanel.clients.noRecentBookings")} />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {(recentQuery.data ?? []).map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenBooking({ booking: b.id, date: b.start.slice(0, 10) })
                        }
                        className="flex min-h-10 w-full flex-col rounded-lg px-2 py-1 text-left text-sm hover:bg-surface-2"
                      >
                        <span className="font-medium text-fg">
                          {format.date(b.start.slice(0, 10), "short")},{" "}
                          {format.time(b.start)}
                        </span>
                        <span className="text-xs text-muted">
                          {format.money(b.total)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {(recentQuery.data ?? []).length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!firstRecentStaffId) return;
                      onOpenStaffWeek(firstRecentStaffId);
                    }}
                  >
                    {t("rightPanel.clients.staffSchedule")}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenBooking({
                      new: "1",
                      client: selectedClientId ?? "",
                      date,
                    });
                  }}
                >
                  {t("rightPanel.clients.createBooking")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : !settingsQuery.isLoading && chatConnected ? (
        <div data-f="F-13-168" className="flex flex-col gap-3">
          {!selectedClientBrief ? (
            <EmptyState
              compact
              icon={<MessageCircle aria-hidden className="size-8 text-muted" />}
              title={t("rightPanel.chat.pickClient")}
              action={
                <Button type="button" size="sm" variant="outline" onClick={() => setTab("clients")}>
                  {t("rightPanel.tabs.clients")}
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{selectedClientBrief.name}</p>
                  <p className="truncate text-xs text-muted">{format.phone(selectedClientBrief.phone)}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedClientBrief(undefined)}>
                  ← {t("rightPanel.clients.backToSearch")}
                </Button>
              </div>
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {(chatThreads[selectedClientBrief.id] ?? []).map((m, i) => (
                  <li
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                      m.from === "me" ? "self-end bg-primary text-primary-fg" : "self-start bg-surface-2 text-fg",
                    )}
                  >
                    {m.text}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <Input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder={t("rightPanel.chat.draftPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChatMessage();
                  }}
                />
                <IconButton icon={<Send aria-hidden />} label={t("rightPanel.chat.send")} onClick={sendChatMessage} />
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          data-f="F-01-164 F-13-167"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center"
        >
          <MessageCircle aria-hidden className="size-8 text-muted" />
          <p className="text-sm font-medium text-fg">
            {t("rightPanel.chat.title")}
          </p>
          <p className="text-xs text-muted">{t("rightPanel.chat.text")}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => router.push("/biz/journal/settings")}>
            {t("rightPanel.chat.connect")}
          </Button>
        </div>
      )}
    </div>
  );
}
