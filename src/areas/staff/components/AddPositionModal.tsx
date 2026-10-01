"use client";

/**
 * «+ Добавить» → «Должность» (F-10-015, F-10-047): создаёт запись каталога должностей.
 * С переданным `editing` — та же форма правит название и описание (F-10-047 «правка — та же форма»).
 */
import { useState } from "react";
import { addPosition, renamePosition } from "@/api/staff";
import { useApiMutation } from "@/api/request";
import type { Id } from "@/domain/core";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Input } from "@/ui/Input";
import { Modal } from "@/ui/Modal";
import { Textarea } from "@/ui/Textarea";
import { useToast } from "@/ui/Toast";

export interface EditingPosition {
  id: Id;
  name: string;
  description?: string;
}

export interface AddPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id | undefined;
  editing?: EditingPosition | null;
  onCreated: () => void;
}

export function AddPositionModal({
  open,
  onOpenChange,
  businessId,
  editing,
  onCreated,
}: AddPositionModalProps) {
  const t = useT("staff");
  const toast = useToast();
  const create = useApiMutation(
    (input: { businessId: Id; name: string; description: string }) =>
      addPosition(input.businessId, input.name, input.description),
  );
  const rename = useApiMutation(
    (input: { id: Id; name: string; description: string }) =>
      renamePosition(input.id, input.name, input.description),
  );
  const isEdit = Boolean(editing);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setError("");
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError(t("addPositionForm.nameRequired"));
      return;
    }
    try {
      if (editing) {
        await rename.mutate({ id: editing.id, name, description });
        toast.success(t("addPositionForm.savedSuccess", { name: name.trim() }));
      } else {
        if (!businessId) return;
        await create.mutate({ businessId, name, description });
        toast.success(t("addPositionForm.success", { name: name.trim() }));
      }
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error(
        editing ? t("addPositionForm.saveFailed") : t("addPositionForm.failed"),
      );
    }
  };

  const pending = create.isPending || rename.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEdit ? t("addPositionForm.editTitle") : t("addPositionForm.title")
      }
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("addStaffForm.cancel")}
          </Button>
          <Button loading={pending} onClick={submit}>
            {t("addStaffForm.save")}
          </Button>
        </div>
      }
    >
      <form
        data-f="F-10-015 F-10-046 F-10-047"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label={t("addPositionForm.name")} required error={error}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder={t("addPositionForm.placeholder")}
          />
        </FormField>
        <FormField
          label={t("addPositionForm.description")}
          hint={t("addPositionForm.descriptionHint")}
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t("addPositionForm.descriptionPlaceholder")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
