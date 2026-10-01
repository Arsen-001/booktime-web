'use client';

/**
 * Вкладка «Тарифы» карточки приложения (F-13-012) — сетка тарифов партнёра.
 * F-15-095 «Платные приложения маркетплейса»: деньги за платное приложение идут партнёру-разработчику,
 * не нам (наша карточка — только подключение); решение принято по F-00-009 — свои функции по просьбам
 * делаем сами бесплатно, сторонний платный маркетплейс не строим как источник дохода, но карточки с ценой
 * партнёра в каталоге интеграций остаются (партнёр вправе брать свою плату за СВОЁ приложение).
 */
import { CheckCircle2 } from 'lucide-react';
import type { CatalogApp } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';

export function AppPricingTab({ app }: { app: CatalogApp }) {
  const t = useT('integrations');
  const plans = app.plans ?? [];
  return (
    <div className="flex flex-col gap-3" data-f="F-13-012 F-15-095">
      {plans.length > 0 ? (
        <p className="text-xs text-muted">{t('plan.partnerBillingNote')}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.name} className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-fg">{plan.name}</p>
            <p className="text-lg font-semibold text-fg">
              {plan.currency === 'AMD' ? `${plan.price.toLocaleString('ru-RU')} ֏` : `${plan.price} ${plan.currency}`}
              <span className="text-sm font-normal text-muted"> / {t(`plan.period.${plan.period}` as never)}</span>
            </p>
            <ul className="flex flex-col gap-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm text-muted">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-text" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
