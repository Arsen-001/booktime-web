'use client';

/**
 * «Найти окно» (⭐ наше, 29.09.2026): администратор выбирает услугу — журнал подсвечивает в сетке все места, куда она
 * помещается у мастеров, которые её делают, а здесь — ближайшие окна списком. Нажатие на окно открывает новую запись
 * с мастером, временем и услугой. У Altegio свободное место ищут глазами по колонкам.
 * Внутри панели — поиск и список, без вложенных выпадающих списков (второй слой перекрыл бы панель).
 * У каждого окна — «Предложить» (и внизу — все окна разом): тот же слой переходит на шаг подтверждения
 * (SlotOfferConfirm) — кому уйдёт, сколько человек, одна кнопка «Отправить».
 */
import { CalendarSearch, Send, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import type { Id, Service, Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { fromMinutes } from '@/lib/date';
import { normalizeSearch, pickText } from '@/lib/text';
import type { SlotSuggestion } from '@/areas/journal/lib/findSlots';
import { SlotOfferConfirm } from '@/areas/journal/components/SlotOfferConfirm';
import { listSlotOffers } from '@/api/journal-offers';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Popover } from '@/ui/Popover';
import { SearchInput } from '@/ui/SearchInput';

export interface FindSlotButtonProps {
  /** Услуги, которые делает хоть один мастер с графиком на этот день */
  services: Service[];
  serviceId: Id | null;
  onServiceChange: (id: Id | null) => void;
  suggestions: SlotSuggestion[];
  staffById: Map<Id, Staff>;
  date: string;
  onPick: (staffId: Id, time: string) => void;
  /** Первая загрузка журнала: кнопка уже на своём месте, но не нажимается (услуг и окон ещё нет) */
  disabled?: boolean;
}

export function FindSlotButton({ services, serviceId, onServiceChange, suggestions, staffById, date, onPick, disabled }: FindSlotButtonProps) {
  const t = useT('journal');
  const format = useFormat();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  // Шаг «Предложить окно»: какие окна предлагаем (одно или все), null — список окон
  const [offering, setOffering] = useState<SlotSuggestion[] | null>(null);
  const { businessId } = useCurrent();
  const offersQ = useApiQuery(['journal', 'slot-offers', businessId, date], () => listSlotOffers(businessId ?? '', date), {
    enabled: Boolean(businessId && serviceId),
  });
  const offeredAt = offersQ.data ?? {};
  const service = services.find((s) => s.id === serviceId);
  const needle = normalizeSearch(query);
  const shown = services.filter((s) => !needle || normalizeSearch(pickText(s.name, locale)).includes(needle));

  return (
    <div className="flex items-center">
      <Popover
        align="end"
        mobile="sheet"
        label={t('board.findSlot.title')}
        onOpenChange={(open) => {
          if (!open) setOffering(null);
        }}
        trigger={(p) => (
          <Button
            {...p}
            // Клавиша «F» журнала нажимает эту кнопку (JournalWorkday)
            data-hotkey="find-slot"
            variant={service ? 'secondary' : 'outline'}
            leftIcon={<CalendarSearch aria-hidden />}
            disabled={disabled}
            className={cn(service && 'rounded-r-none pr-3')}
          >
            {/* Уже 1400px без выбранной услуги — только значок, чтобы дата в ряду управления не обрезалась */}
            <span className={cn('max-w-32 truncate', !service && 'md:max-[1399px]:sr-only', service && 'md:max-[1399px]:max-w-20')}>
              {service ? pickText(service.name, locale) : t('board.findSlot.button')}
            </span>
          </Button>
        )}
      >
        {({ close }) => (
          <div className="flex w-full flex-col gap-3 p-2 sm:w-96">
            {service && offering && businessId ? (
              <SlotOfferConfirm
                businessId={businessId}
                date={date}
                serviceId={service.id}
                serviceName={pickText(service.name, locale)}
                slots={offering}
                staffById={staffById}
                onBack={() => setOffering(null)}
                onSent={() => setOffering(null)}
              />
            ) : !service ? (
              <>
                <p className="px-1 text-sm font-semibold text-fg">{t('board.findSlot.title')}</p>
                {services.length === 0 ? (
                  <EmptyState compact title={t('board.findSlot.noServices')} />
                ) : (
                  <>
                    <SearchInput value={query} onValueChange={setQuery} placeholder={t('board.findSlot.searchService')} autoFocus />
                    <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                      {shown.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onServiceChange(s.id)}
                            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
                          >
                            <span className="min-w-0 truncate text-fg">{pickText(s.name, locale)}</span>
                            <span className="shrink-0 text-muted tabular-nums">{t('board.findSlot.dur', { min: s.durationMin })}</span>
                          </button>
                        </li>
                      ))}
                      {shown.length === 0 && <li className="px-2 py-3 text-sm text-muted">{t('board.findSlot.noMatch')}</li>}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{pickText(service.name, locale)}</p>
                    <p className="text-xs text-muted">{t('board.findSlot.dur', { min: service.durationMin })}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOffering(null);
                      onServiceChange(null);
                    }}
                    className="min-h-9 shrink-0 px-1 text-sm font-semibold text-primary-text">
                    {t('board.findSlot.change')}
                  </button>
                </div>
                {suggestions.length === 0 ? (
                  <EmptyState compact title={t('board.findSlot.none')} />
                ) : (
                  <>
                    <p className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">{t('board.findSlot.nearest')}</p>
                    <ul className="flex flex-col gap-0.5">
                      {suggestions.map((sg) => {
                        const staff = staffById.get(sg.staffId);
                        const time = fromMinutes(sg.start);
                        const offered = offeredAt[`${sg.staffId}|${time}`];
                        return (
                          <li key={`${sg.staffId}-${sg.start}`} className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={t('board.findSlot.pick', { time, name: staff?.name ?? '' })}
                              onClick={() => {
                                close();
                                onPick(sg.staffId, time);
                              }}
                              className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
                            >
                              <span className="w-12 shrink-0 font-semibold text-fg tabular-nums">{format.time(`${date}T${time}`)}</span>
                              {staff && <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="xs" />}
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-fg">{staff?.name}</span>
                                {offered && (
                                  <span className="truncate text-xs text-success">{t('board.findSlot.offered', { time: format.time(offered) })}</span>
                                )}
                              </span>
                            </button>
                            <IconButton
                              data-slot-offer
                              variant="ghost"
                              size="sm"
                              icon={<Send aria-hidden />}
                              label={t('board.findSlot.offerOne', { time: format.time(`${date}T${time}`), name: staff?.name ?? '' })}
                              onClick={() => setOffering([sg])}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    <p className="px-1 text-xs text-muted">{t('board.findSlot.hint')}</p>
                    {businessId && (
                      <Button variant="secondary" size="sm" fullWidth leftIcon={<Send aria-hidden />} onClick={() => setOffering(suggestions)}>
                        {t('board.findSlot.offerAll', { n: suggestions.length })}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Popover>
      {service && (
        <IconButton
          variant="secondary"
          className="rounded-l-none border-l border-border"
          icon={<X aria-hidden />}
          label={t('board.findSlot.clear')}
          onClick={() => {
            setQuery('');
            setOffering(null);
            onServiceChange(null);
          }}
        />
      )}
    </div>
  );
}
