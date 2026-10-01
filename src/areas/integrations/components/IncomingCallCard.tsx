'use client';

/**
 * F-13-093: всплывающая карточка входящего звонка — имя, телефон, последний визит, «Записать», «В карточку»;
 * у нового номера — только поля имени. Настоящий глобальный слот (левый нижний угол каркаса кабинета) — просьба
 * в фундамент (qa/requests/integrations.md); здесь — демо-показ по кнопке «Проверить звонок» на карточке АТС.
 */
import { useState } from 'react';
import { PhoneIncoming, X } from 'lucide-react';
import type { DemoIncomingCall } from '@/api/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';

export function IncomingCallCard({ call, onClose }: { call: DemoIncomingCall; onClose: () => void }) {
  const t = useT('integrations');
  const { dateTime } = useFormat();
  const [newName, setNewName] = useState('');

  return (
    <Card
      data-f="F-13-093 F-01-202 F-01-203"
      role="status"
      className="fixed bottom-4 left-4 z-50 flex w-[min(340px,calc(100vw-2rem))] flex-col gap-3 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <PhoneIncoming className="h-4 w-4" aria-hidden />
          </span>
          {call.isKnown ? call.clientName : t('call.newNumber')}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('call.close')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="text-sm text-muted">{call.phone}</p>

      {call.isKnown ? (
        <p className="text-xs text-muted">{call.lastVisitAt ? t('call.lastVisit', { date: dateTime(call.lastVisitAt) }) : t('call.noVisitsYet')}</p>
      ) : (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('call.newNumberNamePlaceholder')}
          className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-primary"
        />
      )}

      <div className="flex gap-2">
        <LinkButton href={call.isKnown && call.clientId ? `/biz/journal?clientId=${call.clientId}` : '/biz/journal'} size="sm" className="flex-1">
          {t('call.bookCta')}
        </LinkButton>
        {call.isKnown && call.clientId ? (
          <LinkButton href={`/biz/clients/${call.clientId}`} variant="secondary" size="sm" className="flex-1">
            {t('call.openCardCta')}
          </LinkButton>
        ) : (
          <Button variant="secondary" size="sm" className="flex-1" onClick={onClose} disabled={!newName.trim()}>
            {t('call.saveNewCta')}
          </Button>
        )}
      </div>
    </Card>
  );
}
