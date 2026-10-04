'use client';

/**
 * «Как выгрузить клиентов из другой системы» — коротко, по шагам: Altegio (путь сверен со справкой Altegio 1274:
 * Clients → Client Database → Excel → Export to Excel), DIKIDI (⚠ не сверено с живым кабинетом), своя таблица /
 * Google Таблицы / Emly / Booker + шаблон файла (F-04-132: перенос командой — только описание и шаблон).
 */
import { FileSpreadsheet } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { downloadCsv } from '@/lib/csv';
import { Accordion } from '@/ui/Accordion';
import { Button } from '@/ui/Button';

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-fg marker:text-muted">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}

export function ImportHelp() {
  const t = useT('clients');
  const k = 'importPage.help';
  return (
    <div data-f="F-04-132" className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-fg">{t(`${k}.title`)}</h3>
      <Accordion
        variant="card"
        items={[
          {
            id: 'altegio',
            title: t(`${k}.altegio.title`),
            content: <Steps items={[t(`${k}.altegio.step1`), t(`${k}.altegio.step2`), t(`${k}.altegio.step3`), t(`${k}.altegio.step4`)]} />,
          },
          {
            id: 'dikidi',
            title: t(`${k}.dikidi.title`),
            content: <Steps items={[t(`${k}.dikidi.step1`), t(`${k}.dikidi.step2`), t(`${k}.dikidi.step3`)]} />,
          },
          {
            id: 'sheet',
            title: t(`${k}.sheet.title`),
            content: (
              <div className="flex flex-col gap-3">
                <Steps items={[t(`${k}.sheet.step1`), t(`${k}.sheet.step2`), t(`${k}.sheet.step3`)]} />
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<FileSpreadsheet aria-hidden />}
                    onClick={() => downloadCsv('booktime-clients-template.csv', `${t(`${k}.sheet.templateHeader`)}\r\n${t(`${k}.sheet.templateRow`)}\r\n`)}
                  >
                    {t(`${k}.sheet.template`)}
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
