"use client";

/**
 * «Выдать клиенту» с доплатой (ответ 12 владельца 17.11.2026): сумма к оплате при выдаче и способ оплаты — сразу
 * операцией в кассе, как оплата визита (видна в «Финансах», смене и Z-отчёте кассы). Пример: пальто 12 000 ֏,
 * предоплата 3 000 — при выдаче 9 000 картой. Остатка нет — окно не нужно, заказ выдаётся сразу.
 */
import { useState } from "react";
import { getOrder, setOrderStatus } from "@/api/orders";
import { patchInList, useApiMutation, useApiQuery } from "@/api/request";
import {
  PayMethodField,
  usePayMethods,
} from "@/areas/orders/form/PayMethodField";
import { orderRemaining, type Order } from "@/domain/orders";
import { useFormat } from "@/i18n/useFormat";
import { useT } from "@/i18n/useT";
import { Button } from "@/ui/Button";
import { FormField } from "@/ui/FormField";
import { Modal } from "@/ui/Modal";
import { MoneyInput } from "@/ui/MoneyInput";
import { Skeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/Toast";

export interface IssueOrderModalProps {
  businessId: string;
  orderId: string | null;
  onClose: () => void;
  /** Подпись тоста — «выдан» или «выдан без ремонта» */
  toastKey?: "toast.issued" | "toast.issuedWithoutRepair";
  onIssued?: () => void;
}

export function IssueOrderModal(props: IssueOrderModalProps) {
  const t = useT("orders");
  const orderQ = useApiQuery(
    ["orders", "order", props.businessId, props.orderId],
    () => getOrder(props.businessId, props.orderId!),
    { enabled: Boolean(props.orderId) },
  );
  const order = orderQ.data;
  return (
    <Modal
      open={Boolean(props.orderId)}
      onOpenChange={(o) => !o && props.onClose()}
      title={
        order
          ? t("issue.title", { number: order.number })
          : t("issue.titleShort")
      }
      description={t("issue.hint")}
    >
      {!order ? (
        <Skeleton lines={3} />
      ) : (
        <IssueForm key={order.id} order={order} {...props} />
      )}
    </Modal>
  );
}

function IssueForm({
  order,
  businessId,
  onClose,
  toastKey = "toast.issued",
  onIssued,
}: IssueOrderModalProps & { order: Order }) {
  const t = useT("orders");
  const fmt = useFormat();
  const toast = useToast();
  const due = orderRemaining(order);
  const [amount, setAmount] = useState<number | undefined>(due);
  const [method, setMethod] = useState<string | undefined>(undefined);
  const { failed } = usePayMethods(businessId);
  const issueM = useApiMutation(setOrderStatus, {
    optimistic: patchInList(["orders", "order"], (a: { orderId: string }) => ({
      id: a.orderId,
      patch: { status: "issued" as const },
    })),
  });

  const confirm = async () => {
    try {
      const pay =
        amount && amount > 0 && method
          ? { amount, methodKey: method }
          : undefined;
      await issueM.mutate({
        businessId,
        orderId: order.id,
        status: "issued",
        payment: pay,
      });
      toast.success(t(toastKey, { number: order.number }));
      onIssued?.();
      onClose();
    } catch {
      toast.error(t("toast.failed"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t("detail.price")}</dt>
          <dd className="tabular-nums text-fg">{fmt.money(order.price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t("detail.prepaid")}</dt>
          <dd className="tabular-nums text-fg">{fmt.money(order.prepaid)}</dd>
        </div>
      </dl>
      <FormField
        label={t("issue.amount")}
        hint={
          amount !== due
            ? t("issue.dueHint", { amount: fmt.money(due) })
            : undefined
        }
      >
        <MoneyInput value={amount} onValueChange={setAmount} min={0} />
      </FormField>
      {(amount ?? 0) > 0 && !failed && (
        <PayMethodField
          businessId={businessId}
          value={method}
          onChange={setMethod}
        />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("issue.back")}
        </Button>
        <Button
          loading={issueM.isPending}
          disabled={(amount ?? 0) > 0 && !method && !failed}
          onClick={() => void confirm()}
        >
          {(amount ?? 0) > 0
            ? t("issue.confirmPaid", { amount: fmt.money(amount ?? 0) })
            : t("issue.confirm")}
        </Button>
      </div>
    </div>
  );
}
