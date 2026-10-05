'use client';

/**
 * ⭐ Смета для клиента (05.10.2026): по строкам («Замена экрана — 18 000 ֏», «Работа — 5 000 ֏») или одной суммой,
 * плюс комментарий, который увидит клиент. Итог считается сразу; если клиент согласится — он станет ценой заказа,
 * поэтому не может быть меньше предоплаты. «Отправить клиенту» — сообщение со ссылкой /o/<code>.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sendOrderEstimate } from '@/api/orders';
import { useApiMutation } from '@/api/request';
import { estimateTotalOf, type EstimateInput, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { newId } from '@/lib/id';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

type Mode = 'lines' | 'total';
interface LineDraft {
  key: string;
  title: string;
  price: number | undefined;
}
interface Draft {
  mode: Mode;
  lines: LineDraft[];
  total: number | undefined;
  comment: string;
}

const newLine = (title = '', price?: number): LineDraft => ({ key: newId('el'), title, price });

/** Черновик из прежней сметы (правка) или пустой: одна строка */
function initialDraft(order: Order): Draft {
  const est = order.estimate;
  if (!est) return { mode: 'lines', lines: [newLine()], total: undefined, comment: '' };
  return {
    mode: est.lines.length ? 'lines' : 'total',
    lines: est.lines.length ? est.lines.map((l) => newLine(l.title, l.price)) : [newLine()],
    total: est.lines.length ? undefined : est.total,
    comment: est.comment ?? '',
  };
}

/** Заполненные строки: есть название (цена пустая — 0 не считаем заполненной) */
const filled = (lines: LineDraft[]) => lines.filter((l) => l.title.trim() && l.price !== undefined);

function toInput(d: Draft): EstimateInput {
  const comment = d.comment.trim() || null;
  if (d.mode === 'total') return { lines: [], total: d.total ?? 0, comment };
  return { lines: filled(d.lines).map((l) => ({ title: l.title.trim(), price: l.price ?? 0 })), comment };
}

export function EstimateSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const [initial] = useState(() => initialDraft(order));
  const [draft, setDraft] = useState<Draft>(initial);
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify({ ...draft, lines: draft.lines.map(({ title, price }) => [title, price]) }) !== JSON.stringify({ ...initial, lines: initial.lines.map(({ title, price }) => [title, price]) });
  const { confirmLeave } = useUnsavedGuard(dirty);
  const send = useApiMutation(sendOrderEstimate);

  const input = toInput(draft);
  const total = estimateTotalOf(input.lines, input.total);
  const error =
    draft.mode === 'lines' && !input.lines.length
      ? t('estimate.sheet.errors.lines')
      : draft.mode === 'total' && draft.total === undefined
        ? t('estimate.sheet.errors.total')
        : total < order.prepaid
          ? t('estimate.sheet.errors.belowPrepaid', { amount: fmt.money(order.prepaid) })
          : null;

  const change = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const patchLine = (key: string, p: Partial<LineDraft>) => change({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) });
  const requestClose = async () => {
    if (dirty && !(await confirmLeave())) return;
    onClose();
  };

  async function submit() {
    setTried(true);
    if (error || send.isPending) return;
    try {
      await send.mutate({ businessId: order.businessId, orderId: order.id, input });
      toast.success(t('estimate.toast.sent'));
      onClose();
    } catch {
      toast.error(t('toast.failed'));
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => (o ? undefined : void requestClose())}
      title={t('estimate.sheet.title', { number: order.number })}
      description={t('estimate.sheet.description')}
      size="lg"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2 md:flex md:w-auto md:justify-end">
          <Button variant="outline" onClick={() => void requestClose()}>
            {t('estimate.sheet.cancel')}
          </Button>
          <Button data-f="orders-estimate-send" loading={send.isPending} onClick={() => void submit()}>
            {t('estimate.sheet.send')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        data-f="orders-estimate-form"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <SegmentedControl
          aria-label={t('estimate.sheet.mode')}
          fullWidth
          value={draft.mode}
          onValueChange={(v) => change({ mode: v as Mode })}
          options={[
            { value: 'lines', label: t('estimate.sheet.modeLines') },
            { value: 'total', label: t('estimate.sheet.modeTotal') },
          ]}
        />

        {draft.mode === 'lines' ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {draft.lines.map((line, i) => (
                <li key={line.key} className="flex items-start gap-2">
                  <Input
                    aria-label={t('estimate.sheet.lineTitle', { n: i + 1 })}
                    value={line.title}
                    onChange={(e) => patchLine(line.key, { title: e.target.value })}
                    placeholder={t('estimate.sheet.lineTitlePlaceholder')}
                    invalid={tried && Boolean(error) && i === 0 && !line.title.trim()}
                    classNames={{ root: 'min-w-0 flex-1' }}
                    autoComplete="off"
                  />
                  <MoneyInput
                    aria-label={t('estimate.sheet.linePrice', { n: i + 1 })}
                    value={line.price}
                    onValueChange={(price) => patchLine(line.key, { price })}
                    min={0}
                    className="w-32 shrink-0 sm:w-36"
                  />
                  {draft.lines.length > 1 && (
                    <IconButton
                      icon={<Trash2 aria-hidden />}
                      label={t('estimate.sheet.lineRemove')}
                      variant="ghost"
                      onClick={() => change({ lines: draft.lines.filter((l) => l.key !== line.key) })}
                    />
                  )}
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" className="self-start" leftIcon={<Plus aria-hidden />} onClick={() => change({ lines: [...draft.lines, newLine()] })}>
              {t('estimate.sheet.lineAdd')}
            </Button>
          </div>
        ) : (
          <FormField label={t('estimate.sheet.total')} required>
            <MoneyInput value={draft.total} onValueChange={(v) => change({ total: v })} min={0} invalid={tried && Boolean(error)} />
          </FormField>
        )}

        <div className="flex flex-col gap-1 rounded-xl bg-surface-2 px-4 py-3">
          <p className="flex items-baseline justify-between gap-4">
            <span className="font-semibold text-fg">{t('estimate.sheet.totalLine')}</span>
            <span className="text-2xl font-bold text-fg tabular-nums">{fmt.money(total)}</span>
          </p>
          <p className="text-sm text-muted">
            {order.prepaid > 0 ? t('estimate.sheet.prepaidNote', { amount: fmt.money(order.prepaid) }) : t('estimate.sheet.becomesPrice')}
          </p>
        </div>
        {tried && error && (
          <p role="alert" className="-mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        <FormField label={t('estimate.sheet.comment')} optional>
          <Textarea
            value={draft.comment}
            onChange={(e) => change({ comment: e.target.value })}
            placeholder={t('estimate.sheet.commentPlaceholder')}
            rows={3}
            maxLength={1000}
            autoResize
          />
        </FormField>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
