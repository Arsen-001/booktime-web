'use client';

/**
 * Связь с клиентом — ряд круглых кнопок-иконок (К2, clients-review 27.09.2026: раньше было две главные кнопки
 * «Позвонить»/«Записать» и четыре подписанные кнопки связи одинаково крупные — теперь на карточке одна главная
 * («Записать», ClientCardScreen), а способы связи — компактный ряд с подсказкой/aria-label на каждой: телефон,
 * WhatsApp, Telegram, Viber. WhatsApp открывается с готовым приветствием от бизнеса (F-04-068). Без права на
 * контакты блока нет (F-04-214).
 */
import { MessageCircle, MessageSquare, Phone, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { tgLink, viberLink } from '@/areas/clients/lib/messengers';
import type { PreferredContact } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { telLink, waLink } from '@/lib/phone';
import { useTip } from '@/ui/hooks/useTip';

export interface ClientContactButtonsProps {
  phone: string;
  waText: string;
  /** F-04-066: канал клиента, которым просил связываться — первым в ряду */
  preferredContact?: PreferredContact;
}

interface ContactLink {
  id: PreferredContact;
  href: string;
  icon: ReactNode;
  label: string;
  external: boolean;
}

/** Одна круглая кнопка-иконка связи: своя подсказка (не системный title) + aria-label — DESIGN.md §0 */
function ContactIconLink({ href, icon, label, external, primary }: Omit<ContactLink, 'id'> & { primary: boolean }) {
  const { handlers, tip } = useTip(label);
  return (
    <>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        aria-label={label}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors [&_svg]:size-5',
          primary
            ? 'bg-primary text-primary-contrast shadow-xs hover:bg-primary-hover'
            : 'border border-border-strong/55 bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2',
        )}
        {...handlers}
      >
        {icon}
      </a>
      {tip}
    </>
  );
}

export function ClientContactButtons({ phone, waText, preferredContact = 'call' }: ClientContactButtonsProps) {
  const t = useT('clients');
  const links: ContactLink[] = [
    { id: 'call', href: telLink(phone), icon: <Phone aria-hidden />, label: t('card.call'), external: false },
    { id: 'wa', href: waLink(phone, waText), icon: <MessageCircle aria-hidden />, label: 'WhatsApp', external: true },
    { id: 'tg', href: tgLink(phone), icon: <Send aria-hidden />, label: 'Telegram', external: true },
    { id: 'viber', href: viberLink(phone), icon: <MessageSquare aria-hidden />, label: 'Viber', external: false },
  ];
  // F-04-066 (исправлено): просимый способ связи клиента — первой кнопкой (левый край ряда)
  links.sort((a, b) => Number(b.id === preferredContact) - Number(a.id === preferredContact));
  return (
    <div data-f="F-04-066 F-04-067 F-04-068 F-04-214 F-14-099 F-14-103 F-14-177 F-14-178 F-05-086 F-13-171" className="flex items-center gap-2">
      {links.map((l) => (
        <ContactIconLink key={l.id} {...l} primary={l.id === preferredContact} />
      ))}
    </div>
  );
}
