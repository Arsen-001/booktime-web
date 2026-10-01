"use client";

/**
 * «Сделать владельцем» (F-10-149): передача салона — отдельное необратимое действие с подтверждением
 * словом, не «вы уверены?». Бывший владелец становится администратором сразу же (api/staff.ts
 * transferOwnership); действие пишется в журнал изменений (⭐ F-00-040).
 */
import { useState } from "react";
import { transferOwnership } from "@/api/staff";
import { useApiMutation } from "@/api/request";
import { TRANSFER_OWNER_CONFIRM_WORD } from "@/domain/staff";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { useToast } from "@/ui/Toast";

export interface TransferOwnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStaffId: string;
  toStaffId: string;
  toStaffName: string;
  onTransferred: () => void;
}

export function TransferOwnerModal({
  open,
  onOpenChange,
  fromStaffId,
  toStaffId,
  toStaffName,
  onTransferred,
}: TransferOwnerModalProps) {
  const t = useT("staff");
  const toast = useToast();
  const m = useApiMutation((args: { from: string; to: string }) =>
    transferOwnership(args.from, args.to),
  );
  const [typed, setTyped] = useState("");
  const match = typed.trim().toUpperCase() === TRANSFER_OWNER_CONFIRM_WORD;

  const close = (o: boolean) => {
    if (!o) setTyped("");
    onOpenChange(o);
  };

  const submit = async () => {
    if (!match) return;
    try {
      await m.mutate({ from: fromStaffId, to: toStaffId });
      toast.success(t("transferOwner.success", { name: toStaffName }));
      close(false);
      onTransferred();
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={t("transferOwner.title")}
      description={t("transferOwner.description", { name: toStaffName })}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {t("addStaffForm.cancel")}
          </Button>
          <Button variant="danger" disabled={!match} loading={m.isPending} onClick={submit}>
            {t("transferOwner.confirm")}
          </Button>
        </div>
      }
    >
      <form
        data-f="F-10-149 F-10-155"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-muted">{t("transferOwner.hint")}</p>
        <FormField
          label={t("deleteStaff.typeWord", { word: TRANSFER_OWNER_CONFIRM_WORD })}
        >
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            placeholder={TRANSFER_OWNER_CONFIRM_WORD}
          />
        </FormField>
      </form>
    </Modal>
  );
}
