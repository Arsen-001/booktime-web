# Первый вход и подсказки — раздел schedule (onboarding-k3)

Дата: 25.09.2026. Проверяющий: «Первый вход и подсказки», круг 3. Код раздела не правился.
Правила и пути ролей — `docs/ONBOARDING.md` (редакция 3); компоненты — `src/ui/onboarding/*`, витрина — `/dev/ui/onboarding`.
Серьёзность: block / major / minor. Новое в k3: пустой бизнес для проверки (`?demo=owner&empty=1`, в measure — `--persona owner-empty` / `individual-empty`) и два новых компонента: `ShareLinkCard` («ваша ссылка — только ваша» с «Копировать / Поделиться») и `OneTimeChoice` («спросить один раз → тихая строка „Режим: … · Изменить“»).
Отмечайте под пунктом `✅ исправлено (<метка>)` или `⏳ позже — почему`.
Смотрел: `/biz/schedule`, `/biz/schedule/calendar`, `/biz/schedule/templates` у owner-empty и individual-empty (телефон).
Снимки: `qa/shots/onboarding-k3/empty/biz-schedule*__owner-empty-*.png`, `qa/shots/onboarding-k3/indiv/biz-schedule-calendar__individual-empty-nails-ru-light-phone.png`.

Итог по k2: из 6 пунктов не сделан ни один.

## 1. major · «Мой календарь» у владельца — пустой экран с одним выпадающим списком (новое)
✅ исправлено (fix-schedule): «Календарь мастера» — карточки мастеров; единственный мастер выбирается сам; некого — EmptyState + «Пригласить мастера».
- Где: `src/areas/schedule/CalendarScreen.tsx:80` — `staffId = canPickStaff ? (staffParam ?? '') : …`; без `?staff=` ничего не рисуется.
- Что: владелец открывает «Мой календарь» из меню и видит только «Выберите мастера» на пустой странице — ни пояснения, ни пустого
  состояния (CONVENTIONS §0.3). В пустом салоне мастер вообще один — сам владелец.
- Как исправить: без `?staff=` выбирать своего сотрудника (`ownStaffId`), иначе первого из списка; если выбрать некого —
  `EmptyState` «Здесь календарь мастера» + «Пригласить мастера» → `/biz/staff`.

## 2. major · Режим календаря — две огромные кнопки над календарём каждый день (k1 №2, k2 №1 — не сделано)
✅ исправлено (fix-schedule): OneTimeChoice.
- Где: `CalendarScreen.tsx:348–370`.
- Как исправить: теперь есть готовый компонент — `OneTimeChoice` (витрина, раздел «Спросить один раз»):
  ```tsx
  <OneTimeChoice id="schedule.calendarMode" value={modeQuery.data ?? null} when={!modeQuery.isLoading && isOwnCalendar}
    onChange={changeMode} title={t('calendar.modeQuestion')} description={t('calendar.modeQuestionText')}
    label={t('calendar.modeLabel')} laterLabel={t('calendar.later')}
    options={[{ value: 'free', icon: <CalendarCheck />, title: t('calendar.modeFree'), description: t('calendar.modeFreeHint') },
              { value: 'busy', icon: <Clock />, title: t('calendar.modeBusy'), description: t('calendar.modeBusyHint') }]} />
  ```
  Если у мастера режим по умолчанию уже записан ядром (не `null`), окно не откроется — тогда просто тихая строка «Режим: всё свободно · Изменить»
  вместо двух кнопок; это уже снимает major.

## 3. major · Пустые шаблоны и пустая неделя — без действия (k1 №3, k2 №3 — не сделано)
✅ исправлено (fix-schedule): EmptyStateHint у шаблонов; пустая неделя — HintBanner «Часы работы не указаны» + «Указать часы».
- Где: `TemplatesScreen.tsx:67` (`EmptyState` без `action`); `/biz/schedule` у owner-empty — строка владельца с семью «—» и больше ничего.
- Как исправить: шаблоны — `EmptyStateHint` «Задайте обычную неделю один раз», шаги «дни → часы → повторяется каждую неделю», primary
  «Задать неделю». Неделя, где ни у кого нет ни одного рабочего дня, — `HintBanner tone="warning"` без id над сеткой: «Часы работы не указаны —
  клиенты не видят свободного времени» + «Указать часы» (открыть правку графика первого сотрудника).

## 4. minor · «+ + Создать шаблон» — два плюса
✅ исправлено (fix-schedule)
- Где: шапка `/biz/schedule/templates` — иконка `Plus` и «+» в тексте ключа. Убрать «+ » из текста (`templatesPage.create`).

## 5. minor · Карточка «Переход к сотруднику» с кнопкой «Показать» на пустом салоне
✅ исправлено (fix-schedule): карточка убрана.
- Где: `/biz/schedule` (owner-empty). Отдельная карточка-пояснение с голой ссылкой «Показать» занимает первый экран, а сотрудник один.
  Прятать, когда сотрудников меньше двух; иначе — `HelpTip` у заголовка, а не карточка.

## 6. minor · «На сегодня записей нет» без действия (individual-empty)
✅ исправлено (fix-schedule): одна строка «На сегодня записей нет»; «Запись голосом» — поле в окне «Записать клиента».
- Где: карточка «Действия по сегодняшним записям» в «Моём календаре». Когда записей нет, кнопки «Закончил раньше / Задерживаюсь» не нужны —
  свернуть карточку в одну строку или `EmptyState variant="inline"` с «Записать клиента». Карточка «Запись голосом (демо)» на первом экране
  нового мастера — ниже или в «⋯».

## 7. minor · Тур быстрых инструментов, пояснение для индивидуала, «окна на неделю не открыты» (k2 №2, №4, №5 — не сделано)
✅ исправлено (fix-schedule)
- Как в k2. Тур `schedule.quickTools` должен идти после `OneTimeChoice` — useTour сам ждёт, пока окно выбора закроется.
