"use client";

/**
 * Перенос доступа на другую карточку (F-10-045): для дубля карточки или замены человека. Выбираем
 * только сотрудников без доступа сейчас; по галочке исходную карточку можно сразу удалить.
 */
import { useState } from "react";
import { transferAccess, type StaffListRow } from "@/api/staff";
import { useApiMutation } from "@/api/request";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { Checkbox } from "@/ui/Checkbox";
import { EmptyState } from "@/ui/EmptyState";
import { FormField } from "@/ui/FormField";
import { Modal } from "@/ui/Modal";
import { Select } from "@/ui/Select";
import { useToast } from "@/ui/Toast";

export interface TransferAccessModalProps {
  row: StaffListRow | null;
  candidates: StaffListRow[];
  onOpenChange: (open: boolean) => void;
  onTransferred: () => void;
}

export function TransferAccessModal({
  row: rowProp,
  candidates,
  onOpenChange,
  onTransferred,
}: TransferAccessModalProps) {
  const t = useT("staff");
  const toast = useToast();
  const transfer = useApiMutation(transferAccess);
  const [toStaffId, setToStaffId] = useState("");
  const [deleteSource, setDeleteSource] = useState(false);

  // Последний сотрудник живёт до конца анимации закрытия (М4: окно не исчезает за один кадр)
  const [kept, setKept] = useState<StaffListRow | null>(rowProp);
  if (rowProp && rowProp !== kept) setKept(rowProp);
  const row = rowProp ?? kept;
  if (!row) return null;
  // Только сотрудники без доступа сейчас (F-10-045): не активны и не сам владелец
  const options = candidates.filter(
    (c) =>
      c.staff.id !== row.staff.id &&
      c.staff.role !== "owner" &&
      c.staff.status !== "active",
  );

  const submit = async () => {
    if (!toStaffId) return;
    try {
      await transfer.mutate({
        fromStaffId: row.staff.id,
        toStaffId,
        deleteSource,
      });
      toast.success(t("transferAccess.success"));
      onOpenChange(false);
      onTransferred();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  return (
    <Modal
      open={Boolean(rowProp)}
      onOpenChange={(o) => {
        if (!o) {
          setToStaffId("");
          setDeleteSource(false);
        }
        onOpenChange(o);
      }}
      title={t("transferAccess.title")}
      description={t("transferAccess.description", { name: row.staff.name })}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("addStaffForm.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!toStaffId}
            loading={transfer.isPending}
            onClick={() => void submit()}
          >
            {t("transferAccess.confirm")}
          </Button>
        </div>
      }
    >
      <div data-f="F-10-045" className="flex flex-col gap-4">
        {options.length === 0 ? (
          <EmptyState
            compact
            title={t("transferAccess.noCandidates")}
          />
        ) : (
          <>
            <FormField label={t("transferAccess.pick")}>
              <Select
                value={toStaffId}
                onValueChange={setToStaffId}
                placeholder={t("transferAccess.pickPlaceholder")}
                options={options.map((c) => ({
                  value: c.staff.id,
                  label: c.staff.name,
                }))}
              />
            </FormField>
            <Checkbox
              checked={deleteSource}
              onCheckedChange={setDeleteSource}
              label={t("transferAccess.deleteSource")}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
