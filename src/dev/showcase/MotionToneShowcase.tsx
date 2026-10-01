'use client';

import { Bell, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Collapse } from '@/ui/Collapse';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { Modal } from '@/ui/Modal';
import { PRESETS, useMotionPreset } from '@/ui/motion';
import { Popover } from '@/ui/Popover';
import { Reveal } from '@/ui/Reveal';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { SharedTransition, startSharedTransition } from '@/ui/SharedTransition';
import { Sheet } from '@/ui/Sheet';
import { SkeletonList } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { tone } from '@/ui/tone';

/** Витрина движения (src/ui/motion.ts) и «тона» (src/ui/tone.ts). Dev-страница: тексты без словарей. */

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-fg">{title}</h2>
        <p className="mt-1 text-sm text-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Demo({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-3', className)}>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {children}
    </Card>
  );
}

const NAMES = ['Ани С.', 'Седа А.', 'Лилит Г.', 'Диана А.', 'Мане Б.', 'Нарине К.', 'Гоар П.'];

function ListDemo() {
  const [items, setItems] = useState([1, 2, 3]);
  const [next, setNext] = useState(4);
  const item = useMotionPreset(PRESETS.listItem);
  return (
    <Demo title="Список: добавить / убрать (listItem)">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus aria-hidden />}
          onClick={() => {
            setItems((xs) => [next, ...xs]);
            setNext((n) => n + 1);
          }}
        >
          Добавить
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((id) => (
            <m.li
              key={id}
              {...item}
              className="flex min-h-11 items-center justify-between rounded-md border border-border bg-surface px-3 text-sm"
            >
              <span>
                {NAMES[id % NAMES.length]} · запись №{id}
              </span>
              <button
                type="button"
                aria-label="Убрать"
                onClick={() => setItems((xs) => xs.filter((x) => x !== id))}
                className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length === 0 && <EmptyState variant="inline" title="Список пуст — нажмите «Добавить»" />}
    </Demo>
  );
}

function SharedDemo() {
  const [big, setBig] = useState(false);
  const t = tone('#9b1b30'); // tokens-ok: оттенок лака — данные
  return (
    <Demo title="Общий элемент (SharedTransition): карточка → окно">
      <p className="text-sm text-muted">Работает в браузерах с View Transitions (Chrome, Safari 18+); иначе — мгновенно.</p>
      <div className="relative min-h-44">
        {!big ? (
          <SharedTransition name="demo-booking">
            <button
              type="button"
              onClick={() => startSharedTransition(() => setBig(true))}
              style={{ background: t.fill, color: t.ink }}
              className="flex w-44 flex-col items-start rounded-lg p-3 text-left"
            >
              <span className="num-lg">12:00</span>
              <span className="text-sm font-semibold text-fg">Диана А.</span>
            </button>
          </SharedTransition>
        ) : (
          <SharedTransition name="demo-booking">
            <button
              type="button"
              onClick={() => startSharedTransition(() => setBig(false))}
              style={{ background: t.fill, color: t.ink }}
              className="flex w-full flex-col items-start gap-1 rounded-lg p-5 text-left"
            >
              <span className="num-display">12:00 – 13:45</span>
              <span className="text-base font-semibold text-fg">Диана А. · Маникюр + гель-лак</span>
              <span className="text-sm">Cherry 207 · нажмите, чтобы свернуть</span>
            </button>
          </SharedTransition>
        )}
      </div>
    </Demo>
  );
}

function MotionShowcase() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [left, setLeft] = useState(false);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('day');
  const [tab, setTab] = useState('all');

  const reload = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  return (
    <Section
      id="motion"
      title="Движение (src/ui/motion.ts)"
      lead="Длительности 150 / 220 / 320 мс, одна пружина (400 / 34). Только transform и opacity; при «уменьшить движение» — короткий crossfade."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Demo title="Окно и шторка">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setModal(true)}>Modal</Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Sheet (снизу / справа)
            </Button>
            <Button variant="secondary" onClick={() => setLeft(true)}>
              Sheet слева
            </Button>
          </div>
          <p className="text-sm text-muted">На телефоне шторку можно смахнуть вниз за ручку или шапку.</p>
          <Modal
            open={modal}
            onOpenChange={setModal}
            title="Новая запись"
            description="Десктоп — лёгкое увеличение, телефон — выезд снизу пружиной."
            footer={
              <>
                <Button variant="secondary" onClick={() => setModal(false)}>
                  Отмена
                </Button>
                <Button onClick={() => setModal(false)}>Сохранить</Button>
              </>
            }
          >
            <p className="text-sm text-muted">Закрытие — быстрее открытия (150 мс): старое уходит, не мешая.</p>
          </Modal>
          <Sheet open={sheet} onOpenChange={setSheet} title="Запись 12:00" description="Пружина stiffness 400, damping 34">
            <SkeletonList rows={4} />
          </Sheet>
          <Sheet open={left} onOpenChange={setLeft} side="left" size="sm" title="Меню">
            <p className="text-sm text-muted">Выезд слева — как меню кабинета на телефоне.</p>
          </Sheet>
        </Demo>

        <Demo title="Поповер · меню · тост">
          <div className="flex flex-wrap gap-2">
            <Popover
              label="Фильтр"
              trigger={(p) => (
                <Button variant="secondary" {...p}>
                  Все мастера
                </Button>
              )}
            >
              <p className="max-w-60 p-2 text-sm text-muted">Поповер растёт из стороны кнопки: 150 мс, scale 0.96 → 1.</p>
            </Popover>
            <DropdownMenu
              label="Продать"
              items={[
                { id: 'service', label: 'Услугу' },
                { id: 'product', label: 'Товар' },
                { id: 'cert', label: 'Сертификат' },
              ]}
              trigger={(p) => <Button {...p}>Продать</Button>}
            />
            <Button
              variant="ghost"
              leftIcon={<Bell aria-hidden />}
              onClick={() =>
                toast.success('Запись создана', { action: { label: 'Отменить', onClick: () => undefined } })
              }
            >
              Тост
            </Button>
          </div>
          <p className="text-sm text-muted">
            У всего, что открывает список, — стрелка ⌄, при открытии поворачивается на 180°.
          </p>
        </Demo>

        <Demo title="Вкладки и сегменты — индикатор скользит (WAAPI)">
          <SegmentedControl
            size="sm"
            aria-label="Вид"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'day', label: 'День' },
              { value: 'week', label: 'Неделя' },
              { value: 'month', label: 'Месяц' },
            ]}
          />
          <Tabs
            aria-label="Клиенты"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'all', label: 'Все', badge: 90 },
              { value: 'new', label: 'Новые', badge: 10 },
              { value: 'lost', label: 'Давно не были' },
            ]}
          />
          <Tabs
            variant="pill"
            aria-label="Период"
            items={[
              { value: 'today', label: 'Сегодня' },
              { value: 'week', label: 'Неделя' },
              { value: 'month', label: 'Месяц' },
            ]}
          />
        </Demo>

        <Demo title="Раскрытие · скелетон → содержимое">
          <Accordion
            variant="plain"
            items={[
              { id: 'a', title: 'Как работает лист ожидания', content: 'Содержимое проявляется и опускается на 6px; высоту не анимируем.' },
              { id: 'b', title: 'Что видит клиент', content: 'Страница мастера, свободные окна и цены.' },
            ]}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMore((v) => !v)} aria-expanded={more}>
              {more ? 'Скрыть' : 'Показать ещё'}
            </Button>
            <Button size="sm" variant="ghost" loading={loading} onClick={reload}>
              Обновить
            </Button>
          </div>
          <Collapse open={more} className="text-sm text-muted">
            Collapse: закрытый — не в DOM, открытие — opacity + сдвиг.
          </Collapse>
          <Reveal loading={loading} skeleton={<SkeletonList rows={2} />}>
            <ul className="divide-y divide-border text-sm">
              <li className="py-2.5">Диана А. — маникюр, 12:00</li>
              <li className="py-2.5">Сона Г. — педикюр, 14:30</li>
            </ul>
          </Reveal>
        </Demo>

        <ListDemo />
        <SharedDemo />
      </div>
    </Section>
  );
}

/** Оттенки из макета Cards2 (DESIGN.md). Цвета — данные (оттенок лака), поэтому hex прямо здесь. */
const SHADES: { name: string; hex: string; time: string; until: string; client: string; service: string; status: string; pending?: boolean }[] = [
  { name: 'Nude 012', hex: '#e9c6bd', time: '10:30', until: '11:15', client: 'Ани С.', service: 'Маникюр аппаратный', status: 'подтверждена' }, // tokens-ok
  { name: 'Cherry 207', hex: '#9b1b30', time: '12:00', until: '13:45', client: 'Диана А.', service: 'Маникюр + гель-лак', status: 'идёт сейчас' }, // tokens-ok
  { name: 'Rose milk', hex: '#e3a9c1', time: '14:30', until: '16:30', client: 'Нарине К.', service: 'Наращивание', status: 'ждёт ответа', pending: true }, // tokens-ok
  { name: 'Navy 402', hex: '#1f3a5f', time: '17:00', until: '18:00', client: 'Рузанна Д.', service: 'Педикюр классический', status: 'подтверждена' }, // tokens-ok
  { name: 'Sage', hex: '#8fb9a8', time: '14:30', until: '16:00', client: 'Нарине К.', service: 'SPA-педикюр', status: 'пришла' }, // tokens-ok
  { name: 'Emerald', hex: '#2e7d6b', time: '16:30', until: '18:00', client: 'Кристине А.', service: 'Маникюр + дизайн', status: 'ждёт ответа', pending: true }, // tokens-ok
];

function ToneCard({ shade }: { shade: (typeof SHADES)[number] }) {
  const t = tone(shade.hex);
  return (
    <div
      style={{ background: t.fill }}
      className={cn(
        'relative flex min-h-[132px] flex-col rounded-lg p-3.5',
        // Ждёт подтверждения: пунктир цвета warning с отступом 2px (DESIGN.md)
        shade.pending && 'outline-[1.5px] outline-offset-2 outline-warning outline-dashed',
      )}
    >
      {/* Капля лака: сам оттенок + кольцо 3px светлее */}
      <span
        aria-hidden
        style={{ background: t.drop, boxShadow: `0 0 0 3px ${t.ring}` }}
        className="absolute top-3.5 right-3.5 size-5 rounded-full"
      />
      <span style={{ color: t.ink }} className="num-display">
        {shade.time}
      </span>
      <span className="mt-0.5 text-sm font-semibold text-fg">{shade.client}</span>
      <span style={{ color: t.ink }} className="text-[13px]">
        {shade.service} · до {shade.until}
      </span>
      <span className="mt-auto self-start rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-primary-text">
        {shade.status} · {shade.name}
      </span>
    </div>
  );
}

function ToneShowcase() {
  return (
    <Section
      id="tone"
      title="Тон (src/ui/tone.ts)"
      lead="Карточка — светлый тон цвета лака (16% с белым), время — тёмный тон того же цвета (светлый ×0.45). Контраст считает функция: ≥ 4.5:1."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SHADES.map((s) => (
          <ToneCard key={s.name} shade={s} />
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Оттенок</th>
              <th className="px-4 py-2.5 font-medium">Капля · кольцо · заливка · текст</th>
              <th className="px-4 py-2.5 text-right font-medium">Контраст</th>
            </tr>
          </thead>
          <tbody>
            {SHADES.map((s) => {
              const t = tone(s.hex);
              return (
                <tr key={s.name} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium text-fg">{s.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                      {[t.drop, t.ring, t.fill, t.ink].map((c, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span aria-hidden style={{ background: c }} className="size-4 rounded-sm border border-border" />
                          {c}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge size="sm" tone={t.contrast >= 4.5 ? 'success' : 'danger'}>
                      {t.contrast.toFixed(2)}:1
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function MotionToneShowcase() {
  return (
    <div className="flex flex-col gap-14">
      <MotionShowcase />
      <ToneShowcase />
    </div>
  );
}
