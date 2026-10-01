"use client";

/**
 * F-01-156…162: панель «Лист ожидания» — журнал → плитка «Лист ожидания» → панель справа, журнал за ней виден.
 *
 * Лист ожидания бизнеса ОДИН, и вид у него один (владелец, 30.09.2026): содержимое панели — вклад хозяина листа
 * (resources, хост journalWaitlist) — тот же компонент, что экран /biz/waitlist: те же заявки (от сотрудников, из
 * приложения и виджета), фильтры, карточка, форма, «Уведомить», правка и удаление. Журнал даёт день сетки и мастеров,
 * а «Записать» открывает окно записи здесь же; сохранили запись — заявка «Закрытая» (closeWaitlistEntry в onSaved).
 */
import { useEffect, useRef, useState } from "react";
import type { Id, ISODate, Staff } from "@/domain/core";
import { getWaitlistPanelOpen, setWaitlistPanelOpen } from "@/api/journal";
import { closeWaitlistEntry } from "@/api/resources";
import { useApiMutation } from "@/api/request";
import { useCurrent } from "@/demo/hooks";
import { ExtensionSlot } from "@/extensions/ExtensionSlot";
import type { WaitlistRecordRequest } from "@/extensions/types";
import { useExtensions } from "@/extensions/useExtensions";
import { useT } from "@/i18n/useT";
import { BookingWindow } from "@/areas/journal/components/BookingWindow";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/Toast";

export interface WaitlistPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  staffList: Staff[];
  /** День сетки журнала — фильтр «На день журнала» */
  date: ISODate;
}

export function WaitlistPanel({ open, onOpenChange, businessId, locationId, staffList, date }: WaitlistPanelProps) {
  const t = useT("journal");
  const tc = useT("common");
  const toast = useToast();
  const { staffId: ownStaffId } = useCurrent();
  const [entry] = useExtensions("journalWaitlist");
  const [recording, setRecording] = useState<WaitlistRecordRequest | undefined>(undefined);
  const close = useApiMutation(({ id, bookingId }: { id: Id; bookingId: Id }) => closeWaitlistEntry(id, bookingId));

  // F-01-156: панель помнит открыто/закрыто после перезагрузки — читаем один раз и сообщаем родителю (плитка держит state)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !ownStaffId) return;
    restoredRef.current = true;
    getWaitlistPanelOpen(ownStaffId)
      .then((v) => {
        if (v && !open) onOpenChange(true);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownStaffId]);

  function persistPanelOpen(next: boolean) {
    onOpenChange(next);
    if (ownStaffId) setWaitlistPanelOpen(ownStaffId, next).catch(() => undefined);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={persistPanelOpen} title={t("waitlist.title")} side="right" size="sm" modal={false}>
        {entry && (
          <ExtensionSlot
            entry={entry}
            props={{ businessId, locationId, date, staffIds: staffList.map((s) => s.id), onRecord: setRecording }}
          />
        )}
      </Sheet>

      {recording && (
        <BookingWindow
          open
          onOpenChange={(o) => {
            if (!o) setRecording(undefined);
          }}
          staffList={staffList}
          initialStaffId={recording.staffId}
          initialClientId={recording.clientId}
          initialName={recording.clientId ? undefined : recording.clientName}
          initialPhone={recording.clientId ? undefined : recording.clientPhone}
          date={recording.date}
          initialTime={recording.time}
          locationId={locationId}
          initialComment={recording.comment}
          initialServiceIds={recording.serviceIds}
          onSaved={(booking) => {
            // F-01-159: запись создаётся только по «Сохранить» — закрытие окна без сохранения заявку не меняет
            if (booking) close.mutate({ id: recording.entryId, bookingId: booking.id }).catch(() => toast.error(tc("states.actionFailed")));
          }}
        />
      )}
    </>
  );
}
