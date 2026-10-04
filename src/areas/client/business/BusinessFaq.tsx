'use client';

import { sectionTitle } from '@/areas/client/business/cta';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';

/**
 * Частые вопросы владельца. Цены — решение владельца 04.10.2026 (как в блоке «Цены»); данные — сервер в Нидерландах и ночная копия базы (docs/DEPLOY.md); выгрузка клиентов в Excel — clients
 * «Импорт и выгрузка»; приложения — «скоро» (собраны, в магазинах ещё нет).
 */
const ITEMS = ['price', 'switch', 'data', 'own', 'lang', 'apps'] as const;

export function BusinessFaq() {
  const t = useT('client');
  return (
    <section className="flex flex-col gap-7">
      <h2 className={sectionTitle}>{t('bizLanding.faq.title')}</h2>
      <Accordion
        className="rounded-2xl"
        items={ITEMS.map((id, i) => ({
          id,
          defaultOpen: i === 0,
          title: <span className="font-semibold">{t(`bizLanding.faq.${id}Q`)}</span>,
          content: <p className="max-w-[70ch]">{t(`bizLanding.faq.${id}A`)}</p>,
        }))}
      />
    </section>
  );
}
