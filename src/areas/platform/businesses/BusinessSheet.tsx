'use client';

/**
 * Карточка бизнеса: сведения и копии. Опасное — в меню «⋯»: «Приостановить» (обратимо, подтверждение с последствиями)
 * и необратимое «Бизнес уходит» (своё окно: выгрузка + отметка «данные отданы»).
 */
import { useState } from 'react';
import { CalendarClock, DoorOpen, MoreHorizontal, PauseCircle, PlayCircle } from 'lucide-react';
import { canBlockBusinesses, grantBusinessGrace, setBusinessBlocked } from '@/api/platform';
import { patchInList, useApiMutation } from '@/api/request';
import { BusinessBackupsTab } from '@/areas/platform/businesses/BusinessBackupsTab';
import { BusinessInfoTab } from '@/areas/platform/businesses/BusinessInfoTab';
import { LeaveBusinessDialog } from '@/areas/platform/businesses/LeaveBusinessDialog';
import type { BusinessOverviewRow } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { addDays, today } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';

type BlockArgs = { id: string; blocked: boolean };

export function BusinessSheet({ row, onClose }: { row: BusinessOverviewRow; onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'info' | 'backups'>('info');
  const [leaving, setLeaving] = useState(false);
  const format = useFormat();
  // Ответ 30 (17.11.2026): заморожен за неуплату — «Отсрочка N дней» (кабинет работает до даты), а не «Вернуть в работу»
  const [graceOpen, setGraceOpen] = useState(false);
  const [graceDays, setGraceDays] = useState('7');
  const grace = useApiMutation((a: { id: string; days: number }) => grantBusinessGrace(a.id, a.days), {
    optimistic: patchInList(['platform', 'businesses'], (a: { id: string; days: number }) => ({ id: a.id, patch: { status: 'active', frozenReason: undefined, graceUntil: addDays(today(), a.days) } })),
  });
  const days = Number(graceDays);
  const daysValid = Number.isInteger(days) && days >= 1 && days <= 60;
  const handleGrace = async () => {
    if (!daysValid) return;
    try {
      await grace.mutate({ id: row.id, days });
      toast.success(t('businesses.graceDone', { name: row.name, date: format.date(addDays(today(), days)) }));
      setGraceOpen(false);
    } catch {
      toast.error(t('businesses.actionFailed'));
    }
  };
  // Строка в списке меняет статус сразу (оптимистично), список не перечитывается целиком
  const block = useApiMutation((a: BlockArgs) => setBusinessBlocked(a.id, a.blocked), {
    optimistic: patchInList(['platform', 'businesses'], (a: BlockArgs) => ({ id: a.id, patch: { status: a.blocked ? 'frozen' : 'active' } })),
  });

  const toggleBlock = async () => {
    const blocked = row.status !== 'frozen';
    const ok = await confirm(
      blocked
        ? { title: t('businesses.blockConfirm', { name: row.name }), description: t('businesses.blockConfirmText'), confirmLabel: t('businesses.block'), tone: 'danger' }
        : { title: t('businesses.unblockConfirm', { name: row.name }), description: t('businesses.unblockConfirmText'), confirmLabel: t('businesses.unblock'), tone: 'primary' },
    );
    if (!ok) return;
    try {
      await block.mutate({ id: row.id, blocked });
      toast.success(blocked ? t('businesses.blocked', { name: row.name }) : t('businesses.unblocked', { name: row.name }));
    } catch {
      toast.error(t('businesses.actionFailed'));
    }
  };

  const blockItem: DropdownMenuItem =
    row.status === 'frozen' && row.frozenReason === 'payment'
      ? { id: 'grace', label: t('businesses.grace'), icon: <CalendarClock aria-hidden />, onSelect: () => setGraceOpen(true) }
      : row.status === 'frozen'
        ? { id: 'unblock', label: t('businesses.unblock'), icon: <PlayCircle aria-hidden />, onSelect: () => void toggleBlock() }
        : { id: 'block', label: t('businesses.block'), icon: <PauseCircle aria-hidden />, danger: true, onSelect: () => void toggleBlock() };
  const menu: DropdownMenuItem[] =
    row.status === 'left'
      ? []
      : [...(canBlockBusinesses() ? [blockItem] : []), { id: 'left', label: t('businesses.markLeft'), icon: <DoorOpen aria-hidden />, danger: true, onSelect: () => setLeaving(true) }];

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={row.name}
      description={row.status !== 'active' ? undefined : t(`businesses.kind.${row.kind}`)}
      size="md"
      headerActions={
        menu.length ? <DropdownMenu label={t('businesses.more')} trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('businesses.more')} size="sm" />} items={menu} /> : undefined
      }
    >
      <div data-f="F-00-183" className="flex flex-col gap-5">
        {row.status !== 'active' && (
          <Badge tone={row.status === 'left' ? 'danger' : 'warning'} className="self-start">
            {row.status === 'frozen' && row.frozenReason === 'payment' ? t('businesses.frozenPayment') : t(`businesses.status.${row.status}`)}
          </Badge>
        )}
        {row.status === 'active' && row.graceUntil && (
          <Badge tone="info" className="self-start">
            {t('businesses.graceUntil', { date: format.date(row.graceUntil) })}
          </Badge>
        )}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'info' | 'backups')}
          items={[
            { value: 'info', label: t('businesses.tabInfo') },
            { value: 'backups', label: t('businesses.tabBackups') },
          ]}
        />
        {tab === 'info' ? <BusinessInfoTab row={row} /> : <BusinessBackupsTab businessId={row.id} />}
      </div>
      <LeaveBusinessDialog row={row} open={leaving} onOpenChange={setLeaving} />
      <Modal open={graceOpen} onOpenChange={setGraceOpen} title={t('businesses.graceTitle', { name: row.name })} description={t('businesses.graceText')}>
        <div className="flex flex-col gap-3">
          <FormField label={t('businesses.graceDays')} error={graceDays && !daysValid ? t('businesses.graceDaysRange') : undefined}>
            <Input inputMode="numeric" value={graceDays} onChange={(e) => setGraceDays(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </FormField>
          {daysValid && <p className="text-sm text-muted">{t('businesses.graceWorksUntil', { date: format.date(addDays(today(), days)) })}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setGraceOpen(false)}>
              {t('businesses.leaveCancel')}
            </Button>
            <Button loading={grace.isPending} disabled={!daysValid} onClick={() => void handleGrace()}>
              {t('businesses.graceConfirm', { days: daysValid ? days : 0 })}
            </Button>
          </div>
        </div>
      </Modal>
    </Sheet>
  );
}
