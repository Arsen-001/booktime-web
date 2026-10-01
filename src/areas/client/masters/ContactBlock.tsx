'use client';

import { useState } from 'react';
import { AtSign, MessageCircle, Phone, PhoneCall, Send } from 'lucide-react';
import type { MasterCard } from '@/api/client';
import { CallbackModal } from '@/areas/client/masters/CallbackModal';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useOrigin } from '@/areas/client/useOrigin';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { telLink, waLink } from '@/lib/phone';
import { Button, buttonClasses } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

/**
 * Связаться (F-00-104…F-00-107): каналы — одинаковыми кнопками в сетке 2 колонки, пояснение — над ними, «Попросить
 * перезвонить» — отдельной строкой (ux-r1 №22). Звонок открыт или нет — решает правило ядра canCallNow (api).
 * Телефон мастера приходит, только если он открыл звонок или WhatsApp (DTO без номера по умолчанию).
 *
 * F-00-107 (решение владельца, 26.09.2026): есть ближайшее окно — готовый текст несёт ещё и ссылку
 * <origin>/claim/<token> на него; card.claimToken минтится вместе с карточкой (api/client.ts getMasterCard),
 * так что ссылка готова ДО клика — открытию WhatsApp/копированию в буфер не нужен лишний сетевой шаг.
 */
export function ContactBlock({ card }: { card: MasterCard }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const origin = useOrigin();
  const [callbackOpen, setCallbackOpen] = useState(false);
  const { staff, contacts, nearestSlots, claimToken } = card;
  const next = nearestSlots[0]?.start;
  const claimLink = next && claimToken ? `${origin}/claim/${claimToken}` : undefined;
  const messageText = next
    ? `${t('master.bookSlot')}: ${fmt.relativeDay(next)}, ${fmt.time(next)}${claimLink ? `\n${claimLink}` : ''}`
    : t('master.contactTitle');
  const callOpen = contacts.callOpenNow && Boolean(contacts.phone);
  const closedKey =
    contacts.callMode === 'messages' ? 'callClosedMessages' : contacts.callMode === 'busy' ? 'callClosedBusy' : 'callClosedHours';

  const openWith = async (url: string) => {
    if (await copyText(messageText)) toast.info(t('master.textCopied'));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <SectionCard title={t('master.contactTitle')}>
      <div data-f="F-00-104 F-00-105 F-00-107" className="flex flex-col gap-3">
        {!callOpen && <p className="text-sm text-muted">{t(`master.${closedKey}`)}</p>}
        <div className="grid grid-cols-2 gap-2">
          {callOpen && contacts.phone && (
            <a href={telLink(contacts.phone)} className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
              <Phone aria-hidden />
              {t('master.call')}
            </a>
          )}
          {contacts.whatsapp && contacts.phone && (
            <a href={waLink(contacts.phone, messageText)} target="_blank" rel="noreferrer" className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
              <MessageCircle aria-hidden />
              {t('master.whatsapp')}
            </a>
          )}
          {contacts.telegram && (
            <Button variant="secondary" fullWidth leftIcon={<Send aria-hidden />} onClick={() => void openWith(`https://t.me/${contacts.telegram}`)}>
              {t('master.telegram')}
            </Button>
          )}
          {contacts.instagram && (
            <Button variant="secondary" fullWidth leftIcon={<AtSign aria-hidden />} onClick={() => void openWith(`https://instagram.com/${contacts.instagram}`)}>
              {t('master.instagram')}
            </Button>
          )}
        </div>
        {!callOpen && (
          <Button data-f="F-00-106" variant="ghost" fullWidth leftIcon={<PhoneCall aria-hidden />} onClick={() => setCallbackOpen(true)}>
            {t('master.askCallback')}
          </Button>
        )}
      </div>
      <CallbackModal open={callbackOpen} onOpenChange={setCallbackOpen} staffId={staff.id} />
    </SectionCard>
  );
}
