# settings — k1 (третий проход, «дострой оставшиеся»)

Задание: 25 F-id из списка, ранее не отмеченных `data-f`. Проверка перед стартом (`node scripts/fids.mjs
--area settings`) показала, что 10 из них уже помечены прошлыми пачками (F-00-147, F-15-002/003/004/008/010/
011/016/050/051/095/125) — задание досчитывало старый список. Реальный объём: **15 F-id**. Все 15 закрыты.

## Итог по каждому F-id

**Уже построено в другом разделе — найдено и точечно помечено `data-f` (правило «а»):**

- **F-00-149** «Ресурсы: кресло, кабинет, аппарат» — это и есть раздел `resources` целиком: `checkInstancesFree`/
  `pickFreeInstances` (`src/domain/resources.ts`) + проверка в `booking-flow.ts` (`resource_unavailable`), UI —
  `src/areas/resources/ResourceDetailScreen.tsx` (F-16-004/005/007). Добавил `F-00-149` на тот же корневой узел.
- **F-00-150** «План лечения из нескольких визитов» — уже `F-01-191` (`TreatmentPlanModal` в
  `src/areas/journal/components/booking-window/MedicalRecordsPanel.tsx`). Добавил `F-00-150` рядом.
- **F-15-126** «Категории событий» — уже `F-16-043` в `GroupSettingsScreen.tsx` (создание/правка/удаление
  категории события, цвет, пусто-состояние). Помечено.
- **F-15-127** «Категории клиентов: стандартные и свои» — `CategoriesScreen.tsx` (F-04-109/110/113): три
  системные категории (VIP/Лояльный/Постоянный) + свои без ограничения числа. Помечено.
- **F-15-128** «Назначение категории: вручную/массово/в приложении» — ручное — `ClientFormFields.tsx`
  (F-04-062), массовое — `BulkCategoryModal.tsx` (F-04-041, помечено `F-15-128`).
- **F-15-129** «Автоматические категории клиентов» — уже `F-04-118/119/158` в `LoyaltyProgramScreen.tsx`
  (вкладка «Правила для категорий»: автодобавление/автоудаление по условиям). Помечено.
- **F-15-130** «Где команда видит категорию клиента» — `extensions/BookingWindow.tsx` (F-04-111/112, серый
  блок клиента в окне записи). Помечено.
- **F-15-131** «Категории в фильтрах/отчётах/рассылках» — фильтр «Категория клиента» уже в
  `ClientsGroup.tsx` (F-04-028, группа «По клиентам»). Помечено.
- **F-15-138** «Языки виджета, смена языка» — уже `F-03-113` (`LanguageMenu` в `CabinetScreen.tsx`, 👤 →
  переключатель RU/EN, HY готов, но выключен по правилу §0.4). Помечено, добавил `F-15-140` туда же (какой
  язык видит клиент/как меняет — то же место + `WidgetLocaleSync.tsx` F-03-114 читает cookie один раз для
  новых неавторизованных).
- **F-15-143** «Текст согласия на разных языках» — уже `F-04-152` в `online/settings/SettingsScreen.tsx`:
  вкладки RU/EN, отдельный `Textarea` на язык, сохраняется как `LocalizedText`. Помечено.

**Построено с нуля — в правильном (не всегда своём) разделе (правило «б»):**

- **F-15-006** «Скрытый шаг анкеты» (❓ неизвестно, что спрашивал; вывод ТЗ — имя владельца/размер команды) —
  размер команды уже спрашивает шаг «Тип» (F-00-035); добавил поле «Ваше имя» (необязательное) в шаг
  «Контакты» существующего визарда `src/areas/client/register-business/RegisterBusinessScreen.tsx` —
  отдельного маршрута под догадку не завёл (assumed, описано в коде).
- **F-15-007** «Шаг «Цели»» — добавил 5-й шаг визарда (10 плиток-целей, Chip-мультивыбор, ничего не
  обязательно), список целей и API — `ONBOARDING_GOAL_IDS`/`saveOnboardingGoals`/`getOnboardingGoals` в
  `src/api/settings.ts` (мой файл), хранилище — новое поле `onboardingGoals` в `src/mock/slices/settings.ts`
  (version 13→14). Цели сохраняются в карточку бизнеса при завершении регистрации, ошибка сохранения целей
  не рвёт саму регистрацию (try/catch отдельно).
- **F-15-014** «Добавить локацию изнутри кабинета» — новый экран `src/areas/settings/AddLocationScreen.tsx`
  + маршрут `/biz/settings/add-location` (мой путь): название, адрес (необязательно), район → `coreCreate`
  + добавление id в `business.locationIds` (готовые общие функции ядра, без правки `domain/core.ts`/
  `api/core.ts`) → переключение на новую локацию → редирект. Точка входа — добавил «+ Добавить локацию» в
  `src/shell/biz/LocationSwitcher.tsx` (фундамент; правка чисто аддитивная — новая опция в списке/кнопка
  рядом с адресом, старое поведение не тронуто).
- **F-15-139** «Язык по умолчанию у ссылки» — добавил Select «Язык по умолчанию» (RU/EN) в
  `NewLinkSheet.tsx` (создание ссылки) и в `LinkSettingsScreen.tsx` (правка существующей) — поле
  `defaultLocale` в ссылке уже было в ядре online, просто не было доступно из UI.

## Изменённые/новые файлы

Мои пути: `src/areas/settings/AddLocationScreen.tsx` (new), `src/app/biz/settings/add-location/page.tsx`
(new), `src/api/settings.ts`, `src/mock/slices/settings.ts`, `messages/{ru,en}/settings.json`.

Чужие/общие — точечно (правило «б», третий проход разрешает без согласования):
`src/areas/client/register-business/RegisterBusinessScreen.tsx`, `messages/{ru,en}/client.json`,
`src/shell/biz/LocationSwitcher.tsx`, `messages/{ru,en}/common.json` (добавлен только ключ `shell.addLocation`),
`src/areas/resources/ResourceDetailScreen.tsx`, `src/areas/journal/components/booking-window/MedicalRecordsPanel.tsx`,
`src/areas/clients/{CategoriesScreen,LoyaltyProgramScreen}.tsx`,
`src/areas/clients/components/{BulkCategoryModal,filters/ClientsGroup}.tsx`,
`src/areas/clients/extensions/BookingWindow.tsx`, `src/areas/resources/GroupSettingsScreen.tsx`,
`src/areas/online/links/{NewLinkSheet,LinkSettingsScreen}.tsx`, `messages/{ru,en}/online.json`,
`src/areas/online/public/CabinetScreen.tsx`, `src/areas/online/settings/SettingsScreen.tsx`.

Ни один файл не переформатирован целиком (кроме `messages/{ru,en}/settings.json`, которые я сам
регенерировал через `json.dump` — они мои по правилам раздела; проверил, что JSON валиден и добавился
только новый ключ `addLocation`, до этого перечитал файл).

## assumed (додумано)

- F-15-006: «скрытый шаг» — считаю закрытым слиянием с шагом «Контакты» (имя владельца), без отдельного
  маршрута `/wizard/fourth`; в ТЗ сам шаг помечен ❓ (не снят), так что это лучшее приближение.
- F-15-014: право на добавление локации отдельно не заведено в проекте — кнопка видна persona
  individual/owner/network; сотрудникам без такого права её не прячу (нет соответствующего Permission).
- F-15-014: новая локация НЕ получает отдельную подписку/оплату — вся модель биллинга в settings считает
  по `businessId`, а не `locationId` (архитектурный вопрос сразу нескольких разделов). Локация появляется в
  переключателе и работает как вторая точка, но «оплачивается отдельно» из «Готово, когда» не реализовано —
  оставляю как partial, ниже.
- F-15-139: выбор ограничен `LOCALES` (сейчас ru/en — hy выключен по правилу §0.4 CONVENTIONS), не полным
  списком Altegio (⭐ наше решение и так ограничивает тремя языками).

## partial

- **F-15-014**, часть «новый салон … оплачивается отдельно»: не реализовано — требует решения по всему
  биллингу (Subscription в `src/mock/slices/settings.ts` ключуется `businessId`, не `locationId`); в одиночку
  в рамках settings это не чинится без риска сломать остальные разделы, которые читают ту же подписку.
  Технически невозможно закрыть в этом проходе без правки биллинг-модели везде, где она используется.

## Проверка

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/settings.tsbuildinfo` — 0 ошибок в затронутых
  файлах (есть предсуществующие ошибки в чужих файлах journal/loyalty/staff, не мои и не трогал).
- `npx eslint <все изменённые файлы>` — 0 ошибок/предупреждений.
- Тесты, Playwright и снимки НЕ запускались (решение пользователя 26.09.2026 — только сборка).
