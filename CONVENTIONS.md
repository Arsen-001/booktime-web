# CONVENTIONS — правила для 18 разделов

> 🔴 **Проверки отложены до бэкенда (26.09.2026), и после бэкенда они — на 100 %, всё заново.** Правила — [docs/TESTING-AFTER-BACKEND.md](docs/TESTING-AFTER-BACKEND.md). Любой проверяющий читает его первым.

Проект: интерфейс платформы записи на услуги в Армении. Клиенты ищут мастеров и записываются
(приложение клиента), мастера и салоны ведут бизнес (кабинет бизнеса), у нас своя панель
(наша панель). **Бэкенда нет** — все данные моковые и живут в браузере (localStorage).

- ТЗ: `/Users/arsen/WebstormProjects/booking-research/functional-map/` — `00-our-decisions.md`
  (наши решения, у них приоритет) и `01…16-*.md` (функции Altegio 1:1). Копируем **функционал**
  Altegio, но не их дизайн, тексты и экраны.
- Всё из раздела «Снято (не делаем)» в `00-our-decisions.md` не строим нигде (список — в конце файла).
- Карта разделов, путей, меню и точек расширения — [AREAS.md](AREAS.md).
- Next.js 16 отличается от того, что вы помните: перед кодом читайте `node_modules/next/dist/docs/`
  (коротко про важное — в §14).

---

## 0. 🔴 УДОБНО И КРАСИВО — главное требование пользователя (25.09.2026)

Пользователь: «очень важно, чтобы был user-friendly, красивый UI». Функция, которая работает, но выглядит
как таблица из админки 2010 года, — НЕ готова. Сборщик делает так, измеритель проверяет это наравне с «Готово, когда»
(нарушение — major):

- **Один главный путь на экране.** Главное действие — одна заметная кнопка primary; остальное — secondary/ghost или
  в меню «⋯». Никаких рядов из пяти одинаковых кнопок.
- **Иерархия.** Заголовок страницы → короткое пояснение (1 строка, text-muted) → содержимое. Сгруппированные поля —
  в SectionCard с заголовком; длинные формы — по шагам (Stepper) или секциями, а не стеной из 30 полей.
- **Воздух.** Отступы из шкалы (gap-2/3/4/6/8), между блоками ≥ 24px, внутри карточек 16–24px; строки таблиц не
  теснее 44px. Ничего не прилипает к краям; на телефоне поля 16px.
- **Телефон — первым.** 390×844: одна колонка, главное действие внизу у большого пальца (липкая кнопка или
  Sheet), таблицы → карточки, зоны нажатия ≥ 44px, текст не мельче 14px, ничего не вылезает по ширине.
- **Понятные слова.** Тексты с точки зрения человека («Записать клиента», «Свободно сегодня»), без терминов
  разработчика, без КАПСА; числа — с единицами («45 мин», «5 000 ֏»); даты — «сегодня / завтра / чт, 26 сент».
- **Пусто — не пустота.** Пустой экран = EmptyState с иконкой, одной фразой, зачем это, и кнопкой первого действия.
  Загрузка — Skeleton в форме содержимого, а не спиннер на весь экран. Ошибка — ErrorState с «Повторить».
- **Отклик на каждое действие.** Кнопка при ожидании крутит loading; после сохранения — Toast («Запись создана»);
  опасное — ConfirmDialog, а мелкое обратимое — «Отменить» в тосте вместо «Вы уверены?».
- **Состояния видны формой, а не только цветом:** статусы — Badge с иконкой/словом; выбранное — заметно; недоступное —
  с подсказкой почему.
- **Единообразие.** Только компоненты src/ui и токены; одинаковые вещи выглядят одинаково во всех разделах
  (карточка мастера, строка клиента, чип услуги). Перед созданием своего — поищи похожее в src/ui и у соседей.
- **Красота — через сдержанность:** один акцент (primary), мягкие тени только у поднятых слоёв, скругления из токенов,
  иконки lucide одного размера (16/20), аватары и фото мастеров там, где это люди. Никаких случайных цветов и эмодзи.
- **Проверка глазами:** после сборки открой свои экраны на телефоне и десктопе (measure.mjs), посмотри снимки
  (Read png) и спроси себя: «понятно ли за 3 секунды, что здесь делать?» Если нет — переделай, прежде чем сдавать.

**Браузеры (25.09.2026):** компьютер один, память 16 ГБ. Свои сценарии Playwright запускай через ограничитель: `import { acquireBrowserSlot } from '<путь>/scripts/pw-slots.mjs'; const release = await acquireBrowserSlot();` перед `chromium.launch()` и `release()`/`browser.close()` в конце (measure.mjs и qa/e2e/run.mjs уже так делают). Одновременно на компьютере не больше 4 браузеров.

## 0.1 🔴 Замечания проверяющих — ОБЯЗАТЕЛЬНО в работу (25.09.2026)

Проверка показала: из 55 дизайн-замечаний первого круга в разделе закрыто 4 — сборщики их не читали.
Поэтому в начале КАЖДОЙ пачки, починки и доделки сборщик раздела:
1. читает ВСЕ файлы `qa/measure/<свой id>/`, кроме своих замеров `b*-m*`/`g*-m*`: `ux-*` (дизайн), `speed-*` (секундомер),
   `arch-*` и `core-rules*` (архитектура, правила ядра), `state-*` (состояние), `decision-*` (наши решения), `recheck-*`,
   `e2e-*`, `text-*`, `a11y-*`, `build-*`, `onboarding-*`, `ux-best-*`, `core-*`;
2. исправляет все block и major, которые ещё не отмечены, — по экранам, которые трогает в этой пачке, и ещё
   как минимум 5 любых других (до 30% времени пачки — на замечания);
3. отмечает в том же файле под замечанием строку `✅ исправлено (<метка пачки>)` или `⏳ позже — почему`.
Сломанная сборка (ошибка компиляции) роняет dev-сервер ВСЕМ — перед сдачей обязательно tsc по своим файлам.

## 0.2 Вопросы к владельцу — копим до его ответа (25.09.2026)

Пользователь ответит на ВСЕ вопросы сразу (список — booking-research/functional-map/QUESTIONS.md, В-01…В-36).
Пока ответа нет — строй «по умолчанию» из QUESTIONS.md. Если по ходу работы появился НОВЫЙ вопрос, который может
решить только владелец (деньги и цены, правила для клиентов и мастеров, что видно публично, юридическое, спор нашего
решения с Altegio или с самим собой) — НЕ решай молча и не спрашивай в чате: допиши в `qa/questions/<свой id>.md`
блок: `### <короткий вопрос>` · суть 1–2 строки · варианты а)/б)/в) · что сделал по умолчанию · F-id. Мелочи «как
именно» решай сам и пиши в свой отчёт (assumed), а не сюда.

## 0.3 🔴 Только НАШИ окна и элементы + пустое состояние у ВСЕГО (25.09.2026)

Пользователь: «все модалки и алерты должны быть наши, а не нативные; для абсолютно всего должны быть пустые состояния».
- Запрещено (eslint ловит): `alert/confirm/prompt/print`, `<select>`, `<input type=date|time|datetime-local|month|week|color>`,
  `<dialog>`, системные подсказки `title="…"`. Вместо них: Toast, ConfirmDialog, Modal, Sheet, Select/Combobox,
  DatePicker/TimePicker/ColorPicker, Tooltip из `@/ui`.
- Формы — `noValidate` и наша проверка (FormField с ошибкой под полем), без системных всплывашек «Заполните это поле».
- Выход со страницы с несохранёнными изменениями — наш ConfirmDialog, не системное «Покинуть сайт?».
- **Пустое состояние у каждого** списка, таблицы, секции, карточки с данными, результатов поиска и фильтра, графика,
  вкладки, выпадающего списка и календарного дня: EmptyState из `@/ui` с иконкой, одной фразой по-человечески и
  кнопкой первого действия (если действие есть); у поиска/фильтра — «Ничего не нашли» + «Сбросить фильтры».
  Проверять на пустом бизнесе (демо-персона «Новый салон — пусто», когда появится) и через фильтр, дающий ноль.

## 0.4 Языки: сейчас только ru и en (25.09.2026)

Пользователь: «все тексты сделать так, чтобы могли разные языки добавить; пока только английский и русский хватит».
Пишем ru и en, hy НЕ пишем и НЕ проверяем (он выключен, но код его поддерживает). Новые языки добавляются по
`docs/ADDING-A-LANGUAGE.md` без правки экранов — поэтому: никаких строк в JSX, только `useT`; даты/деньги через
`useFormat`; склонения через ICU plural; не склеивать фразы из кусков; вёрстка выдерживает текст длиннее на 30%;
свои списки языков в разделах не заводить — только `LOCALES` из `@/i18n/config`.
Пустой или неполный `messages/hy/<area>.json` — НЕ дефект раздела (ядро k4, client-g2-1-fix1): измеритель его не заводит,
армянский дольём одним проходом по всем разделам, когда владелец включит язык.

## 1. Главное правило: пишите только в своих путях

Разделу `<area>` принадлежат **только**:

| Что | Где |
|---|---|
| Страницы | пути раздела из `docs/areas.json` (поле `routes`), например `src/app/biz/loyalty/**` |
| Компоненты, хуки, утилиты раздела | `src/areas/<area>/**` |
| Подпункты меню раздела | `src/areas/<area>/nav.ts` |
| Вклады в чужие экраны | `src/areas/<area>/extensions/<Host>.tsx` (только уже созданные файлы) |
| Типы | `src/domain/<area>.ts` или папка `src/domain/<area>/**` (с `index.ts`, реэкспортирующим всё) |
| Моковые данные (срез) | `src/mock/slices/<area>.ts` |
| API | `src/api/<area>.ts` или папка `src/api/<area>/**` (с `index.ts`, реэкспортирующим всё — импорты экранов не меняются) |
| Тексты | `messages/ru/<area>.json`, `messages/en/<area>.json`, `messages/hy/<area>.json` |
| Замеры, заметки, просьбы | `qa/**/<area>*` (например `qa/requests/<area>.md`, `qa/scenarios/<area>-create.json`) |

Всё остальное — **общее** (фундамент): `src/ui/**`, `src/shell/**`, `src/config/**`, `src/demo/**`,
`src/i18n/**`, `src/lib/**`, `src/extensions/*.ts(x)`, `src/mock/db.ts`, `src/mock/slices/index.ts`,
`src/mock/seed/**`, `src/api/{core,area,request}.ts`, `src/domain/core.ts`, `src/app/layout.tsx`,
`src/app/biz/layout.tsx`, `src/app/biz/page.tsx`, `src/app/dev/**`, `messages/*/common.json`,
`messages/*/ui.json`, `src/styles/**`, `src/app/globals.css`, `package.json`, конфиги, скрипты.

**Нужна правка общего** (новый компонент в `src/ui`, поле в ядре, функция в `api/core`, пункт меню
верхнего уровня, новая пара хост/раздел, ключ в `common.json`, пакет npm) — **не правьте сами**,
допишите просьбу в `qa/requests/<area>.md`:

```md
## 2026-09-25 · Поле `Client.preferredStaffId` в ядре
- Зачем: F-04-123 «любимый мастер клиента» — нужно журналу и онлайн-записи.
- Что именно: `preferredStaffId?: Id` в `Client` (src/domain/core.ts) + заполнить в сиде у 20% клиентов.
- Пока жду: храню в своём срезе `clients.preferredStaff[clientId]`.
```

Пока просьба не выполнена — обходитесь своими путями (свой срез, свой компонент в `src/areas/<area>/`).

**Нельзя:** коммитить (коммитит главный), запускать второй `next dev` (только `scripts/ensure-dev.sh`),
менять id разделов и их пути, править чужие файлы, ставить пакеты, использовать системный `git`.

## 2. Структура

```
src/
  app/                    маршруты (Next 16 App Router)
    layout.tsx            корень: шрифты, i18n, демо-провайдер, тосты, демо-кнопка   [фундамент]
    (client)/**           приложение клиента: /, /search, /bookings, /favorites, /profile  [client]
    biz/layout.tsx        каркас кабинета (меню, верхняя полоса)                          [фундамент]
    biz/<раздел>/**       страницы разделов кабинета                                      [разделы]
    platform/**           наша панель                                                     [platform]
    b/[slug]/**           публичная страница салона/мастера по ссылке                     [online]
    dev/**                /dev/ui (витрина UI), /dev/ext/[host]/[area], /dev/routes, /dev/health
  areas/<area>/           код раздела: компоненты, хуки, nav.ts, extensions/              [разделы]
  ui/                     UI-кит — ТОЛЬКО из него строятся экраны                          [фундамент]
  shell/                  каркасы: клиент, кабинет, панель, публичная, демо-переключатель  [фундамент]
  config/                 areas, nav (меню), spheres (функции сфер), permissions, districts
  demo/                   демо-персоны: настройки, контекст «кто я», хуки
  domain/core.ts          типы ядра;  domain/<area>.ts — типы раздела
  mock/                   моковая база: db.ts (zustand+persist), seed/ (сид ядра), slices/<area>.ts
  api/                    фасад API: request.ts, core.ts, area.ts (фундамент), <area>.ts (разделы)
  extensions/             точки расширения: types, pairs, registry, ExtensionSlot
  i18n/                   next-intl без языка в адресе: useT, useFormat, загрузчик словарей
  lib/                    cn, date (dayjs), money (֏), phone (+374), text, id
  styles/tokens.css       ВСЕ цвета, радиусы, тени (светлая и тёмная тема)
messages/{ru,en,hy}/<ns>.json   словари: common, ui + по файлу на раздел
scripts/                  ensure-dev.sh, measure.mjs, fids.mjs, check-tokens.mjs, commit.mjs
qa/                       замеры (shots/ не коммитятся), requests/, scenarios/
```

## 3. Как добавить экран

Страница — тонкая обёртка, экран — в `src/areas/<area>/`:

```tsx
// src/app/biz/loyalty/promotions/page.tsx
import { PromotionsScreen } from '@/areas/loyalty/promotions/PromotionsScreen';

export default function Page() {
  return <PromotionsScreen />;
}
```

```tsx
// src/areas/loyalty/promotions/PromotionsScreen.tsx
'use client';

import { Plus } from 'lucide-react';
import { listPromotions } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { PromotionsList, PromotionsListSkeleton } from './PromotionsList';

export function PromotionsScreen() {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['promotions', businessId], () => listPromotions(businessId!), { enabled: ready && !!businessId });

  return (
    <div data-f="F-06-031" className="flex flex-col gap-6">
      <PageHeader title={t('promotions.title')} actions={<Button leftIcon={<Plus />}>{t('promotions.add')}</Button>} />
      {q.isLoading ? (
        <PromotionsListSkeleton rows={5} />  // та же разметка, что PromotionsList, — см. DESIGN.md «The skeleton IS the page»
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState title={t('promotions.emptyTitle')} description={t('promotions.emptyText')} />
      ) : (
        <PromotionsList items={q.data} />
      )}
    </div>
  );
}
```

- Сейчас на каждом пункте меню стоит заглушка `<AreaPlaceholder area="…" />` — замените её своим экраном.
- Динамические адреса: `params` асинхронные — `export default async function Page({ params }: PageProps<'/biz/clients/[clientId]'>) { const { clientId } = await params; … }`.
- Подпункты меню раздела — в `src/areas/<area>/nav.ts` (`labelKey` — полный ключ, например
  `'loyalty.nav.promotions'`, подпись — в ваших словарях). На каждый `href` должна быть страница.
- Карточки-хосты уже имеют адреса: клиент `/biz/clients/[clientId]`, сотрудник `/biz/staff/[staffId]`,
  услуга `/biz/services/[serviceId]` (заглушки — заменяют хозяева).
- `/biz` — главная владельца (⭐ 01.10.2026: пять цифр с действиями, `src/areas/reports/home/`) у того, у кого есть `reports.view`;
  мастер и администратор без отчётов сразу попадают в `/biz/journal` (F-01-204).

## 4. Интерфейс: только `src/ui` и токены

- Экраны собираются **только** из компонентов `src/ui/*` (витрина всех состояний — `/dev/ui`).
  Не хватает компонента — просьба; пока ждёте — соберите из имеющихся внутри `src/areas/<area>/`.
- Цвета — **только токены** (стандартная палитра Tailwind выключена, `bg-white`/`text-gray-500` не существуют):
  `bg-bg`, `bg-surface`, `bg-surface-2`, `bg-surface-3`, `border-border`, `border-border-strong`,
  `text-fg`, `text-muted`, `bg-primary` / `hover:bg-primary-hover` / `bg-primary-soft` / `text-primary-text` /
  `text-primary-contrast`, `accent`, `success`, `warning`, `danger`, `info` (и `*-soft`), `ring-focus`,
  `chart-1…8` (серии графиков и цвет мастера: `Staff.colorIndex` 1–8). Радиусы `rounded-sm…2xl`,
  тени `shadow-xs…xl`. Никаких `#fff`, `rgb()`, `bg-[#…]` — проверка: `node scripts/check-tokens.mjs --area <area>`.
  Исключение — цвет как **данные** (оттенок лака в `ColorSwatch color=…`).
- Классы склеиваются через `cn()` из `@/lib/cn`; варианты — `Record<Variant, string>`.
- Mobile-first: телефон 390 px — основной случай, десктоп 1440. Кнопки и поля по умолчанию 44 px,
  ничего нажимаемого меньше 40 px. Шрифт 16 px, контраст AA, понятно пожилым. Тёмная тема работает сама,
  если используете токены.
- **Скелетон = страница до данных** (владелец, 30.09.2026): пришли данные — ничего не сдвинулось, не выросло и не
  появилось из пустоты. `SkeletonText` внутри того же элемента, что текст; у строки/карточки — `XxxSkeleton` той же
  разметки; у `Table` — `skeleton` и `width` колонок, `mobileCardSkeleton`; счётчики и кнопки «при данных» — на месте уже
  при загрузке. Подробно — DESIGN.md «The skeleton IS the page». Проверка: `node scripts/skeletons.mjs --area <area> --shots`
  — каждая страница ✓.
- **Переход на страницу — одна смена картинки** (владелец, 30.09.2026: «после каждого редиректа мигает»): никаких
  `animate-fade-in`/`animate-rise` на данных, вкладках и карточках страницы. Строка таблицы ведёт на страницу —
  `rowHref` у `Table` (а не `router.push` в `onRowClick`), другой переход из кода — `useNavigate().go(href)`. Подробно —
  DESIGN.md «Page change».
- **У каждого экрана три состояния**: загрузка (`Skeleton` / `aria-busy`), пусто (`EmptyState`),
  ошибка (`ErrorState` с `onRetry`). Проверить: демо-кнопка → «Ответы сервера: Медленно / Ошибки»
  или адрес `?api=slow` / `?api=error`.
- Запись в данные: кнопка крутит `loading`, ошибка — `useToast().error(...)`, опасное — `useConfirm()`:
  ```tsx
  const toast = useToast();
  const save = useApiMutation(savePromotion);
  try { await save.mutate(form); toast.success(t('saved')); } catch { toast.error(tc('states.actionFailed')); }
  ```
- Формы: react-hook-form + zod (`@hookform/resolvers/zod`), поля оборачивайте в `FormField`.
  Телефон — `PhoneInput` (+374), деньги — `MoneyInput` (֏), даты — `DatePicker`/`TimePicker`.
- Графики — recharts внутри `ChartCard` (цвета `CHART_COLORS` из `@/ui/ChartCard`).
- Перетаскивание (перенос записей) — `@dnd-kit/core` + `@dnd-kit/sortable`.
- Иконки — `lucide-react`.

## 5. Разметка функций ТЗ: `data-f`

Корневой узел элемента, который реализует функцию ТЗ, помечается её id:

```tsx
<section data-f="F-01-024">…</section>
<Button data-f="F-00-061 F-01-118">…</Button>   // несколько функций — через пробел
```

По этим меткам меряется охват: `node scripts/fids.mjs --area <area>` (всего / помечено / список
непомеченных), `measure.mjs` показывает, какие `data-f` нашлись на экране. Метка ставится на то, что
реально работает, а не на заглушку.

## 6. Данные: моковая база, срез, API

- **Никогда не импортируйте `@/mock/db` в экраны** (линтер запрещает). Данные — только через `src/api/*`.
- Чтение: `useApiQuery(key, fetcher, { enabled })` → `{ data, isLoading, isError, refetch, isFetching }`.
  Запись: `useApiMutation(fn)` → `{ mutate, isPending, error }` (`mutate` бросает ошибку — ловите).
  После записи перечитываются сами (без скелетона) ТОЛЬКО запросы, читавшие изменённые коллекции/поля среза —
  кэш-теги и ручной `refetch()` не нужны. Кэш, оптимистичные правки, ключи — §18 и [docs/STATE.md](docs/STATE.md).
- Функции API раздела — `src/api/<area>.ts`, всегда поверх `request()` (задержка 150–400 мс, режимы
  демо), чтобы потом заменить на бэкенд:
  ```ts
  // src/api/loyalty.ts
  'use client';
  import { request } from '@/api/request';
  import { mutateArea, readArea, readCore } from '@/api/area';
  import { newId } from '@/lib/id';

  export const listCards = (clientId: Id) => request(() => readArea('loyalty').cards.filter((c) => c.clientId === clientId));
  export const addCard = (input: Omit<LoyaltyCard, 'id'>) =>
    request(() => { const card = { ...input, id: newId('lc') }; mutateArea('loyalty', (s) => { s.cards.push(card); }); return card; });
  ```
- **Срез раздела** `src/mock/slices/<area>.ts`: тип состояния + `seed(core, now)` (начальные данные,
  ссылаются на id ядра, даты — от `now`) + `version`. **Поменяли форму данных — поднимите `version`**:
  срез у всех пересоздастся из `seed`, остальное не тронется.
- **Ядро** (`src/domain/core.ts`): бизнесы, сети, филиалы, сотрудники, услуги и категории, ресурсы,
  клиенты (ключ — телефон), пользователи приложения, записи, групповые события, графики, отметки
  календаря. Читать/менять — функциями `src/api/core.ts`: `coreList/coreGet/coreCreate/coreUpdate/coreRemove`,
  `listBookings`, `createBooking`, `updateBooking`, `setBookingStatus`, `deleteBooking`,
  `getBusinessBySlug`, `findClientByPhone`, `get/setStaffPermissions`. Свои данные «о сущности ядра»
  (карты лояльности клиента, техкарта услуги) храните в своём срезе с ключом по id ядра.
- **Ядро k1 (25.09):** `createBooking` с `appUserId` без `clientId` сам находит/заводит карточку клиента бизнеса по номеру
  (есть и `ensureClientForAppUser`); групповые события — `listGroupEvents/createGroupEvent/updateGroupEvent`,
  участники — `listBookings({ groupEventId })`. Новые необязательные поля (нет поля = прежнее поведение):
  `Business.socials`, `Business.bookingRules` (пишет online), `Location.journalKind`, `Staff.onlineBookingEnabled`
  (нет = можно), `Staff.hiddenInJournal`, `Staff.journalMarkupMin`, `Staff.prepayment` (пишет staff),
  `Service.shadeChoice` (пишет services), `Booking.staffAssignment` (ставит тот, кто создаёт запись онлайн).
  Черновики этих настроек в своих срезах переносите на поля ядра. Права `journal.create` / `journal.reschedule` / `clients.delete`.
- **Ядро k2 (25.09):** журнал событий записей `listBookingEvents({ businessId, kinds, since, freedOnly })` — ядро само пишет
  «создана / статус from→to / перенесена / удалена», кто и когда, и освободившееся время `freed` при ЛЮБОЙ записи в bookings;
  уведомления, колокольчик и лист ожидания берут события отсюда, своих «событий» не заводят. Новые поля: `AppUser.photoUrl`
  (пишет client), `Staff.specialty` (пишет staff). Адрес нового бизнеса — `uniqueBusinessSlug(name)` / `coreTx.uniqueBusinessSlug`
  (латиница, `slugify` из `@/lib/text`), не название как есть. Права `notify.mailings`, `notify.log`. Поле, добавленное в seed()
  своего среза без подъёма version, база досыплет сама — но version всё равно поднимайте, если меняется форма данных.
  Пока база не поднята, `useApiQuery` с `enabled: ready` отвечает `isLoading: true` (раньше — кадр «пусто»): обход
  `loading={!ready || q.isLoading}` больше не нужен.
- **Ядро k3 (25.09):** «Задерживаюсь» — `reportBookingDelay(bookingId, delayMin)` (событие `delayed`); лента клиента — `listClientEvents(appUserId)`
  (свой список уведомлений о записях клиенту не заводите); снятая неоплаченная запись — `Booking.cancelReason: 'prepayment_expired'`
  (`common.bookingCancelReason.*`). Импорт/выгрузка/массовое удаление — в общий журнал `logDataOperation` / `coreTx.logDataOperation`,
  читать `listDataOperations`. Новые поля: `Business.brandName`, `Network.mainBusinessId`, `Location.timezone` (данные — всё равно
  время Еревана), `Service.servicePackage` (пакет услуг, хозяин services), `BookingServiceLine.resourceId` (ресурс на время строки).
  Запись при закрытии окна без задержки — `requestSync(fn)` из `@/api/request`; CSV из Excel — `parseCsv` / `readTextFile` из `@/lib/csv`.
- **Ядро k4 (25.09):** **монеты бизнеса — один журнал ядра** (e2e-q3 №3): списать — `coreTx.chargeCoins({ businessId, amount, reason, area, refId })`
  (не хватает — `ApiError('not_enough_coins')`, текст `common.coinErrors.*`), начислить — `coreTx.grantCoins({ …, kind: 'topup' | 'refund' | 'gift' })`,
  читать `getCoinBalance(businessId)` / `listCoinMoves({ businessId })`; свои балансы (`client.coinBalances`, `platform.coinEntries`) — удалить
  после переезда. Места сторис (цены, очередь, проверка) — хозяин **platform**, кабинет (client) зовёт его api. `BookingEvent.start` — время визита
  у события (строки уведомлений без чтения записи). Новые поля: `Staff.email` (пишет staff), `Service.winbackReminder` (`'off' | 'custom'` →
  `repeatIntervalDays`; пишет services, читает notify). Право `online.own` — «своя» онлайн-запись (мастер, админ); `online.manage` теперь и у
  админа. Пары вкладов: `clientCard ← client`, `staffCard ← notify` (заглушки людям не видны, пока не заменены).
- Материал, который увидит клиент (фото, услуга, текст, диплом), при создании отправляйте
  `submitForModeration` из `@/api/platform`; клиенту не показывайте то, где `isVisibleToClients(refId)` = false.
- Свободные окна: `getFreeSlots({ staffId, date, durationMin })`, `getNearestSlots(...)` из
  `src/api/schedule.ts` — базовый расчёт положил фундамент, **развивает раздел schedule** (сигнатуры
  сохраняет), остальные только вызывают.
- Чужой срез можно **читать** (`readArea('clients')` внутри своих api-функций), писать — только через
  api того раздела. Компоненты других разделов не импортируйте (они меняются параллельно) — для этого
  есть точки расширения (§9).
- Форматы в данных: деньги — целые драмы; дата `'YYYY-MM-DD'`, время `'YYYY-MM-DDTHH:mm'` (Ереван, без
  пояса); телефон `'+374XXXXXXXX'`; тексты мастера/услуг/адреса — `LocalizedText { ru, hy?, en? }` →
  показывать через `pickText(text, useLocale())` из `@/lib/text`. Имена людей и названия бизнесов —
  просто строки. Помощники дат — `@/lib/date`.
- В сиде своего среза можно ссылаться на постоянные id демо-данных: `import { BIZ, LOC, ST } from '@/mock/seed'`
  (например `BIZ.nuri`), либо искать нужное в `core`, который приходит в `seed(core, now)`.
- Демо-данные: 3 салона (маникюр — Кентрон, барбер — Арабкир, стоматология — Малатия-Себастия), сеть
  из 2 филиалов (Нор-Норк, Шенгавит), 4 индивидуала, ~20 мастеров, ~60 услуг, ~120 клиентов с
  выдуманными номерами `+374 00 1XX XXX`, записи на ±30 дней от момента сида. Сброс — демо-кнопка
  «Сбросить демо-данные». Данные старше 7 дней пересоздаются сами.

## 7. Демо-персоны, контекст, права, сферы

Плавающая кнопка (колба) справа внизу на всех страницах: персона, сфера, язык, тема, крупный шрифт,
режим ответов сервера, сброс данных. То же адресом:
`?demo=owner&sphere=nails&lang=ru&theme=light&font=large&api=slow` — это разовая команда: значения
запоминаются в cookie, а адрес тут же очищается от этих параметров (редирект), чтобы не перебивать
переключатель при обновлении страницы.

Персоны: `guest` (гость), `client` (клиент приложения), `individual` (мастер-индивидуал), `owner`
(владелец салона), `admin` (администратор салона), `master` (мастер в салоне), `network` (владелец
сети), `platform` (наша панель). Сферы: `nails, barber, hair, cosmetology, massage, dental, fitness,
carwash, general`.

```ts
import { useCan, useCurrent, useDemo, useSphere, useTerms } from '@/demo/hooks';
const { persona, sphere, lang } = useDemo();
const { ready, businessId, staffId, appUserId, locationIds, activeLocationIds, networkId } = useCurrent();
const canSeeMoney = useCan('finance.view');        // права персоны + галочки владельца для админа
const { has } = useSphere(); has('palette');       // функции сферы (src/config/spheres.ts)
const terms = useTerms(); terms.client;            // «Клиент» / «Пациент», terms.master — «Мастер» / «Врач» / «Тренер»
```

- `useCurrent()` подбирает данные под персону и сферу (владелец + dental → стоматология).
  Пока `ready === false`, id пустые — запускайте запросы с `{ enabled: ready }`.
- `activeLocationIds` — филиалы с учётом переключателя в верхней полосе (у сети есть «Все филиалы»).
- Прятать по правам — `<PermissionGate permission="clients.phones" fallback={…}>`. Список прав —
  `src/config/permissions.ts`; права администратора выставляет владелец (раздел staff) через
  `setStaffPermissions`.
- **Тонкие права раздела (k3):** галочки ТЗ мельче общего списка (26 прав «Клиентской базы» и т. п.) раздел держит в своём
  срезе по `staffId`; грубое право ядра — верхняя граница (нет `clients.view` — тонкие не помогают). Новые общие права k3:
  `journal.stats` (сводка дня), `loyalty.rules` (настройка программ лояльности); график в журнале — `schedule.edit`.
- У каждой сферы только свои функции: пункты меню скрываются по `hiddenInSpheres`, внутри экранов —
  `useSphere().has(...)`. Слова по сфере — `useTerms()`.

## 8. Тексты (i18n)

- **Все тексты — через словари.** `const t = useT('<area>')` из `@/i18n/useT` (прямой
  `useTranslations` запрещён линтером). Общие слова — `useT('common')` (actions, states, статусы
  записей, места работы, районы, сферы…).
- Словари раздела: `messages/ru/<area>.json` (**основной**, по нему проверяются типы ключей — нет ключа
  в ru → ошибка tsc), `messages/en/<area>.json` (**пишется сразу**), `messages/hy/<area>.json` (можно
  позже: при отсутствии ключа показывается ru; армянский дольём отдельным проходом).
- Язык не в адресе, а в cookie; смена языка перерисовывает страницу.
- Консоль сообщает о пропусках (это ловит `measure.mjs`): `[i18n:missing]` — ключа нет даже в ru
  (на экране «⋯»), `[i18n:no-en]` — нет английского (ошибка раздела), `[i18n:fallback-ru]` — нет
  армянского (ожидаемо).
- Форматы только через `useFormat()` из `@/i18n/useFormat` (k2: `useFormat({ hourCycle: '12' })` — 12-часовое время,
  `ago(d)` → «3 дня назад», стиль даты `monthYearGenitive` → «с сентября 2025»; слово сферы с падежами для чужого бизнеса —
  `useSphereTerms(sphereId)` из `@/i18n/useSphereTerms`, подпись статуса в кабинете с учётом сферы — `bookingStatusLabelKey`): `money(5000)` → «5 000 ֏»,
  `moneyRange(5000, 8000)`, `phone('+37400123456')` → «+374 00 123 456», `date(d, 'long')`,
  `time(dt)` (24 ч), `duration(90)` → «1 ч 30 мин», `relativeDay(d)`, `weekdaysShort()` (с понедельника).
- ICU в строках: `"count": "{n, plural, one {# запись} few {# записи} many {# записей} other {# записи}}"`.
- Статусы записи в кабинете — только `common.bookingStatus.*` (слова глоссария: «Записан», «Отменил клиент»…),
  свои копии статусов в словарях разделов не заводите; у клиента — от его лица, в словаре client.
- **Как писать тексты** (голос, кнопки, ошибки, пустые экраны, тосты, форматы, глоссарий ru/en/hy) — [docs/TEXT-STYLE.md](docs/TEXT-STYLE.md).

## 9. Точки расширения (экраны из нескольких разделов)

| Хост | Хозяин | Вклады |
|---|---|---|
| Окно записи `bookingWindow` | journal | finance (оплата), stock (расходники), loyalty, notify, clients (панель клиента), resources, online (источник) |
| Карточка клиента `clientCard` | clients | journal (визиты), loyalty, finance, notify, online, client (пуш, k4) |
| Карточка сотрудника `staffCard` | staff | schedule, payroll, online, services, resources, notify (k4) |
| Карточка услуги `serviceCard` | services | online, stock (техкарта), payroll, resources, loyalty |
| Хаб настроек `settingsHub` (`/biz/settings`) | settings | карточка со ссылками на настройки каждого раздела |
| Профиль клиента `clientProfile` | client | loyalty (карты, абонементы, сертификаты), finance (баланс) |

- **Вкладчик** заполняет только свой `src/areas/<area>/extensions/<Host>.tsx` (default export,
  пропсы хоста — `src/extensions/types.ts`: `BookingWindowExtProps`, `ClientCardExtProps` …). Сейчас там
  заглушка `ExtensionStub`. Посмотреть свой вклад, пока хозяин не построил хост: **`/dev/ext/<host>/<area>`**
  (пустая рамка хоста на моковых данных текущей персоны), например `/dev/ext/bookingWindow/finance`.
- **Хозяин** строит сам экран и вставляет вклады вкладками или секциями:
  ```tsx
  const entries = useExtensions('bookingWindow');           // уже отфильтрованы по сфере и персоне
  const tDyn = useTDynamic();                               // подписи вкладок: tDyn(entry.labelKey)
  <Tabs items={entries.map((e) => ({ value: e.area, label: tDyn(e.labelKey) }))} … />
  <ExtensionSlot entry={active} props={{ mode, bookingId, businessId, locationId, draft, onDraftChange }} />
  ```
- Новая пара хост/раздел — просьба (реестр `src/extensions/pairs.ts` + `registry.ts` — фундамент).
- **Вклад-заглушка людям не виден (k2):** пока файл вклада рисует `<ExtensionStub>`, `useExtensions` его не возвращает — вкладки
  «Здесь будет вклад…» на рабочих экранах нет; видна она только на `/dev/ext/<host>/<area>`. Заменили заглушку — вкладка появится
  после перезагрузки. `ExtensionStub` в настоящем вкладе не рисуйте (даже в ветке «пусто») — используйте `EmptyState`.
- **Меню (k2):** `NavChild.soon` — Badge «скоро» у пункта-заглушки; `NavChild.useCount` — хук-счётчик у подписи («Заявки · 3»).

## 10. Замеры

```bash
bash scripts/ensure-dev.sh          # поднять дев-сервер на :3710, если не запущен (никогда не убивает чужой)
node scripts/measure.mjs --area loyalty --persona owner --lang ru,hy --device phone,desktop
node scripts/measure.mjs --routes /biz/journal,/b/nuri-nails --persona owner,admin --theme light,dark
node scripts/measure.mjs --area loyalty --query "api=error"   # экраны в состоянии ошибки (или api=slow)
node scripts/measure.mjs --scenario qa/scenarios/loyalty-create-card.json
node scripts/fids.mjs --area loyalty # охват функций ТЗ метками data-f
node scripts/check-tokens.mjs --area loyalty
node scripts/measure.mjs --help     # все флаги
```

- Снимки — `qa/shots/<area>/<маршрут>__<персона>-<сфера>-<язык>-<тема>-<устройство>.png`
  (телефон 390×844, десктоп 1440×900), отчёт — `qa/shots/<area>/report.json`. Смотрите снимки глазами.
- `measure.mjs` сообщает: ошибки консоли и страницы, ответы 4xx/5xx, сырые ключи i18n на экране,
  горизонтальный вылет, зоны нажатия < 40 px, найденные `data-f`, армянский шрифт в `hy`, «висящую»
  загрузку (скелетоны `[data-skeleton]` и `aria-busy` должны исчезать).
- Маршруты раздела для `--area` берутся с сервера: `GET /dev/routes` (пункты меню + примеры адресов +
  `/dev/ext/*` вкладов раздела). Демо-кнопка на снимках скрыта (`--show-demo`, чтобы показать).
- Сценарий кликов — JSON в `qa/scenarios/<area>-*.json`:
  ```json
  { "route": "/biz/loyalty", "persona": "owner", "device": "phone",
    "steps": [ { "click": "text=Добавить карту" }, { "fill": "input[name=name]", "value": "Золотая" },
               { "click": "role=button[name=\"Сохранить\"]" }, { "expectText": "Золотая" }, { "screenshot": "after-save" } ] }
  ```
- Дев-сервер один на всех: **только** `scripts/ensure-dev.sh`, никаких `next dev` / `next build` /
  убийства процессов. Порт **3710**.

## 11. Проверка своих файлов

```bash
npx tsc --noEmit 2>&1 | grep -E 'src/(areas|api|domain|mock/slices)/<area>|src/app/biz/<area>'
npx eslint src/areas/<area> src/app/biz/<area> src/api/<area>.ts src/domain/<area>.ts src/mock/slices/<area>.ts
node scripts/check-tokens.mjs --area <area>
```

Линт строгий (правила React Compiler: `set-state-in-effect`, `refs`, `purity` — ошибки). Не
`setState` синхронно в эффекте; не читать `ref.current` в рендере; не звать `Date.now()`/`Math.random()`
в рендере.

## 12. Git

Не коммитьте — коммитит главный (`node scripts/commit.mjs "сообщение"`, isomorphic-git: системный
`git` на этом маке заблокирован лицензией Xcode).

## 13. Код

- TypeScript strict, без `any` (редкие исключения — с комментарием). Именованные экспорты; default —
  только страницы/лэйауты и файлы вкладов (`extensions/<Host>.tsx`). Один компонент — один файл.
- `'use client'` — только где нужны хуки/обработчики. Импорты через `@/…`.
- Комментарии и тексты документов — по-русски.

## 14. Next.js 16 — что важно

- `middleware` переименован в `proxy` (`src/proxy.ts` — фундамент: переносит `?demo=…` в cookie).
- `params` / `searchParams` / `cookies()` — только асинхронно (`await`). Типы страниц — глобальные
  `PageProps<'/путь/[id]'>`, `LayoutProps<'/путь'>` (генерируются `next dev` / `npx next typegen`).
- Turbopack по умолчанию. Гайды — `node_modules/next/dist/docs/01-app/`.
- `error.tsx` получает `retry()`.

## 15. Снято — не строить нигде

Из `00-our-decisions.md` → «Снято (не делаем)»:
1. Точка на карте из ссылки Яндекса, карты Google/Apple, «Вызвать такси», встроенная карта — только
   ссылка на Яндекс Карты и кнопка «📍 Я сейчас на месте работы».
2. «Делаем не всё по просьбам» — делаем всё, очередь по голосам.
3. Мастер сам появляется в «Моих мастерах» клиента по номеру из CRM — нет (только после визита через приложение).
4. Сторис «только для подписчиков» — платную сторис видят все.
5. Сторис без предела — фиксированное число мест, очередь по цене.
6. Уровни доверия в модерации — всё новое ждёт ручной проверки.
7. ИИ-помощник проверки.
8. Несколько проверяющих с отдельными входами.
9. Закрытая оценка визита 1–5 — только звёздочка.
10. Плохие отзывы.
11. Платные напоминания клиентам через WhatsApp/SMS (и «за монеты») — только пуш.
12. Звонки внутри приложения и скрытие номера мастера.
13. Тип аккаунта «поставщик».
14. Данные мастеров для поставщиков.
15. Фото «5 к услуге + 20 в галерею» — 6 фото на мастера.
16. Лестница скидок за срок — скидка только промокодом.
17. Витрина без записи — центр продукта — запись через приложение.

Отложено (не в ближайших волнах): кошелёк клиента и 5% комиссии (F-00-028).

## 16. Архитектура — жёсткие правила (arch-a1, 25.09.2026)

Устройство слоёв, где живёт логика, контракт api и как подключится бэкенд — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Проверка: `node scripts/arch-check.mjs --area <id>` (ошибки A1–A4, A6 — сдавать нельзя).

1. **Бизнес-правило — чистая функция, не компонент.** Окна, пересечения, цена со скидкой, срок отмены, статус новой записи,
   видимость клиенту — в `src/domain/<area>.ts` (своё) или просьбой в `src/domain/rules/` (общее). Своя копия общего правила
   (список отменённых статусов, часы мастера, «кого видно в каталоге») — major.
2. **Одна бизнес-операция = одна функция api = один `request()`.** Обработчик кнопки вызывает одну мутацию; не собирает запись
   из пяти вызовов подряд. Внутри api — без `await coreCreate/updateBooking/…` (A11): это лишние задержки и не атомарно.
3. **Запись — только через `useApiMutation`** с try/catch и тостом; без `await apiFn()` прямо в компоненте (A10), без
   `.catch(() => {})` (A15), без ручного `refetch()` после записи.
4. **Ключ запроса — `['<area>', '<сущность>', …параметры]`**, всё, что зависит от бизнеса, содержит `businessId`
   (фабрика `<area>Keys`). Данные бизнеса в срезе тоже по `businessId` — «общих на всех» настроек нет.
5. **Права — `useCan(permission)` в экране и проверка в api**, никогда `persona ===` (A8). Телефон клиента — через
   `clients.phones` (иначе `maskedPhone`), выгрузка — `clients.export`.
6. **Черновики форм и UI-состояние — не в моковой базе.** Запись в базу будит инвалидацию; черновик — useState/sessionStorage.
7. **Появилось поле в ядре — черновик в своём срезе удаляется.** Два источника правды для одного правила — major.
8. **Клиенту и публичной странице — DTO, а не сущность ядра:** без телефона мастера, домашнего адреса, CRM-полей.
9. **Даты — только `@/lib/date`.** `toISOString()` и `new Date('YYYY-MM-DD')` сдвигают день на 4 часа (A9).
10. **Размер:** один компонент — один файл; файл > 300 строк разбить (A13 считает от 400); списки > 100 строк — пагинация или
    виртуализация, фильтр и поиск — в api, а не в браузере по всей базе.

## 17. Правила — только из ядра (core-rules, 25.09.2026)

Бизнес-правило, которое нужно больше чем одному разделу, живёт ОДИН раз — в `src/domain/rules/` (чистые функции без React и
стора, переедут на сервер как есть). Своя копия такого правила в разделе — **major** (замечания разделам —
`qa/measure/<id>/core-rules.md`). Импорт: `import { … } from '@/domain/rules'`. Тесты: `node src/domain/rules/tests/run.mjs`.

| Вопрос | Функции ядра |
|---|---|
| Статус записи: активна / отменена / итоговая, тон и значок, кто куда может перевести | `BOOKING_STATUSES`, `ACTIVE_STATUSES`, `CANCELLED_STATUSES`, `FINAL_STATUSES`, `isCancelled`, `occupiesTime`, `isActiveBooking`, `isUpcoming`, `splitClientBookings`, `BOOKING_STATUS_META`, `bookingStatusTone(status, 'business' \| 'client')`, `canTransition`, `nextStatuses`, `noShowDelta`, `isOnlineSource` |
| Часы мастера, перерывы, занятость, «свободно ли в 15:00» | `staffDayHours`, `dayBreaks`, `staffWorkIntervals`, `busyIntervals` (с запасом после услуги и записями той же персоны в другом месте), `busyForViewer` («занято · дома» без имени), `checkSlot` / `isSlotFree`, `hasBookingOverlap` |
| Окна (база; правила слотов — schedule поверх) | `freeSlots`, `nearestSlots`, `nearestAvailableDate`, `slotNeedsForService` |
| Цена, длительность «от–до», скидка, предоплата | `bookedDuration` (верх), `bookedPrice` (низ), `priceRange`, `makeServiceLine`, `lineTotal`, `lineDiscount`, `visitTotal`, `applyDiscount`, `prepaymentAmount`, `prepaymentHoldUntil` |
| Отмена, перенос, неявка, статус новой записи | `effectiveBookingRules(business, staff)`, `freeCancelUntil`, `canCancelFree`, `clientCancelOutcome` (позже срока = «Отменил клиент» + неявка), `canReschedule`, `newBookingStatus`, `rescheduledStatus`, `canBookOnline`, `isPrepaymentExpired`, `masterCancelRefund` |
| Кого видно клиенту | `staffClientVisibility` → `{ catalog, link, bookable, requestOnly, reasons }`, `isStaffInCatalog`, `isStaffBookableOnline`, `visibleServices`, `visibleBusinessServices`, `isOwnClient`, `hiddenByModeration` |
| Что уходит клиенту и на публичную страницу | `toPublicStaff`, `toPublicBusiness`, `toPublicService`, `toPublicLocation`, `canSeeHomeAddress`, `canCallNow`; телефон клиента сотруднику — `clientForStaff(client, canSeePhones)` |
| Права | `can(persona, permission, { overrides, actorStaffId, targetStaffId })`, `canWith(set, …)`, `permissionsOf`, `PERMISSION_REQUIRES` |
| Создание записи (приложение, виджет, журнал) | правило — `planBooking`; команда — `placeBooking(input)` из `@/api/core` |

Команды ядра (`@/api/core`) — одна операция = один запрос, все правила внутри:
`placeBooking` (единый поток записи: окно, статус, предоплата, клиент по номеру; ошибки — `common.bookingErrors.<code>`),
`cancelBookingAsClient`, `rescheduleBookingAsClient`, `changeBookingStatus` (переход + счётчик неявок + права),
`releaseExpiredPrepayments`, `assertCan` / `canNow` / `currentActor` (права внутри api; нет права — `ApiError('forbidden')`,
текст `common.states.forbidden`), `moderationHiddenIds`. Внутри своей api-функции несколько записей в ядро — синхронными
`coreTx.*` в ОДНОМ `request()` (`coreTx.placeBooking(input, { isStartOffered })`, `coreTx.cancelByClient`, `coreTx.create`…).

Общие помощники: `copyText` (`@/lib/clipboard`), `toCsv` / `downloadCsv` (`@/lib/csv`), `addDays` / `diffMinutes` /
`nowYerevan` (`@/lib/date`, «сейчас» — по Еревану). Договор вкладов окна записи — `registerBeforeSave/registerAfterSave`
в `BookingWindowExtProps`, помощники `useSaveSteps` (хозяин) / `useBeforeSaveStep`, `useAfterSaveStep` (вклад) из
`@/extensions/saveHooks`; упавший вклад ловит `ExtensionSlot`. Хозяева общих сущностей — AREAS.md «Хозяева сущностей».

## 18. Состояние и запросы (state-s1, 25.09.2026)

Под `useApiQuery`/`useApiMutation` — TanStack Query v5: один кэш на приложение, запросы сами помнят, какие коллекции
базы прочитали, и запись будит только их. Подробно, замер до/после и решение по React Compiler — [docs/STATE.md](docs/STATE.md).

1. **Ключ — `['<раздел>', '<ресурс>', …параметры]`**, массив значений, не склейка строк; всё, от чего зависит ответ
   (`businessId`, дата, фильтр объектом), — в ключе. **Один ключ = одна функция чтения во всём приложении** (кэш общий:
   тот же ключ из другого места получит ТЕ ЖЕ данные). Проверка: `node scripts/renders.mjs --check-keys`.
2. **После записи ничего не делайте**: ни `refetch()`, ни `onSaved={() => q.refetch()}` — нужные запросы перечитаются сами,
   точечно. Исключение — данные не из базы (время «сейчас»): `refetch()` или параметр в ключе.
3. **Мгновенный отклик — оптимистично**, для статусов, переключателей, «в избранное», удаления из списка:
   ```ts
   const setStatus = useApiMutation(
     ({ id, status }: { id: Id; status: BookingStatus }) => changeBookingStatus(id, status),
     { optimistic: patchInList(['journal', 'bookings'], ({ id, status }) => ({ id, patch: { status } })) },
   );
   // ошибка → данные откатятся сами; вы показываете toast.error в catch, как обычно
   ```
   Готовые правки: `patchInList(начало ключа, args => ({ id, patch }))`, `removeFromList(начало ключа, args => id)`,
   своя — `optimistic<T, A>(начало ключа, (old, args) => new)` (чистая функция, `old` не менять).
4. **Смена даты, фильтра, поиска** — прежние данные остаются, пока грузятся новые (`q.isPlaceholderData`): приглушите
   список (`opacity`), не прячьте его за скелетоном. Скелетон — только `q.isLoading` (первая загрузка).
   Заранее — `prefetchApiQuery(key, fetcher)` в эффекте/обработчике (соседний день, следующий шаг мастера записи).
5. **Функция для хука или пропа — без `x!.y`** (React Compiler выносит её поля в рендер — падение при `x === undefined`):
   ```tsx
   const linkId = metaQ.data?.linkId;                                     // в рендере, через ?.
   useApiQuery(['online', 'link', linkId], () => getLink(linkId ?? ''), { enabled: Boolean(linkId) });
   ```
   Проверка: `node scripts/renders.mjs --check-compiler`. Ручные `useMemo`/`useCallback`/`memo` не нужны; `'use no memo'` —
   крайняя мера, с комментарием почему.
6. **Чтения — только `useApiQuery`**, не `useEffect` + `useState` + `await getX()`: такие данные не обновятся после записи
   и не попадут в кэш. Копировать `q.data` в `useState` — только для формы редактирования (подхват по id).
7. **Один `request()` на операцию, без `await` внутри** (`coreTx.*` — синхронно): такой запрос — транзакция, упал
   посередине — записи откатятся. Чтение базы вне `request()` в деве пишет `[mock-db] обращение к базе вне request()` — исправлять.
   Права — `request(fn, { permission: 'clients.export' })` или `assertCan` внутри.
8. **Черновик и UI-состояние — не в базе** (useState/sessionStorage): запись в базу — это перечитывание у всех, кто читал.
9. **Состояние поля ввода — в маленьком компоненте поля**, не в экране со списком: иначе каждая буква перерисовывает
   весь список (замер clients: 179 перерисовок на букву).
10. **Замер**: `node scripts/renders.mjs [--only journal-status,…]` — сколько компонентов перерисовалось, сколько запросов
    перечитано, мс до результата на 8 главных действиях. Цель — меняется только затронутый блок. Нужен сценарий своего
    действия — просьба в `qa/requests/<area>.md` (скрипт — фундамент).
11. **Чтение ядра в экране — `useCoreList('services', { businessId })` / `useCoreGet('staff', id)`** из `@/api/core` (ключи `coreKeys`,
    k2): свои ключи вида `['journal', 'services', b]` для сущностей ядра не заводите — кэш должен быть один.
