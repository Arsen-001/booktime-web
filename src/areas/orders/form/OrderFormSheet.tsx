'use client';

/**
 * Принять заказ / изменить заказ — шторка с формой секциями: клиент, что сдали, фото, кто делает и срок, деньги,
 * комментарий. Проверка — наша (под полем), закрытие с несохранённым — наш вопрос. Новый заказ после сохранения
 * открывается целиком: там ссылка для клиента и кнопки статусов.
 */
import { useState, type ReactNode } from 'react';
import { useCoreList } from '@/api/core';
import { createOrder, updateOrder } from '@/api/orders';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { orderRemaining, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { ClientField } from '@/areas/orders/form/ClientField';
import { ItemsField } from '@/areas/orders/form/ItemsField';
import { draftFromBooking, draftFromOrder, draftToInput, emptyDraft, sameDraft, validateDraft, type OrderDraft, type OrderFormErrors } from '@/areas/orders/form/orderForm';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { ImageUpload } from '@/ui/ImageUpload';
import { MoneyInput } from '@/ui/MoneyInput';
import { useNavigate } from '@/ui/navigation/useNavigate';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/** ⭐ «Принять заказ» по записи на сдачу (05.10.2026): клиент и вещь — из записи, заказ ссылается на неё */
export interface OrderFromBooking {
  bookingId: Id;
  clientId: Id | null;
  clientName: string;
  clientPhone: string;
  /** Что сдают — комментарий клиента к записи */
  description: string | null;
  staffId: Id | null;
}

export interface OrderFormSheetProps {
  /** Нет — новый заказ */
  order?: Order;
  /** Новый заказ по записи на сдачу */
  fromBooking?: OrderFromBooking;
  onClose: () => void;
}

const MAX_PHOTOS = 6;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

export function OrderFormSheet({ order, fromBooking, onClose }: OrderFormSheetProps) {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const nav = useNavigate();
  const { businessId } = useCurrent();
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const [initial] = useState<OrderDraft>(() => (order ? draftFromOrder(order) : fromBooking ? draftFromBooking(fromBooking) : emptyDraft()));
  const [draft, setDraft] = useState<OrderDraft>(initial);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [tried, setTried] = useState(false);
  const dirty = !sameDraft(initial, draft);
  const { confirmLeave } = useUnsavedGuard(dirty);
  const create = useApiMutation(createOrder);
  const update = useApiMutation(updateOrder);
  const pending = create.isPending || update.isPending;

  const change = (patch: Partial<OrderDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (tried) setErrors(validateDraft(next));
  };
  const requestClose = async () => {
    if (dirty && !(await confirmLeave())) return;
    onClose();
  };
  const err = (key: keyof OrderFormErrors) => (errors[key] ? t(`form.errors.${errors[key]}`) : undefined);

  async function submit() {
    if (!businessId || pending) return;
    setTried(true);
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    const input = { ...draftToInput(draft), ...(fromBooking ? { bookingId: fromBooking.bookingId } : {}) };
    try {
      if (order) {
        await update.mutate({ businessId, orderId: order.id, patch: input });
        toast.success(t('form.saved'));
        onClose();
      } else {
        const created = await create.mutate({ businessId, input });
        toast.success(t('form.created', { number: created.number }));
        onClose();
        nav.go(`/biz/orders/${created.id}`);
      }
    } catch (e) {
      toast.error((e as { code?: string } | undefined)?.code === 'intake_already_accepted' ? t('form.alreadyAccepted') : t('form.saveFailed'));
    }
  }

  const staff = (staffQ.data ?? []).filter((s) => s.status === 'active');
  const left = orderRemaining({ price: draft.price ?? 0, prepaid: draft.prepaid ?? 0 });

  return (
    <Sheet
      open
      onOpenChange={(o) => (o ? undefined : void requestClose())}
      title={order ? t('form.editTitle', { number: order.number }) : fromBooking ? t('form.fromBookingTitle') : t('form.createTitle')}
      description={order ? undefined : fromBooking ? t('form.fromBookingHint') : t('form.createHint')}
      size="lg"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2 md:flex md:w-auto md:justify-end">
          <Button variant="outline" onClick={() => void requestClose()}>
            {t('form.cancel')}
          </Button>
          <Button loading={pending} onClick={() => void submit()}>
            {order ? t('form.save') : t('form.create')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        data-f="orders-form"
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Section title={t('form.sectionClient')}>
          <ClientField
            value={{ clientId: draft.clientId, clientName: draft.clientName, clientPhone: draft.clientPhone }}
            onChange={(v) => change(v)}
            errors={{ clientName: err('clientName'), clientPhone: err('clientPhone') }}
          />
        </Section>

        <Section title={t('form.sectionItems')}>
          <ItemsField value={draft.items} onChange={(items) => change({ items })} error={err('items')} />
        </Section>

        <Section title={t('form.sectionPhotos')}>
          <p className="-mt-2 text-sm text-muted">{t('form.photosHint')}</p>
          <ImageUpload value={draft.photos} onValueChange={(photos) => change({ photos })} max={MAX_PHOTOS} label={t('form.photosAdd')} />
        </Section>

        <Section title={t('form.sectionWork')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('form.staff')} optional>
              <Select
                value={draft.staffId}
                onValueChange={(v) => change({ staffId: v })}
                options={[{ value: '', label: t('form.staffNone') }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </FormField>
            <FormField label={t('form.dueDate')} optional>
              <DatePicker value={draft.dueDate} onValueChange={(d) => change({ dueDate: d })} min={order ? undefined : today()} clearable placeholder={t('form.dueDatePlaceholder')} />
            </FormField>
          </div>
        </Section>

        <Section title={t('form.sectionMoney')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('form.price')} required error={err('price')}>
              <MoneyInput value={draft.price} onValueChange={(price) => change({ price })} min={0} />
            </FormField>
            <FormField label={t('form.prepaid')} optional error={err('prepaid')}>
              <MoneyInput value={draft.prepaid} onValueChange={(prepaid) => change({ prepaid })} min={0} />
            </FormField>
          </div>
          {(draft.price ?? 0) > 0 && (
            <p className="text-sm text-muted">
              {t('form.remaining')} <span className="font-semibold text-fg tabular-nums">{fmt.money(left)}</span>
            </p>
          )}
        </Section>

        <Section title={t('form.sectionComment')}>
          <Textarea
            aria-label={t('form.sectionComment')}
            value={draft.comment}
            onChange={(e) => change({ comment: e.target.value })}
            placeholder={t('form.commentPlaceholder')}
            rows={3}
            autoResize
          />
        </Section>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
