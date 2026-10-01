'use client';

/**
 * /biz/clients/consent/[clientId] — анкета/согласие по ссылке (F-04-154, «FastSign-lite»): мастер
 * копирует эту ссылку из карточки клиента («Скопировать ссылку анкеты») и отправляет клиенту, тот
 * заполняет с телефона без входа в кабинет и без установки приложений. Ответы попадают прямо в
 * карточку; профильные поля (имя, дата рождения) спрашиваются только при первом визите — если они уже
 * заполнены, форма сразу переходит к согласию (F-04-154 «Готово, когда»: на повторном визите профильные
 * вопросы не задаются).
 *
 * Клиентская страница без каркаса кабинета (Э5, clients-review 27.09.2026): `BizShell` отдаёт этот один
 * маршрут `/biz/clients/consent/[clientId]` без бокового меню и полос, по центру, как публичную страницу —
 * ровно то, что видит клиент, открывший присланную ссылку. PDF-квитанция — не настоящий PDF, а текстовая
 * карточка «сохранённой» анкеты (реальная генерация PDF в браузере без бэкенда не входит в эту пачку —
 * см. qa/build/clients-b05.md, partial).
 */
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, FileCheck2 } from 'lucide-react';
import { coreGet } from '@/api/core';
import { submitConsentForm } from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { today } from '@/lib/date';

export function ConsentFormScreen() {
  const t = useT('clients');
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;

  const clientQ = useApiQuery(['clients', 'consentTarget', clientId], () => coreGet('clients', clientId), { enabled: Boolean(clientId) });
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);
  const submit = useApiMutation(submitConsentForm);

  if (clientQ.isError) return <ErrorState onRetry={clientQ.refetch} />;
  if (clientQ.isLoading || !clientQ.data) return <Skeleton lines={6} />;

  const client = clientQ.data;
  // F-04-154: дата рождения уже на карточке — анкету по этой ссылке уже заполняли, это не первый визит,
  // спрашиваем только согласие (профильные поля на повторных визитах не задаются)
  const needsProfile = !client.birthday;

  const doSubmit = async () => {
    await submit.mutate({
      clientId,
      name: needsProfile ? name : undefined,
      birthday: needsProfile ? (birthday ?? undefined) : undefined,
      adConsentGiven: agree,
    });
    setDone(true);
  };

  if (done) {
    return (
      <div data-f="F-04-154" className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 aria-hidden className="size-12 text-success" />
        <p className="text-lg font-semibold text-fg">{t('consentForm.doneTitle')}</p>
        <Card padding="md" className="flex w-full items-center gap-3 text-left">
          <FileCheck2 aria-hidden className="size-8 shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{t('consentForm.receiptTitle')}</p>
            <p className="text-xs text-muted">{t('consentForm.receiptHint')}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-f="F-04-154 F-04-153" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('consentForm.title')} description={t('consentForm.subtitle')} />
      <Card padding="lg" className="flex flex-col gap-4">
        {needsProfile && (
          <>
            <FormField label={t('addClientForm.form.name')} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label={t('addClientForm.form.birthday')} optional>
              <DatePicker value={birthday} onValueChange={setBirthday} clearable max={today()} />
            </FormField>
          </>
        )}
        <Checkbox checked={agree} onCheckedChange={setAgree} label={t('consentForm.agree')} />
        <Button disabled={(needsProfile && !name.trim()) || !agree} loading={submit.isPending} onClick={doSubmit}>
          {t('consentForm.submit')}
        </Button>
      </Card>
    </div>
  );
}
