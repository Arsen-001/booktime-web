'use client';

/**
 * «Оплата картой скоро — напишите нам» (06.10.2026, F-00-022/026, F-15-089). Платёжный провайдер (ArCa / Idram /
 * Telcell) ещё не подключён — сервер не принимает оплату картой (`paymentsAvailable: false`). Вместо кнопки оплаты
 * экраны подписки, оформления и монет показывают эту плашку: одно нажатие отправляет обращение в поддержку (тема
 * «Оплата», как «Оплата через поддержку» на «Правилах подписки»), рядом — почта поддержки.
 */
import { CreditCard, MessageCircle } from 'lucide-react';
import { createHelpRequest } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

/** Почта поддержки — та же, что в OPERATOR (src/areas/client/legal/operator.ts) */
const SUPPORT_EMAIL = 'info@booktime.am';

export function PaymentsSoonNotice({ what = 'subscription' }: { what?: 'subscription' | 'coins' }) {
  const t = useT('settings');
  const toast = useToast();
  const { businessId, staffId } = useCurrent();
  const contact = useApiMutation(createHelpRequest);

  const onContact = async () => {
    if (!businessId || !staffId) return;
    try {
      await contact.mutate({ businessId, authorStaffId: staffId, topic: 'billing', message: t(`paymentsSoon.requestMessage.${what}`) });
      toast.success(t('paymentsSoon.sent'));
    } catch {
      toast.error(t('paymentsSoon.failed'));
    }
  };

  return (
    <div data-f="F-00-022 F-15-089" role="status" className="flex flex-col gap-3 rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-text">
      <span className="flex items-start gap-2">
        <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-medium">{t('paymentsSoon.title')}</span>
          <span className="opacity-90">{t(`paymentsSoon.text.${what}`)}</span>
          <span className="opacity-90">
            {t('paymentsSoon.emailLabel')}{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>
          </span>
        </span>
      </span>
      <Button variant="secondary" size="sm" className="self-start" leftIcon={<MessageCircle aria-hidden />} loading={contact.isPending} onClick={() => void onContact()}>
        {t('paymentsSoon.contact')}
      </Button>
    </div>
  );
}
