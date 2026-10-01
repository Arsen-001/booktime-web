'use client';

/**
 * Витрина прохода 5 (хранитель дизайна): подтверждение номера кодом (PhoneVerify), клетки кода (CodeInput),
 * вкладки, которые не влезли (стрелка больше не режет подписи). Dev-страница: подписи по-русски прямо в коде.
 * В демо код «1234» подходит, любой другой — нет; отправка ждёт 600 мс.
 */
import { BarChart3, FolderOpen, History, Phone, User } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { CodeInput } from '@/ui/CodeInput';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneVerify } from '@/ui/PhoneVerify';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs md:p-6">
      <header>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

export function ShowcaseVerify() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <Section
        id="phone-verify"
        title="PhoneVerify · CodeInput"
        hint="Номер → куда прислать → код из сообщения → «ещё раз» через 30 с. В демо подходит код 1234."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Card padding="lg" className="flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-semibold text-fg">Вход по номеру</h3>
              <p className="mt-1 text-sm text-muted">Свои поля (имя, согласие) — детьми, между способом и кнопкой</p>
            </div>
            <PhoneVerify
              canSend={Boolean(name.trim()) && consent}
              onSendCode={() => wait(600)}
              onVerify={async ({ code: c }) => {
                await wait(500);
                if (c !== '1234') throw new Error('wrong');
                toast.success('Номер подтверждён');
              }}
              codeHint="В демо подходит код 1234"
            >
              <FormField label="Как к вам обращаться">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
              </FormField>
              <Checkbox checked={consent} onCheckedChange={setConsent} label="Согласен с условиями и обработкой данных" />
            </PhoneVerify>
          </Card>
          <Card padding="lg" className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-fg">Только SMS, код из 6 цифр</h3>
            <PhoneVerify
              channels={['sms']}
              codeLength={6}
              resendAfterSec={10}
              defaultPhone="+37400123456"
              onSendCode={() => wait(400)}
              onVerify={async () => {
                await wait(400);
                throw new Error('wrong');
              }}
            />
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-muted">CodeInput сам по себе · ошибка</p>
              <CodeInput value={code} onValueChange={setCode} />
              <CodeInput defaultValue="12" invalid />
            </div>
          </Card>
        </div>
      </Section>

      <Section
        id="tabs-overflow"
        title="Tabs — не влезли"
        hint="Под круглой стрелкой подпись уже погашена и проявляется плавно — без «…иента» на краю круга."
      >
        <div className="max-w-sm">
          <Tabs
            defaultValue="stats"
            items={[
              { value: 'card', label: 'Карточка клиента', icon: <User /> },
              { value: 'history', label: 'История визитов', icon: <History /> },
              { value: 'stats', label: 'Статистика', icon: <BarChart3 /> },
              { value: 'calls', label: 'Сообщения и звонки', icon: <Phone /> },
              { value: 'files', label: 'Файлы', icon: <FolderOpen /> },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}
