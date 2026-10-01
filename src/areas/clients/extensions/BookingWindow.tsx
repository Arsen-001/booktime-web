'use client';

/**
 * Вклад раздела «clients» в окно записи (хост «bookingWindow»): мини-карточка клиента (F-04-093),
 * «Данные сети» (F-04-094) и правка примечания (F-04-095). Файл принадлежит разделу «clients».
 * Посмотреть вклад без хозяина хоста: /dev/ext/bookingWindow/clients
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, MessageCircle, MoreHorizontal, Pencil, Percent, Phone, Pin, PinOff, Search, Send, Smartphone, UserX } from 'lucide-react';
import {
  findClientByLoyaltyCode,
  getBookingReminder,
  getBookingWindowFavorites,
  getClientLoyalty,
  getClientRow,
  getCustomFieldValues,
  getShowLoyaltySearchInBookingWindow,
  listCustomFieldDefs,
  sendBookingWindowMessage,
  setBookingReminder,
  toggleBookingWindowFavorite,
  updateClientNote,
} from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import { BalanceText } from '@/areas/clients/components/BalanceText';
import { useClientsRights } from '@/areas/clients/lib/rights';
import { useCan } from '@/demo/hooks';
import { BOOKING_WINDOW_SECTIONS, type BookingWindowSection } from '@/domain/clients';
import type { BookingWindowExtProps } from '@/extensions/types';
import { useAfterSaveStep } from '@/extensions/saveHooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { telLink } from '@/lib/phone';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { IconButton } from '@/ui/IconButton';
import { KeyValueList } from '@/ui/KeyValueList';
import { Modal } from '@/ui/Modal';
import { Input } from '@/ui/Input';
import { FormField } from '@/ui/FormField';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/** Раздел «⋯ Ещё» → вкладка карточки клиента, которую открывает плитка/пункт меню (F-04-093) */
const SECTION_TAB: Partial<Record<BookingWindowSection, string>> = {
  profile: 'about',
  history: 'history',
  stats: 'stats',
  messages: 'calls',
  files: 'files',
};

export default function ClientsBookingWindow({ businessId, bookingId, draft, onDraftChange, registerAfterSave }: BookingWindowExtProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const toast = useToast();
  const router = useRouter();
  const canSee = useCan('clients.view');
  const rights = useClientsRights();
  const clientId = draft.clientId;

  // F-04-099: пока клиент в записи не выбран, при включённой настройке ищем его по номеру абонемента/сертификата
  const loyaltySearchSettingQ = useApiQuery(['clients', 'showLoyaltySearch', businessId], () => getShowLoyaltySearchInBookingWindow(businessId), {
    enabled: canSee && !clientId,
  });
  const [loyaltyCode, setLoyaltyCode] = useState('');
  const [loyaltySearchState, setLoyaltySearchState] = useState<'idle' | 'notFound'>('idle');
  const findByLoyalty = useApiMutation((code: string) => findClientByLoyaltyCode(businessId, code));

  const runLoyaltySearch = async () => {
    if (!loyaltyCode.trim()) return;
    try {
      const found = await findByLoyalty.mutate(loyaltyCode);
      if (found) {
        setLoyaltySearchState('idle');
        setLoyaltyCode('');
        onDraftChange?.({ clientId: found.clientId });
        toast.success(t('bookingWindow.loyaltySearch.found', { name: found.clientName }));
      } else {
        setLoyaltySearchState('notFound');
      }
    } catch {
      toast.error(t('card.saveFailed'));
    }
  };

  const rowQ = useApiQuery(['clients', 'row', businessId, clientId], () => getClientRow(businessId, clientId ?? ''), {
    enabled: canSee && Boolean(clientId),
  });
  const loyaltyQ = useApiQuery(['clients', 'loyalty', businessId, clientId], () => getClientLoyalty(businessId, clientId ?? ''), {
    enabled: canSee && Boolean(clientId),
  });
  const favoritesQ = useApiQuery(['clients', 'bookingWindowFavorites'], getBookingWindowFavorites, { enabled: canSee });
  // ux-r5 №11: у кого есть право на контакты (владелец, администратор) — полный номер и «Позвонить», как в базе
  const canSeeContacts = rights.contactsInCard;
  const toggleFavorite = useApiMutation(toggleBookingWindowFavorite);
  const saveNote = useApiMutation((args: { clientId: string; note: string }) => updateClientNote(args.clientId, args.note));

  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageChannel, setMessageChannel] = useState<'push' | 'whatsapp'>('push');
  const sendMessage = useApiMutation(sendBookingWindowMessage);

  // F-04-141: доп. поля клиента, только показ (правку — в карточке/форме клиента)
  const customDefsQ = useApiQuery(['clients', 'customFieldDefs', businessId], () => listCustomFieldDefs(businessId), {
    enabled: canSee && Boolean(clientId) && rights.viewCustomFields,
  });
  const customValuesQ = useApiQuery(['clients', 'customFieldValues', clientId], () => getCustomFieldValues(clientId ?? ''), {
    enabled: canSee && Boolean(clientId) && rights.viewCustomFields,
  });

  // F-04-100: своё напоминание и свой срок приглашения на повторный визит — для ОДНОЙ записи
  const reminderQ = useApiQuery(['clients', 'bookingReminder', bookingId], () => getBookingReminder(bookingId ?? ''), {
    enabled: Boolean(bookingId),
  });
  const [reminderOverride, setReminderOverride] = useState<{ date: string | null; days: string } | null>(null);
  const reminderDirty = reminderOverride !== null;
  const reminderDate = reminderOverride ? reminderOverride.date : (reminderQ.data?.remindAt?.slice(0, 10) ?? null);
  const revisitDays = reminderOverride
    ? reminderOverride.days
    : reminderQ.data?.revisitInviteDays !== undefined
      ? String(reminderQ.data.revisitInviteDays)
      : '';
  const setReminderDate = (date: string | null) => setReminderOverride({ date, days: revisitDays });
  const setRevisitDays = (days: string) => setReminderOverride({ date: reminderDate, days });
  const setReminder = useApiMutation(
    (args: { id: string; remindAt?: string; revisitInviteDays?: number }) =>
      setBookingReminder(args.id, { remindAt: args.remindAt as never, revisitInviteDays: args.revisitInviteDays }),
    { invalidates: (args) => [['clients', 'bookingReminder', args.id]] },
  );
  const saveReminder = async (id: string) => {
    await setReminder.mutate({
      id,
      remindAt: reminderDate ? `${reminderDate}T10:00` : undefined,
      revisitInviteDays: revisitDays.trim() ? Number(revisitDays) : undefined,
    });
  };
  // Создание записи: bookingId появляется только после сохранения — пишем своё после хозяина (arch-a1 №9)
  useAfterSaveStep(registerAfterSave, async (savedId) => {
    if (reminderDirty) await saveReminder(savedId);
  });

  // useT проверяет ключи компилятором — динамический ключ `more.${section}` не годится, поэтому карта заранее
  const sectionLabel: Record<BookingWindowSection, string> = {
    profile: t('bookingWindow.more.profile'),
    history: t('bookingWindow.more.history'),
    loyalty: t('bookingWindow.more.loyalty'),
    stats: t('bookingWindow.more.stats'),
    messages: t('bookingWindow.more.messages'),
    invoices: t('bookingWindow.more.invoices'),
    files: t('bookingWindow.more.files'),
  };
  const favorites = favoritesQ.data ?? [];
  const openSection = (section: BookingWindowSection) => {
    if (!clientId) return;
    const tab = SECTION_TAB[section];
    router.push(tab ? `/biz/clients/${clientId}?tab=${tab}` : `/biz/clients/${clientId}`);
  };

  if (!canSee) return null;

  // F-04-099: клиент ещё не выбран — если настройка включена, дать найти его по номеру лояльности
  if (!clientId) {
    if (!loyaltySearchSettingQ.data) return null;
    return (
      <div data-f="F-04-099 F-06-068" className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">{t('bookingWindow.loyaltySearch.title')}</p>
        <div className="flex gap-2">
          <Input
            value={loyaltyCode}
            onChange={(e) => {
              setLoyaltyCode(e.target.value);
              setLoyaltySearchState('idle');
            }}
            placeholder={t('bookingWindow.loyaltySearch.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runLoyaltySearch();
            }}
            aria-label={t('bookingWindow.loyaltySearch.title')}
          />
          <Button
            variant="outline"
            leftIcon={<Search aria-hidden className="size-4" />}
            loading={findByLoyalty.isPending}
            onClick={runLoyaltySearch}
            disabled={!loyaltyCode.trim()}
          >
            {t('bookingWindow.loyaltySearch.button')}
          </Button>
        </div>
        {loyaltySearchState === 'notFound' && <p className="text-sm text-danger">{t('bookingWindow.loyaltySearch.notFound')}</p>}
      </div>
    );
  }

  if (!rights.bookingWindowClientData) return null;
  if (rowQ.isLoading) {
    // Та же разметка, что с клиентом: плашка имени и телефона со звонком, кнопки разделов, категории, три цифры
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <Skeleton variant="circle" className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-fg">
              <SkeletonText width="16ch" />
            </p>
            <p className="truncate text-sm text-muted tabular-nums">
              <SkeletonText width="15ch" />
            </p>
          </div>
          {canSeeContacts && <Skeleton variant="rect" className="size-11 shrink-0 rounded-xl" />}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" />
        <div className="flex flex-wrap items-center gap-1.5">
          {favorites.map((section) => (
            <Button key={section} variant="outline" size="sm" disabled>
              {sectionLabel[section]}
            </Button>
          ))}
          <Button variant="ghost" size="sm" leftIcon={<MoreHorizontal aria-hidden className="size-4" />} disabled>
            {t('bookingWindow.more.button')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{t('bookingWindow.categories')}:</span>
          <span className="text-xs text-muted">
            <SkeletonText width="10ch" />
          </span>
        </div>
        <div className={`grid gap-2 text-center ${rights.viewAccounts ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {[t('bookingWindow.visits'), ...(rights.viewAccounts ? [t('bookingWindow.sold'), t('bookingWindow.balance')] : [])].map((label) => (
            <div key={label} className="rounded-lg bg-surface-2 p-2">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-base font-semibold text-fg">
                <SkeletonText width="6ch" />
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (rowQ.isError || !rowQ.data) return null;
  const row = rowQ.data;

  const startEdit = () => {
    setNote(row.note ?? '');
    setEditingNote(true);
  };

  const submitNote = async () => {
    try {
      await saveNote.mutate({ clientId, note });
      toast.success(t('card.saved'));
      setEditingNote(false);
    } catch {
      toast.error(t('card.saveFailed'));
    }
  };

  const canSendMessage = rights.bookingWindowClientData;
  const hasApp = Boolean(row.appUserId);

  return (
    <div className="flex flex-col gap-4">
      <div data-f="F-04-093 F-04-201 F-04-202" className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
        <Avatar name={row.name} src={row.avatar} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-fg">{row.name}</p>
          <p className="truncate text-sm text-muted tabular-nums">{canSeeContacts ? fmt.phone(row.phone) : fmt.maskedPhone(row.phone)}</p>
        </div>
        {canSeeContacts && (
          <a
            href={telLink(row.phone)}
            aria-label={t('card.call')}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-surface text-fg hover:bg-surface-3 [&_svg]:size-5"
          >
            <Phone aria-hidden />
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {row.noShowCount > 0 && (
          <Badge tone="warning" icon={<UserX aria-hidden />}>
            {t('card.noShowCount', { count: row.noShowCount })}
          </Badge>
        )}
        {/* F-04-055: скидка хранилась в карточке, но нигде не была видна в окне записи — теперь на виду у того, кто оформляет визит */}
        {row.discount > 0 && (
          <Badge data-f="F-04-055" tone="success" icon={<Percent aria-hidden />}>
            {t('bookingWindow.discount', { percent: row.discount })}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {favorites.map((section) => (
          <Button key={section} variant="outline" size="sm" onClick={() => openSection(section)}>
            {sectionLabel[section]}
          </Button>
        ))}
        <Button variant="ghost" size="sm" leftIcon={<MoreHorizontal aria-hidden className="size-4" />} onClick={() => setMoreOpen(true)}>
          {t('bookingWindow.more.button')}
        </Button>
      </div>

      {/* F-04-112: показ категорий клиента у записи — половина функции («в записи»); показ в сетке журнала
          строит раздел journal своими файлами (см. qa/requests/clients.md) */}
      <div data-f="F-04-111 F-04-112 F-15-130" className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">{t('bookingWindow.categories')}:</span>
        {row.tags.length > 0 ? (
          row.tags.map((tag) => (
            <Badge key={tag} tone="primary">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted">{t('bookingWindow.noCategories')}</span>
        )}
      </div>

      <div data-f="F-04-094 F-00-132" className={`grid gap-2 text-center ${rights.viewAccounts ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="text-sm text-muted">{t('bookingWindow.visits')}</p>
          <p className="text-base font-semibold text-fg">{row.visits}</p>
        </div>
        {rights.viewAccounts && (
          <>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-sm text-muted">{t('bookingWindow.sold')}</p>
              <p className="text-base font-semibold text-fg">{fmt.money(row.sold)}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-sm text-muted">{t('bookingWindow.balance')}</p>
              <p className="text-base font-semibold">
                <BalanceText balance={row.balance} />
              </p>
            </div>
          </>
        )}
      </div>
      {row.lastVisit && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <CalendarClock aria-hidden className="size-4" />
          {t('bookingWindow.lastVisit', { date: fmt.ago(row.lastVisit) })}
        </p>
      )}

      {rights.viewLoyalty && ((loyaltyQ.data?.certificates.length ?? 0) > 0 || (loyaltyQ.data?.subscriptions.length ?? 0) > 0) && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">{t('bookingWindow.loyalty.title')}</p>
          <div className="flex flex-col gap-1.5">
            {loyaltyQ.data?.certificates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                <span className="min-w-0 truncate text-fg">{c.name}</span>
                <span className={c.balance > 0 ? 'shrink-0 font-medium text-fg' : 'shrink-0 text-muted'}>
                  {c.balance > 0
                    ? t('bookingWindow.loyalty.certBalance', { balance: fmt.money(c.balance), total: fmt.money(c.total) })
                    : t('bookingWindow.loyalty.certUsed')}
                </span>
              </div>
            ))}
            {loyaltyQ.data?.subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                <span className="min-w-0 truncate text-fg">{s.name}</span>
                <span className={s.status === 'expired' ? 'shrink-0 text-muted' : 'shrink-0 font-medium text-fg'}>
                  {s.frozen
                    ? t('bookingWindow.loyalty.subFrozen')
                    : s.status === 'expired'
                      ? t('bookingWindow.loyalty.subExpired')
                      : t('bookingWindow.loyalty.subVisits', { remaining: s.remainingVisits, total: s.totalVisits })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {canSendMessage && (
        <div data-f="F-04-100" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <Send aria-hidden className="size-4 text-muted" />
            <p className="text-sm font-semibold text-fg">{t('bookingWindow.message.title')}</p>
          </div>
          <Textarea
            rows={2}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={t('bookingWindow.message.placeholder')}
            aria-label={t('bookingWindow.message.title')}
          />
          <SegmentedControl
            size="sm"
            value={hasApp ? messageChannel : 'whatsapp'}
            onValueChange={(v) => setMessageChannel(v as 'push' | 'whatsapp')}
            options={[
              { value: 'push', label: t('bulk.message.channel.push'), icon: <Smartphone aria-hidden />, disabled: !hasApp },
              { value: 'whatsapp', label: t('bulk.message.channel.whatsapp'), icon: <MessageCircle aria-hidden /> },
            ]}
            aria-label={t('bookingWindow.message.channelLabel')}
          />
          {!hasApp && <p className="text-xs text-muted">{t('bookingWindow.message.noAppHint')}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={sendMessage.isPending}
              disabled={!messageText.trim()}
              onClick={async () => {
                const channel = hasApp ? messageChannel : 'whatsapp';
                const text = messageText.trim();
                try {
                  if (channel === 'whatsapp') {
                    window.open(`https://wa.me/${row.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                  }
                  await sendMessage.mutate({ businessId, clientId, text, channel });
                  toast.success(t('bookingWindow.message.sent'));
                  setMessageText('');
                } catch {
                  toast.error(t('card.saveFailed'));
                }
              }}
            >
              {t('bookingWindow.message.send')}
            </Button>
          </div>
        </div>
      )}

      {canSendMessage && (bookingId || registerAfterSave) && (
        <div data-f="F-04-100" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-sm font-semibold text-fg">{t('bookingWindow.reminder.title')}</p>
          <div className="flex flex-col gap-2 @sm:flex-row">
            <FormField label={t('bookingWindow.reminder.remindAt')} className="flex-1">
              <DatePicker value={reminderDate as never} onValueChange={(d) => setReminderDate(d)} clearable />
            </FormField>
            <FormField label={t('bookingWindow.reminder.revisitDays')} className="flex-1">
              <Input
                type="number"
                min={0}
                max={365}
                value={revisitDays}
                onChange={(e) => setRevisitDays(e.target.value)}
                placeholder={t('bookingWindow.reminder.revisitPlaceholder')}
              />
            </FormField>
          </div>
          {bookingId && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                loading={setReminder.isPending}
                disabled={!reminderDirty}
                onClick={async () => {
                  try {
                    await saveReminder(bookingId);
                    setReminderOverride(null);
                    toast.success(t('card.saved'));
                  } catch {
                    toast.error(t('card.saveFailed'));
                  }
                }}
              >
                {t('card.save')}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">{t('bookingWindow.reminder.hint')}</p>
        </div>
      )}

      {rights.viewCustomFields && (customDefsQ.data ?? []).some((d) => d.alwaysShowInBookingWindow) && (
        <div data-f="F-04-141" className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">{t('bookingWindow.customFields.title')}</p>
          <KeyValueList
            items={(customDefsQ.data ?? [])
              .filter((def) => def.alwaysShowInBookingWindow)
              .map((def) => ({ label: def.label, value: customValuesQ.data?.[def.id]?.trim() || t('cardView.noValue') }))}
          />
        </div>
      )}

      {rights.viewNote && (
        <div data-f="F-04-095" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">{t('form.note')}</p>
            {!editingNote && rights.editNote && (
              <Button variant="ghost" size="sm" leftIcon={<Pencil aria-hidden className="size-3.5" />} onClick={startEdit}>
                {t('bookingWindow.editNote')}
              </Button>
            )}
          </div>
          {editingNote ? (
            <div className="flex flex-col gap-2">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingNote(false)}>
                  {t('addClientForm.cancel')}
                </Button>
                <Button size="sm" loading={saveNote.isPending} onClick={submitNote}>
                  {t('card.save')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg">{row.note || t('bookingWindow.noNote')}</p>
          )}
        </div>
      )}

      <Modal open={moreOpen} onOpenChange={setMoreOpen} title={t('bookingWindow.more.title')} description={t('bookingWindow.more.hint')}>
        <ul className="flex flex-col gap-1">
          {BOOKING_WINDOW_SECTIONS.map((section) => {
            const isFav = favorites.includes(section);
            return (
              <li key={section} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  fullWidth
                  className="justify-start"
                  onClick={() => {
                    setMoreOpen(false);
                    openSection(section);
                  }}
                >
                  {sectionLabel[section]}
                </Button>
                <IconButton
                  icon={isFav ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                  label={t('bookingWindow.more.toggleFavorite')}
                  variant={isFav ? 'secondary' : 'ghost'}
                  onClick={async () => {
                    try {
                      await toggleFavorite.mutate(section);
                    } catch {
                      toast.error(t('card.saveFailed'));
                    }
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}
