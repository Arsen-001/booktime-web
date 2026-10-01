# Первый вход и подсказки — раздел journal (onboarding-k2)

Дата: 25.09.2026. Проверяющий: «Первый вход и подсказки», круг 2. Код раздела не правился.
Смотрел: `/biz/journal` (owner, телефон 390×844), код `src/areas/journal/**`. Снимок: `qa/shots/onboarding-k2/first/biz-journal__owner-nails-ru-light-phone.png`.
Правила и пути ролей — `docs/ONBOARDING.md` (редакция 2); компоненты — `src/ui/onboarding/*`, витрина — `/dev/ui/onboarding`.
Серьёзность: block / major / minor. Пункты k1 (`onboarding-k1.md`) не отмечены — ниже их состояние и новое.

## 1. major · Тура журнала по-прежнему нет (k1 №1 — не сделано)
- Где: `src/areas/journal/JournalScreen.tsx` — нет `useTour`, нет `data-tour`, нет кнопки повтора.
- Что: владелец/администратор в первый вход видят кнопку, стрелки дней и **пять** выпадающих фильтров подряд (День · По
  должностям · Все должности · Статусы · 15 минут) — непонятно, что главное.
- Как исправить: `const tour = useTour('journal.intro', { autoStart: true, when: !isLoading })` — тур сам подождёт, пока
  закроется приветствие settings (useTour больше не стартует поверх открытого окна). Метки: `data-tour="journal-add"` на
  «Новая запись», `journal-day` на «Сегодня ‹ ›», `journal-column` на шапке первого мастера. 3 шага (ONBOARDING §4).
  Повтор — `<TourButton onClick={tour.start} fresh={!tour.seen}>` («Как это работает») в `PageHeader actions`,
  на телефоне `iconOnly`. Тексты — `messages/{ru,en}/journal.json → tour.*`, `howItWorks`.

## 2. major · Пустой день — «Расписание не установлено» и две равные кнопки (k1 №2 — не сделано)
- Где: `src/areas/journal/components/EmptyDayState.tsx` (ключи `emptyDay.title`, `emptyDay.setupSchedule`, `emptyDay.addStaffToday`).
- Что: заголовок с точки зрения системы; primary и outline рядом — два главных пути (CONVENTIONS §0); нет фразы «зачем».
- Как исправить: `EmptyStateHint compact framed` — заголовок «В этот день никто не работает», описание «Клиенты не смогут
  записаться на этот день», `action` = LinkButton primary «Указать часы» → `/biz/schedule`, `secondaryAction` = ghost
  «Записать всё равно» (открывает окно записи; F-01-018 остаётся на корне).

## 3. minor · Первые шаги прямо в журнале (новое)
- Где: `JournalScreen.tsx`, над сеткой, для owner / individual, пока настройка не закончена.
- Что: журнал — стартовая страница кабинета (F-01-204), а прогресс настройки виден только на `/biz/onboarding` (там сейчас заглушка).
- Как исправить: когда settings отдаст хук/апи прогресса — `ChecklistCard variant="compact" id="settings.firstSteps"` над
  сеткой (только следующий шаг + «Показать все»). Договоритесь с settings, чей это компонент (их — данные, ваш — место).
  Пока хука нет — ничего не делать, не считать шаги самим (копия правила — major по §17).

## 4. minor · «Нажмите на свободное время» в первый день (k1 №3 — не сделано)
- Как исправить: `HintBanner id="journal.tapFreeSlot" icon={<MousePointerClick />}` над сеткой, пока в бизнесе нет ни одной
  записи: «Нажмите на свободное время, чтобы записать клиента». Скрывается крестиком навсегда.

## 5. minor · Список записей: первый вход и «ничего не нашлось» — одна и та же пустота
- Где: `src/areas/journal/RecordsScreen.tsx:200` — `EmptyState kind="search"` с заголовком «Записей пока нет».
- Что: у бизнеса без записей показывается вид «поиск дал ноль» (серый значок, «Сбросить фильтры»), хотя фильтров нет.
- Как исправить: без фильтров — обычный `EmptyState` (или `EmptyStateHint compact`) «Здесь будут все визиты» + primary
  «Открыть журнал» / «Новая запись»; `kind="search"` + `onReset` — только когда фильтр активен.

## 6. minor · Мастер салона: свой тур и Beacon (k1 №4 — не сделано)
- Как исправить: как в k1 — `useTour('journal.masterIntro')` (+ запись · Закончил раньше · Задерживаюсь), `Beacon
  id="journal.finishedEarly"` на «Закончил раньше». Если кнопки мастера живут в schedule (`MasterActionsCard`) — тур там,
  в journal только ссылка на него.
