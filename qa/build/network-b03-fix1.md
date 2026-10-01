# network · b03 · починка дефектов (fix1) — 2026-09-25

Измеритель нашёл 3 дефекта в пачке b03 (F-11-080…120). Разобраны все.

## F-11-102 · major · «Сотрудники сети» вместо «Сотрудники филиала» — исправлено

`StaffMigrationScreen.tsx` переиспользовал `t('staff.title')` для заголовка списка сотрудников,
которые **ещё не** сетевые (это список филиала до переноса). Добавлен свой ключ
`staff.migrationScreen.branchStaffTitle` («Сотрудники филиала» / «Location staff») в
`messages/{ru,en}/network.json`, экран переключён на него. Проверено сценарием
(`qa/shots/network-b03fix1/scn/…after-pick.png`): после выбора филиала карточка озаглавлена
«Сотрудники филиала», ссылка «назад» по-прежнему «← Сотрудники сети» (это верно — она ведёт на
экран сети).

## F-11-087 · minor · таблица «Миграция услуг» без намёка на горизонтальную прокрутку — исправлено

Обёртка таблицы подключена к готовому хуку `useScrollEdges`/`scrollEdgeClass`
(`src/ui/hooks/useScrollEdges.ts`, тот же механизм, что уже использует `Table.tsx`/`Tabs.tsx`) —
теперь при обрезанных колонках справа/слева появляется `fade-x-*` из `polish.css`.

## F-11-082/083 (лок локально), F-11-099/107 (правка сетевого сотрудника локально) — сделано на своей стороне, эффект виден только через `/dev/ext`

Дефект был в том, что `network` не зарегистрирован вкладчиком хостов `serviceCard`/`staffCard` —
переключатели «Заблокировать цену/описание» в сетевой форме услуги и сама сетевая карточка
сотрудника сохранялись, но локальному филиалу нечем было это показать.

Построено:
- `src/api/network.ts` — `getServiceNetworkInfo(serviceId)` и `getStaffNetworkInfo(staffId)`: по
  локальному id находят сеть филиала, считают ключ (`serviceKeyOf`/`staffKeyOf`, тот же механизм
  сопоставления по имени, что уже в разделе), возвращают запреты/число филиалов, или `undefined`,
  если услуга/сотрудник не раздана больше чем в один филиал сети.
- `src/areas/network/extensions/ServiceCard.tsx` (F-11-082) — карточка с иконкой сети, текстом
  «Цену/Описание в этом филиале менять нельзя — задано сетью», кнопкой «Открыть в сети»; молчит,
  если услуга не сетевая или ничего не заблокировано.
- `src/areas/network/extensions/StaffCard.tsx` (F-11-099) — карточка «Сетевой сотрудник … правится
  только в сети», кнопка «Открыть в сети»; молчит, если сотрудник не сетевой.
- Ключи `extensions.serviceCard.*` / `extensions.staffCard.*` в `messages/{ru,en}/network.json`.

**Дальше починить не могу без чужого файла:** оба компонента подключаются реестром вкладов, а он —
фундамент (`src/extensions/pairs.ts` — список пар host/area, `src/extensions/registry.ts` — карта
`LOADERS`). Без правки этих двух файлов другим агентом компоненты не попадут ни на настоящую
страницу `/biz/services/[serviceId]`/`/biz/staff/[staffId]`, ни в витрину `/dev/ext/serviceCard/network`
(замер это подтвердил: `data-f` там 0, см. `qa/shots/network-b03fix1/report.json`). Просьба дописана
в `qa/requests/network.md` (запись `b03fix1`) с точными строками для обоих файлов. **Поэтому
F-11-082, F-11-083, F-11-099 отмечаю partial**, не done — пункт «Готово, когда» не выполняется на
настоящем экране, а только через прямой обход `/dev/ext`.

F-11-107 (сетевая должность в локации, read-only) в пачку b03 не входит (не было в списке F-id) —
не трогал; тот же блокер (pairs.ts) относился бы и к нему, если он появится в следующей пачке.

## Обязательный пункт 0.1 (замечания проверяющих)

Прочитаны все файлы `qa/measure/network/`, не подпадающие под исключения (`ux-*`, `speed-*`,
`arch-*`, `core-rules*`, `state-*`, `decision-*`, `recheck-*`, `e2e-*`, `text-*`, `a11y-*`,
`build-*`, `ux-best-*`) и не свои `b*-m*`: единственный такой файл — `core-k3.md`, в нём один пункт
и тот **minor** («Главная локация сети», F-05-118 — поля в ядре ещё нет, уже в
`qa/requests/network.md` с b01). block/major вне пачки b03 в разрешённых к чтению файлах не
найдено — добавлять в работу нечего.

## Проверка

- `tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/network.tsbuildinfo` — 0 ошибок в моих путях
  (остальные ошибки — в `areas/client`, `areas/clients`, не мои).
- `eslint src/areas/network src/api/network.ts src/domain/network.ts src/mock/slices/network.ts src/app/biz/network` — чисто.
- `scripts/ensure-dev.sh` — сервер на 3710 уже был поднят, не трогал.
- `scripts/measure.mjs` по затронутым маршрутам (`/biz/network/staff/migration`,
  `/biz/network/services/migration`, `/dev/ext/serviceCard/network`, `/dev/ext/staffCard/network`,
  телефон+десктоп) — 0 ошибок консоли, 0 сырых ключей, 0 4xx, 0 вылетов. Отчёт:
  `qa/shots/network-b03fix1/report.json`. Отдельный сценарий с выбором филиала —
  `qa/shots/network-b03fix1/scn/report.json`.
- Снимки посмотрены глазами (Read png): заголовок «Сотрудники филиала» после выбора филиала —
  подтверждено на `…after-pick.png`.

## assumed

- Текст новых ключей `extensions.serviceCard.*`/`extensions.staffCard.*` и
  `staff.migrationScreen.branchStaffTitle` придуман по аналогии с соседними ключами раздела —
  владелец не спрашивался (мелочь формулировки).
- Ссылка «Открыть в сети» у F-11-082/F-11-099 ведёт на реальный маршрут формы сети
  (`/biz/network/services/{key}`, `/biz/network/staff/{key}`) — существующие страницы, не выдумано.
