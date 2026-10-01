# Просьба хранителю дизайна (от главного, 25.09.2026) — пользователь: «все модалки и алерты наши, не нативные»

1. `src/ui/Select.tsx` сейчас на системном `<select>` — на телефоне открывается системное колесо. Переделать на свой
   список (десктоп — Popover со списком и поиском при >8 пунктах, телефон — Sheet снизу), клавиатура и доступность
   (listbox/option, стрелки, Enter, Esc, фокус), тот же публичный API и тот же onChange — им пользуются все разделы.
   > ✅ сделано (r4): `Select` — свой список. Десктоп: панель у поля (ширина поля, до 28rem), больше 8 вариантов — поле поиска
   > сверху, пусто — «Ничего не найдено» с иконкой. Телефон: нижняя шторка, строки 48 px, заголовок — подпись поля из FormField.
   > Клавиатура: ↑↓/Enter/Пробел открывают; в списке ↑↓, Home/End, Enter, Esc, поиск по первым буквам; фокус возвращается в поле.
   > `role=combobox` + `listbox/option`, `aria-selected/disabled`. API тот же (`options/value/defaultValue/onValueChange/placeholder/
   > invalid/size/classNames`, новый необязательный `searchable`). `ref`, `name`, `form` и `onChange(e)` работают через скрытый
   > системный select-носитель (sr-only, вне Tab), `e.target.value` — новое значение. ⚠️ Скрипты с `page.selectOption()` по-прежнему
   > меняют значение через носитель, но смотреть глазами теперь надо так: клик по `role=combobox[name="…"]` → `role=option[name="…"]`.
   > Витрина — `/dev/ui/a#select` (пример «Район» с поиском), сценарий `qa/scenarios/steward-r4-select.json` (26/26).
2. Проверить весь `src/ui` и `src/shell` на системные элементы: date/time/color инпуты, title-подсказки, `<dialog>`,
   системная проверка форм (required-всплывашки) — всё на свои компоненты. Form/FormField — `noValidate` по умолчанию.
   > ✅ сделано (r4): в `src/ui` и `src/shell` нет `<dialog>`, системных date/time/color. Системные подсказки `title="…"` убраны
   > отовсюду (IconButton, Fab, SearchInput, Tabs, ScrollRow, TagInput, Chip, ColorSwatch, Calendar, Table, SlotButton,
   > PlatformShell, DemoSwitcher): где подсказка нужна — наша (`useTip` из `@/ui/hooks/useTip`: без обёртки, наведение с задержкой
   > 350 мс и фокус с клавиатуры, Esc), где подпись и так видна — просто `aria-label`. Новый `Form` из `@/ui/Form` — всегда
   > `noValidate`. `FormField` форм не создаёт, системной проверки в нём нет; формы поиска в каркасе — `noValidate`.
3. EmptyState: варианты для секции/карточки/таблицы/поиска («Ничего не нашли» + «Сбросить фильтры»)/графика/дня
   календаря/выпадающего списка; у Table, Select/Combobox, Calendar, ChartCard — пустое состояние встроено по умолчанию.
   > ✅ сделано (r4): `EmptyState variant="page|section|inline"` (+ `compact` как раньше = section), `kind="search"` — «Ничего не нашли»
   > + «Попробуйте другое слово или сбросьте фильтры» + кнопка «Сбросить фильтры» по `onReset`, `framed` — пунктирная рамка для
   > пустой секции посреди страницы. Встроено по умолчанию: Table (было), Select (пусто / ничего не найдено), Combobox (inline-вариант
   > с иконкой), DropdownMenu без пунктов, ChartCard — сам понимает пустоту (`data=[]` или у всех серий нули; `autoEmpty`,
   > `emptyText`, `emptyAction`). ❌ Calendar: пустого состояния у месяца нет смысла; «пустой день» — это сетка журнала раздела, для
   > неё — `EmptyState variant="inline"`. Витрина — `/dev/ui/a#states`.
4. Наш диалог «Есть несохранённые изменения» (хук useUnsavedGuard) вместо системного beforeunload-окна.
   > ✅ сделано (r4): `useUnsavedGuard(dirty)` из `@/ui/hooks/useUnsavedGuard` → `{ confirmLeave }`. Переходы по любым ссылкам
   > приложения (меню, карточки, «Назад») при несохранённом — наш ConfirmDialog «Уйти без сохранения? / Уйти / Остаться».
   > `confirmLeave()` — спросить перед закрытием шторки/окна с формой. ❌ частично: закрытие вкладки и перезагрузка — браузер
   > не позволяет показать свой диалог, только системный; оставлен по умолчанию (`beforeUnload: false` — отключить, если черновик
   > в sessionStorage). Кнопку «Назад» браузера Next.js надёжно остановить не даёт — не перехватываю.
