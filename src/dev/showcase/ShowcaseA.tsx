'use client';

/**
 * Витрина UI-кита «A» (формы и отображение) со всеми вариантами и состояниями.
 * Dev-страница: подписи секций написаны прямо здесь; тексты самих компонентов — из i18n.
 */
import { useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  Download,
  Heart,
  Mail,
  Pencil,
  Plus,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { Accordion } from '@/ui/Accordion';
import { Avatar } from '@/ui/Avatar';
import { Badge, type BadgeTone, type BadgeVariant } from '@/ui/Badge';
import { Breadcrumbs } from '@/ui/Breadcrumbs';
import { Button, LinkButton, type ButtonVariant } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { Chip } from '@/ui/Chip';
import { Combobox } from '@/ui/Combobox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { KeyValueList } from '@/ui/KeyValueList';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { RadioGroup } from '@/ui/Radio';
import { SearchInput } from '@/ui/SearchInput';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Spinner } from '@/ui/Spinner';
import { StatCard } from '@/ui/StatCard';
import { Stepper } from '@/ui/Stepper';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { Timeline } from '@/ui/Timeline';
import { formatMoney } from '@/lib/money';
import { formatPhone, normalizePhone } from '@/lib/phone';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`a-${id}`} className="scroll-mt-20">
      <h2 className="mb-3 text-xl font-semibold text-fg">{title}</h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'link'];
const TONES: BadgeTone[] = ['neutral', 'primary', 'accent', 'success', 'warning', 'danger', 'info'];
const BADGE_VARIANTS: BadgeVariant[] = ['soft', 'solid', 'outline'];

const SERVICE_OPTIONS = [
  { value: 'mani', label: 'Маникюр с покрытием', description: '1 ч 30 мин · 8 000 ֏' },
  { value: 'pedi', label: 'Педикюр', description: '1 ч · 10 000 ֏' },
  { value: 'brows', label: 'Коррекция бровей', description: '30 мин · 4 000 ֏' },
  { value: 'removal', label: 'Снятие покрытия', description: '20 мин · 2 000 ֏' },
  { value: 'design', label: 'Дизайн ногтей', description: 'от 500 ֏' },
];

export function ShowcaseA() {
  const [loading, setLoading] = useState(false);
  const [combo, setCombo] = useState<string | null>('pedi');
  const [created, setCreated] = useState<string[]>([]);
  const [agree, setAgree] = useState(true);
  const [notify, setNotify] = useState(true);
  const [mode, setMode] = useState('free');
  const [view, setView] = useState('day');
  const [tab, setTab] = useState('visits');
  const [filters, setFilters] = useState<string[]>(['today']);
  const [tags, setTags] = useState<string[]>(['VIP', 'Постоянный']);
  const [phone, setPhone] = useState('+37400123');
  const [price, setPrice] = useState<number | undefined>(8000);
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(1);

  const toggleFilter = (id: string) =>
    setFilters((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const phoneComplete = normalizePhone(phone);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="UI-кит · часть A"
        description="Формы и отображение: все варианты и состояния. Армянский шрифт: Ժամ, Երևան — Գրանցվել մատնահարդարման։"
        breadcrumbs={[{ label: 'Для разработки', href: '/dev/ui' }, { label: 'UI-кит A' }]}
        back={{ href: '/dev/ui' }}
        meta={
          <>
            <Badge tone="primary">34 компонента</Badge>
            <Badge tone="success" dot>
              Токены
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="outline" leftIcon={<Download aria-hidden />}>
              Выгрузить
            </Button>
            <Button leftIcon={<Plus aria-hidden />}>Добавить</Button>
          </>
        }
      />

      <Section id="button" title="Button · LinkButton">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Row key={size} label={`size=${size}`}>
            {BUTTON_VARIANTS.map((v) => (
              <Button key={v} variant={v} size={size}>
                {v}
              </Button>
            ))}
          </Row>
        ))}
        <Row label="С иконками · loading · disabled">
          <Button leftIcon={<CalendarDays aria-hidden />}>Записаться</Button>
          <Button variant="secondary" rightIcon={<Plus aria-hidden />}>
            Ещё услуга
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            {loading ? 'Сохраняю…' : 'Нажми — loading'}
          </Button>
          <Button loading variant="outline">
            Загрузка
          </Button>
          <Button disabled>Недоступна</Button>
          <Button variant="danger" leftIcon={<Trash2 aria-hidden />} disabled>
            Удалить
          </Button>
        </Row>
        <Row label="fullWidth · LinkButton">
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button fullWidth>На всю ширину</Button>
            <LinkButton href="/dev/ui" variant="outline" fullWidth>
              Ссылка-кнопка
            </LinkButton>
          </div>
        </Row>
      </Section>

      <Section id="icon-button" title="IconButton">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Row key={size} label={`size=${size}`}>
            {(['ghost', 'secondary', 'outline', 'primary'] as const).map((v) => (
              <IconButton key={v} variant={v} size={size} label={`Изменить (${v})`} icon={<Pencil aria-hidden />} />
            ))}
            <IconButton size={size} label="Недоступна" icon={<Bell aria-hidden />} disabled />
          </Row>
        ))}
      </Section>

      <Section id="input" title="Input · Textarea">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Обычное поле" hint="Подсказка под полем">
            <Input placeholder="Имя клиента" />
          </FormField>
          <FormField label="С иконкой и кнопкой справа">
            <Input
              leftIcon={<Mail aria-hidden />}
              placeholder="email@example.com"
              rightSlot={<IconButton size="sm" label="Очистить" icon={<Trash2 aria-hidden />} />}
            />
          </FormField>
          <FormField label="Ошибка" error="Введите имя" required>
            <Input defaultValue="" placeholder="Обязательное поле" />
          </FormField>
          <FormField label="Недоступно">
            <Input disabled defaultValue="Только чтение" />
          </FormField>
          <FormField label="size=sm / lg" optional>
            <div className="flex w-full flex-col gap-2">
              <Input size="sm" placeholder="sm — 40 px" />
              <Input size="lg" placeholder="lg — 52 px" />
            </div>
          </FormField>
          <FormField label="Комментарий (autoResize)" hint="Растёт по содержимому">
            <Textarea autoResize placeholder="Пожелания клиента…" />
          </FormField>
          <FormField label="Textarea с ошибкой" error="Слишком коротко">
            <Textarea defaultValue="Да" />
          </FormField>
        </div>
      </Section>

      <Section id="select" title="Select (свой список, телефон — шторка) · Combobox">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Филиал" hint="С плейсхолдером">
            <Select
              placeholder="Выберите филиал"
              options={[
                { value: 'kentron', label: 'Кентрон, ул. Абовяна' },
                { value: 'arabkir', label: 'Арабкир, ул. Комитаса' },
                { value: 'closed', label: 'Закрыт на ремонт', disabled: true },
              ]}
            />
          </FormField>
          <FormField label="Шаг сетки">
            <Select
              defaultValue="30"
              options={[
                { value: '15', label: '15 минут' },
                { value: '30', label: '30 минут' },
                { value: '60', label: '1 час' },
              ]}
            />
          </FormField>
          <FormField label="Район" hint="Больше 8 вариантов — поиск в списке">
            <Select
              placeholder="Любой район"
              options={[
                'Аджапняк', 'Арабкир', 'Аван', 'Давташен', 'Эребуни', 'Кентрон', 'Малатия-Себастия', 'Нор-Норк',
                'Нубарашен', 'Шенгавит', 'Канакер-Зейтун', 'Норк-Мараш',
              ].map((d) => ({ value: d, label: d }))}
            />
          </FormField>
          <FormField label="Select с ошибкой" error="Выберите мастера">
            <Select options={[{ value: 'a', label: 'Анна' }]} />
          </FormField>
          <FormField label="Select недоступен">
            <Select disabled defaultValue="a" options={[{ value: 'a', label: 'Анна' }]} />
          </FormField>
          <FormField label="Услуга (Combobox, можно добавить свою)" hint={`Выбрано: ${combo ?? '—'}; добавлено: ${created.join(', ') || '—'}`}>
            <Combobox
              options={[...SERVICE_OPTIONS, ...created.map((c) => ({ value: c, label: c }))]}
              value={combo}
              onValueChange={setCombo}
              allowCreate
              onCreate={(text) => {
                setCreated((prev) => [...prev, text]);
                setCombo(text);
              }}
            />
          </FormField>
          <FormField label="Combobox: загрузка / пусто">
            <div className="flex w-full flex-col gap-2">
              <Combobox options={[]} loading placeholder="Ищем клиентов…" />
              <Combobox options={[]} emptyText="Клиентов с таким номером нет" placeholder="Пустой список" />
            </div>
          </FormField>
        </div>
      </Section>

      <Section id="choice" title="Checkbox · Switch · RadioGroup">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col">
            <Checkbox label="Согласен на уведомления" checked={agree} onCheckedChange={setAgree} />
            <Checkbox label="С описанием" description="Клиент получит пуш за 2 часа" defaultChecked />
            <Checkbox label="Частично выбрано" indeterminate />
            <Checkbox label="Недоступно" disabled />
            <Checkbox label="Недоступно, отмечено" disabled defaultChecked />
            <div className="flex items-center gap-1">
              <Checkbox aria-label="Без подписи" />
              <span className="text-sm text-muted">← без подписи (зона 44 px)</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Switch label="Онлайн-запись" checked={notify} onCheckedChange={setNotify} />
            <Switch label="Подтверждать вручную" description="Клиент ждёт вашего ответа" />
            <Switch label="Подпись слева" labelPosition="start" defaultChecked />
            <Switch label="Недоступно" disabled />
            <Switch label="Недоступно, вкл." disabled defaultChecked />
            <Switch aria-label="Без подписи" />
          </div>
          <div className="flex flex-col gap-3">
            <RadioGroup
              aria-label="Режим календаря"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'free', label: 'Всё свободно', description: 'Отмечаю занятое' },
                { value: 'busy', label: 'Всё занято', description: 'Открываю свободное' },
                { value: 'off', label: 'Недоступный вариант', disabled: true },
              ]}
            />
            <RadioGroup
              aria-label="Кого принимаю"
              orientation="horizontal"
              defaultValue="all"
              options={[
                { value: 'all', label: 'Всех' },
                { value: 'women', label: 'Женщин' },
                { value: 'men', label: 'Мужчин' },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section id="segmented" title="SegmentedControl · Tabs">
        <Row label="SegmentedControl md / sm / fullWidth">
          <SegmentedControl
            aria-label="Вид журнала"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'day', label: 'День' },
              { value: 'week', label: 'Неделя' },
              { value: 'month', label: 'Месяц' },
              { value: 'year', label: 'Год', disabled: true },
            ]}
          />
          <SegmentedControl
            aria-label="Размер"
            size="sm"
            defaultValue="list"
            options={[
              { value: 'list', label: 'Список', icon: <Users aria-hidden /> },
              { value: 'cal', label: 'Календарь', icon: <CalendarDays aria-hidden /> },
            ]}
          />
        </Row>
        <div className="max-w-md">
          <SegmentedControl
            aria-label="Для кого"
            fullWidth
            defaultValue="self"
            options={[
              { value: 'self', label: 'Для себя' },
              { value: 'child', label: 'Ребёнок' },
              { value: 'pet', label: 'Питомец' },
            ]}
          />
        </div>
        <Tabs
          aria-label="Карточка клиента"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'visits', label: 'Визиты', badge: 12 },
            { value: 'loyalty', label: 'Лояльность', icon: <Heart aria-hidden /> },
            { value: 'finance', label: 'Баланс и оплаты', icon: <Wallet aria-hidden /> },
            { value: 'messages', label: 'Сообщения', badge: 3 },
            { value: 'files', label: 'Файлы', disabled: true },
          ]}
          panels={{
            visits: <p className="text-muted">Панель «Визиты»: 12 визитов.</p>,
            loyalty: <p className="text-muted">Панель «Лояльность».</p>,
            finance: <p className="text-muted">Панель «Баланс и оплаты».</p>,
            messages: <p className="text-muted">Панель «Сообщения».</p>,
            files: null,
          }}
        />
        <Tabs
          aria-label="Отчёты"
          variant="pill"
          defaultValue="all"
          items={[
            { value: 'all', label: 'Все', badge: 24 },
            { value: 'money', label: 'Деньги' },
            { value: 'clients', label: 'Клиенты' },
            { value: 'stock', label: 'Склад' },
          ]}
        />
      </Section>

      <Section id="badge" title="Badge · Chip">
        {BADGE_VARIANTS.map((variant) => (
          <Row key={variant} label={`variant=${variant}`}>
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone} variant={variant}>
                {tone}
              </Badge>
            ))}
          </Row>
        ))}
        <Row label="size=sm · dot · icon">
          <Badge size="sm" tone="success" dot>
            Пришёл
          </Badge>
          <Badge size="sm" tone="warning" dot>
            Ждёт подтверждения
          </Badge>
          <Badge tone="accent" icon={<Sparkles aria-hidden />}>
            Горящее окно
          </Badge>
          <Badge tone="danger" variant="solid">
            Не пришёл
          </Badge>
        </Row>
        <Row label="Chip: фильтры, счётчик, крестик, disabled">
          {[
            { id: 'today', label: 'Свободно сегодня', count: 14 },
            { id: 'near', label: 'Рядом' },
            { id: 'home', label: 'Выезд ко мне', count: 3 },
          ].map((f) => (
            <Chip key={f.id} selected={filters.includes(f.id)} onClick={() => toggleFilter(f.id)} count={f.count}>
              {f.label}
            </Chip>
          ))}
          <Chip icon={<Scissors aria-hidden />} onRemove={() => undefined}>
            Барбер
          </Chip>
          <Chip selected onClick={() => undefined} onRemove={() => undefined}>
            Кентрон
          </Chip>
          <Chip disabled onClick={() => undefined}>
            Недоступно
          </Chip>
        </Row>
      </Section>

      <Section id="avatar" title="Avatar">
        <Row label="Размеры">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <Avatar key={size} name="Анна Саргсян" size={size} />
          ))}
        </Row>
        <Row label="colorIndex 1..8 · битая картинка → инициалы">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Avatar key={i} name={['Анна Г', 'Бабкен Т', 'Вардан О', 'Гаяне М', 'Давит А', 'Ева К', 'Жанна П', 'Зара Л'][i - 1]} colorIndex={i} size="lg" />
          ))}
          <Avatar name="Нет Фото" src="data:image/png;base64,AAAA" size="lg" />
          <Avatar name="Ժամ Երևան" size="lg" />
        </Row>
      </Section>

      <Section id="cards" title="Card · SectionCard · KeyValueList · Timeline">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="font-semibold">Card md</p>
            <p className="text-sm text-muted">Обычная карточка</p>
          </Card>
          <Card interactive padding="lg">
            <p className="font-semibold">Card interactive lg</p>
            <p className="text-sm text-muted">Подсветка при наведении</p>
          </Card>
          <Card padding="sm" as="article">
            <p className="font-semibold">Card sm (article)</p>
          </Card>
        </div>
        <SectionCard
          title="Клиент"
          description="Карточка клиента — пример секции"
          actions={
            <Button size="sm" variant="outline" leftIcon={<Pencil aria-hidden />}>
              Изменить
            </Button>
          }
          footer={
            <>
              <Button variant="ghost" size="sm">
                Отмена
              </Button>
              <Button size="sm">Сохранить</Button>
            </>
          }
        >
          <KeyValueList
            columns={2}
            items={[
              { label: 'Имя', value: 'Анна Саргсян' },
              { label: 'Телефон', value: formatPhone('+37400123456') },
              { label: 'Визитов', value: '12', hint: 'последний — 12 сентября' },
              { label: 'Потрачено', value: formatMoney(96000) },
            ]}
          />
        </SectionCard>
        <SectionCard title="История записи" padding="lg">
          <Timeline
            items={[
              { id: '1', title: 'Запись создана', time: '10:02', description: 'Через приложение', tone: 'info', icon: <CalendarDays aria-hidden /> },
              { id: '2', title: 'Мастер подтвердил', time: '10:15', tone: 'primary' },
              { id: '3', title: 'Клиент пришёл', time: '14:00', tone: 'success' },
              { id: '4', title: 'Оплата 8 000 ֏', time: '15:30', description: 'Наличными', tone: 'neutral', icon: <Wallet aria-hidden /> },
            ]}
          />
        </SectionCard>
        <SectionCard title="KeyValueList dense, 1 колонка">
          <KeyValueList
            dense
            items={[
              { label: 'Длительность', value: '1 ч 30 мин' },
              { label: 'Цена', value: '8 000–12 000 ֏' },
            ]}
          />
        </SectionCard>
      </Section>

      <Section id="stat" title="StatCard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Выручка за неделю" value={formatMoney(482000)} delta={12.5} icon={<Wallet aria-hidden />} />
          <StatCard label="Записей" value="64" delta={-3} icon={<CalendarDays aria-hidden />} />
          <StatCard label="Новых клиентов" value="9" delta={0} hint="из приложения — 6" />
          <StatCard label="Загрузка" value="—" loading icon={<Users aria-hidden />} />
        </div>
      </Section>

      <Section id="states" title="Skeleton · Spinner · EmptyState · ErrorState">
        <Row label="Skeleton">
          <div className="flex w-full max-w-md items-center gap-3">
            <Skeleton variant="circle" />
            <div className="flex-1">
              <Skeleton lines={3} />
            </div>
          </div>
          <Skeleton variant="rect" className="h-20 max-w-xs" />
        </Row>
        <Row label="Spinner sm / md / lg">
          <Spinner size="sm" />
          <Spinner />
          <Spinner size="lg" />
        </Row>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="none">
            <EmptyState
              title="Клиентов пока нет"
              description="Добавьте первого клиента или импортируйте базу из таблицы."
              action={<Button leftIcon={<Plus aria-hidden />}>Добавить клиента</Button>}
            />
          </Card>
          <Card padding="none">
            <ErrorState onRetry={() => undefined} />
          </Card>
          <Card padding="none">
            <EmptyState variant="section" kind="search" onReset={() => undefined} />
          </Card>
          <Card padding="none">
            <ErrorState compact title="Склад не загрузился" onRetry={() => undefined} />
          </Card>
          <EmptyState
            variant="section"
            framed
            icon={<Search aria-hidden />}
            title="Секция без данных"
            description="variant=section + framed — пустой блок посреди страницы"
          />
          <Card padding="sm" className="flex flex-col gap-1">
            <p className="px-3 pt-1 text-sm font-medium text-muted">variant=inline — список, день, меню</p>
            <EmptyState variant="inline" title="На этот день записей нет" />
            <EmptyState variant="inline" kind="search" />
          </Card>
        </div>
      </Section>

      <Section id="special" title="PhoneInput · MoneyInput · TagInput · SearchInput">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Телефон"
            required
            hint={phoneComplete ? `Полный номер: ${formatPhone(phoneComplete)}` : `Сейчас: «${phone}»`}
          >
            <PhoneInput value={phone} onValueChange={setPhone} />
          </FormField>
          <FormField label="Телефон с ошибкой" error="Номер должен быть из 8 цифр после +374">
            <PhoneInput defaultValue="+3740012" />
          </FormField>
          <FormField label="Цена услуги" hint={price === undefined ? 'Пусто' : `Значение: ${price}`}>
            <MoneyInput value={price} onValueChange={setPrice} />
          </FormField>
          <FormField label="Цена вне диапазона (max 50 000)">
            <MoneyInput defaultValue={120000} max={50000} />
          </FormField>
          <FormField label="Метки клиента" hint="Enter или запятая — добавить">
            <TagInput value={tags} onValueChange={setTags} suggestions={['VIP', 'Постоянный', 'Аллергия', 'Скидка 10%']} />
          </FormField>
          <FormField label="Поиск (debounce 300 мс)" hint={`Ищем: «${search}»`}>
            <SearchInput debounceMs={300} onValueChange={setSearch} placeholder="Имя или телефон" />
          </FormField>
          <FormField label="Недоступно">
            <PhoneInput disabled defaultValue="+37400123456" />
          </FormField>
          <FormField label="Недоступно">
            <MoneyInput disabled defaultValue={5000} />
          </FormField>
        </div>
      </Section>

      <Section id="nav" title="Stepper · Accordion · Breadcrumbs">
        <Stepper
          steps={[
            { id: 'service', label: 'Услуга' },
            { id: 'master', label: 'Мастер' },
            { id: 'time', label: 'Время' },
            { id: 'confirm', label: 'Подтверждение' },
          ]}
          current={step}
          onStepClick={setStep}
        />
        <Row>
          <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Назад
          </Button>
          <Button size="sm" disabled={step === 3} onClick={() => setStep((s) => Math.min(3, s + 1))}>
            Далее
          </Button>
        </Row>
        <Accordion
          items={[
            { id: 'q1', title: 'Как отменить запись?', content: 'Откройте «Мои записи» и нажмите «Отменить».', defaultOpen: true },
            { id: 'q2', title: 'Сколько стоит запись?', content: 'Для клиента запись бесплатна.' },
            { id: 'q3', title: 'Ինչպե՞ս գրանցվել', content: 'Ընտրեք վարպետին և ազատ ժամը։' },
          ]}
        />
        <Breadcrumbs
          items={[
            { label: 'Склад', href: '/biz/stock' },
            { label: 'Товары', href: '/biz/stock' },
            { label: 'Гель-лак «Вишня»' },
          ]}
        />
      </Section>
    </div>
  );
}
