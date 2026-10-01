# Тексты раздела journal — проход 1 (text-q1)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md`.
Прочитано: `messages/{ru,en}/journal.json` (hy пуст — ожидаемо по §8); экраны `/biz/journal` (owner, nails, ru/en, телефон).
Ждёт раздела: `/biz/records` (заглушка); оплата в окне записи — ждёт finance; «Продажа товара», «Каталог товаров» — ждут
stock/finance.

Итого: **major 2 · minor 13**.

---

## major

### 1. Один статус записи — три разных названия в продукте
- Статус `scheduled`: в журнале «Ожидание клиента» (`toolbar.statusOptions.scheduled`), в общих словах «Подтверждена»
  (`common.bookingStatus.scheduled`), у клиента «Подтверждена», в фильтрах клиентов «Ожидание клиента». `arrived` /
  `no_show`: здесь «Клиент пришел / Клиент не пришел», в общих «Пришёл / Не пришёл».
- Исправить: свои `toolbar.statusOptions.*` удалить, брать `useT('common')('bookingStatus.<code>')`. Слова для кабинета —
  глоссарий «Статусы записи»: «Записан», «Клиент подтвердил», «Пришёл», «Не пришёл» (правку `common` делает фундамент,
  см. отчёт `qa/text/report-q1.md`).

### 2. «Разметка: Не выбрано» на каждой колонке мастера
- `grid.markup` / `grid.markupNone` — на телефоне и десктопе под каждым именем висит непонятная строка. Это шаг
  вспомогательных линий сетки.
- Исправить: когда шаг не задан — строку не показывать; когда задан — «Линии каждые {m}» (en «Lines every {m}»),
  а сам выбор держать в меню колонки «⋯» с подписью «Линии сетки».

---

## minor

3. en «Journal» → «Calendar» (`title`, `sidebar.title`; и в меню — `common.nav.journal`, это фундамент). «Journal» —
   калька с русского.
4. `block.new` — в русском интерфейсе английское «new» → ru «Новый клиент», en «New client», hy «Նոր հաճախորդ».
5. `block.breakTitle` «Технический перерыв» → «Перерыв» / en «Break».
6. `block.resizeHandle` «Потянуть, чтобы изменить длительность» → «Потяните, чтобы изменить длительность».
7. `hoverCard.stats` «Визитов: {visits} · Не пришёл: {noShow} · Потратил: {spent}» (род, «Не пришёл: 2») →
   «Визитов: {visits} · Неявок: {noShow} · Всего: {spent}»; en «Visits: {visits} · No-shows: {noShow} · Total: {spent}».
8. `hoverCard.cash` / `hoverCard.card` «Наличные» / «Банковские карты» → «Наличными» / «Картой» (en «Cash» / «Card»).
9. `hoverCard.details` «Детали записи {time} · {duration}» → «Запись {time} · {duration}».
10. `window.staff` «Специалист», а ошибки рядом — «мастер» → подпись через `useTerms().master` («Мастер» / «Врач» /
    «Тренер»); en «Specialist».
11. `window.overlapError` и `block.resizeOverlap` — один ru-текст, два разных en → один ключ; en «This time is already
    booked for this specialist».
12. Чипы масштаба «5 минут · 10 минут · 15 минут» без подписи (`toolbar.zoomOption`) → подпись группы «Шаг» и значения
    «5 мин», «10 мин», «15 мин» (`{m} мин`, en `{m} min`).
13. `miniCalendar.loadPercent` «Загрузка {pct}%» путается с «загрузкой страницы» → «Занято {pct}%» / en «{pct}% booked».
14. «Расписание не установлено» (`miniCalendar.noSchedule`, `emptyDay.title`) — в продукте слово «график» →
    «График на этот день не задан» / en «No working hours set for this day»; `emptyDay.addStaffToday` «Добавить
    сотрудников в день» → «Поставить сотрудников на этот день».
15. Ё: «Клиент пришел / не пришел» → «пришёл» (уйдёт вместе с п. 1).
