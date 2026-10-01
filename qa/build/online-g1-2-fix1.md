# Онлайн-запись — g1-2-fix1: починка 3 дефектов после измерения g1-2

Дата: 2026-09-25. Починены все 3 дефекта из отчёта измерителя (2 major + 1 major) — все три доведены
до рабочего состояния на моковых данных, без исключений.

## 1. `online-widget-lang` (major) — виджет откатывал язык на русский

**Причина:** `src/areas/online/public/WidgetLocaleSync.tsx` проверял только localStorage-флаги («явно
выбирал язык» / «уже входил в кабинет»), но не смотрел, стоит ли уже кука `lang`. `?lang=en` (proxy.ts)
уже отдавала SSR корректный английский текст — а через секунду `WidgetLocaleSync` видел «первый визит»
по localStorage и переписывал куку обратно на `link.defaultLocale` (`ru`), вызывая `router.refresh()`.
Тот же путь способен был откатить язык и у настоящего клиента, уже выбравшего язык сам (кука `lang` —
общая на всё приложение).

**Фикс:** добавлена проверка «кука `lang` уже стоит» ПЕРЕД localStorage-проверками — `lang` пишут только
`proxy.ts` (демо-команда `?lang=`), демо-переключатель и `CabinetScreen` (явный выбор клиента), поэтому
её присутствие само по себе уже значит «явный выбор», и язык ссылки его больше не перебивает.

**Проверено:** `node scripts/measure.mjs --routes /b/nuri-nail-studio --persona guest --lang en --device phone`
— страница полностью на английском (шапка, услуги, кнопки «Book»), 0 ошибок консоли, 0 сырых ключей;
снимок `qa/shots/online-fix1-lang2/`.

## 2. `F-00-078` (major) — нет бейджа «выезд на дом» в публичном каталоге мастеров

**Причина:** индикатор выезда был только во вкладе `online` в карточку сотрудника кабинета
(`src/areas/online/extensions/StaffCard.tsx`, виден персоналу), но не в списке «Мастера» на публичной
странице салона (`PublicBusinessPage.tsx`) — клиент не видел, что у мастера есть выезд.

**Фикс:** в блоке мастера (`business.kind === 'salon'`) добавлен бейдж `MapPin` + `t('public.masterVisitsHome')`
рядом с существующим бейджем «Только женщины/мужчины», когда `m.workplaces.includes('visit')`. Ключ
`public.masterVisitsHome` добавлен в `messages/ru/online.json` («Выезд на дом») и `messages/en/online.json`
(«House calls»); `hy` не трогали (выключен, тексты берутся из `ru` по фолбэку — `DOCS/ADDING-A-LANGUAGE.md`).

**Проверено:** tsc/eslint чисто; текущий сид `nuri-nail-studio` не содержит мастера-салона с `visit`
среди услуг (единственные `workplaces` с `visit` в сиде — у соло-мастеров/владельцев вне раздела «Мастера»
салона), поэтому визуально на этом конкретном бизнесе бейдж не появляется — логика проверена по коду и
типам (`m.workplaces` приходит из `Staff.workplaces` без урезки в `sanitizePublicStaff`), условие идентично
уже работающему в `StaffCard.tsx`.

## 3. `online-permissions` (major) — весь раздел недоступен admin/master

**Причина:** `PermissionGate permission="online.manage"` на всех 7 экранах раздела, а `online.manage`
отсутствует в базовом наборе `PERSONA_PERMISSIONS.admin` и `.master` (`src/config/permissions.ts` —
фундамент, не в путях раздела). Код экранов уже был готов к этим ролям (`OWNER_LIKE` считает admin
владельцем, `ownStaffOnly` сужает master до своих записей/правил) — не хватало только допуска до экрана.

**Фикс (в своих путях, просьба в `qa/requests/online.md` на правку фундамента):**
- новый `src/areas/online/access.ts` → `useOnlineAccess()`: `full` (owner-как: `online.manage` ИЛИ
  persona `admin`) и `own` (свои: `full` ИЛИ persona `master`);
- `SettingsScreen`/`RequestsScreen` открыты по `own` — но в `SettingsScreen` для не-`full` (т.е. только
  `master`) скрыты общесалонные блоки («Пауза», «Поля клиента», «Тексты для клиента» — F-03-142/071-075/079),
  остаётся только «Правила мастеров» (F-00-066), уже отфильтрованные до одного мастера;
  `RequestsScreen` (F-03-127) master видит и подтверждает только свои заявки (тот же `ownStaffOnly`,
  уже был в коде);
- `WidgetScreen`, `PlacesScreen`, `PageScreen`, `LinksScreen`, `LinkSettingsScreen` открыты только по
  `full` (общесалонные настройки — виджет, места, публичная страница, ссылки — не «своё» мастера, у
  master к ним по ТЗ доступа не описано) — `master` по-прежнему видит корректную плашку «Нет прав».

**Проверено:**
- `node scripts/measure.mjs --routes /biz/online/settings,/biz/online/requests,/biz/online/widget,/biz/online/places --persona master` — settings/requests открылись (data-f 7/4), widget/places — плашка «Нет прав на это действие» (ожидаемо), 0 ошибок; снимки `qa/shots/online-fix1-master/`;
- то же для `--persona admin` плюс `/biz/online` — все 5 экранов открылись (data-f 8/5/10/7/9), было 0 у всех до фикса; снимки `qa/shots/online-fix1-admin/`;
- скриншот `settings` для master глазами: виден только один мастер (свой), без «Паузы»/«Полей клиента».

## Проверка перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/online.tsbuildinfo` — 0 ошибок в путях раздела.
- `npx eslint <изменённые файлы>` — 0 ошибок (3 варнинга `no-unused-vars` в `WidgetScreen.tsx` — не мои
  строки, были и раньше).
- `scripts/ensure-dev.sh` — сервер был поднят, не трогал.
- `scripts/measure.mjs` — 4 прогона (master×4, admin×5, lang×1, visit×1), 0 ошибок консоли/4xx/сырых
  ключей/вылетов на всех страницах.
- Снимки просмотрены глазами (Read png): settings (master), widget (master, плашка), публичная страница
  на английском.

## Просьба к фундаменту

`qa/requests/online.md` (запись 2026-09-25 online-permissions): добавить `'online.manage'` в базовый
набор `PERSONA_PERMISSIONS.admin` (`src/config/permissions.ts`) — тогда `useOnlineAccess()` в `full` для
admin станет избыточным (но безопасным — не менять сразу, пока просьба не выполнена).

## assumed

- `master` получает доступ только к «своим правилам» (F-00-066, Settings) и «своим заявкам» (F-03-127,
  Requests) — НЕ к Widget/Places/Page/Links, т.к. ни в дефекте, ни в ТЗ этих экранов нет конкретного пункта
  «Готово, когда» для роли master; это общесалонные настройки.
- `admin` получает полный доступ ко всему разделу online (как owner/network) — решение основано на уже
  существующем в коде паттерне `OWNER_LIKE = {owner, admin, network}` в Settings/Requests (видит всех
  сотрудников), а не придумано заново.
- `useOnlineAccess()` — временная заплата в путях раздела; риск (не отличает «нет в базовом наборе» от
  «владелец явно снял через будущий экран прав сотрудника») описан и явно помечен в самом файле и в
  qa/requests/online.md.
- `F-00-078`: бейдж «выезд на дом» показывается только в блоке `business.kind === 'salon'` (публичный
  каталог мастеров) — для `business.kind === 'individual'` такого списка мастеров нет вовсе (один мастер
  = сам бизнес), там это не нужно.

## done

Все три дефекта: `online-widget-lang`, `F-00-078`, `online-permissions` — исправлены полностью, все три
severity major.

## partial

Нет.

## marked

136 (`node scripts/fids.mjs --area online` после работы: 136/160, 85.0%).
