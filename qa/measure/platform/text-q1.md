# Тексты раздела platform — проход 1 (text-q1)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md`.
Прочитано: `messages/{ru,en}/platform.json` (hy пуст — ожидаемо по §8); экраны `/platform`, `/platform/businesses`,
`/platform/plan`, `/platform/moderation`, `/platform/connect`, `/platform/visits`, `/platform/promocodes`, `/platform/ads`,
`/platform/demand`, `/platform/support` (persona platform, ru/en, телефон).
Ждёт раздела: `/platform/sphere-requests`, `/platform/ideas` (заглушки).

Панель — для нашей команды, поэтому рабочие слова («модерация», «спрос», «волна») допустимы. Замечания — о
понятности, форматах и том, что видно в продукте.

Итого: **major 1 · minor 14**.

---

## major

### 1. Сырые даты ISO и цифрами
- «Бесплатно до 2026-10-17» на `/platform/businesses` (ISO как есть); «24.09.2026», «29.09.2026 · Просрочено»,
  «28.09.2026 – 12.10.2026» в модерации, визитах, рекламе.
- Исправить: только `useFormat()`: «17 окт», «вчера», «пн, 29 сент · просрочено», «28 сент – 12 окт». Цифровой формат —
  только в CSV.

---
- ✅ исправлено (fix-platform): все даты — `useFormat()` («сегодня», «3 дня назад», «до 17 октября · осталось 22 дня», «закончилось 30 авг»), телефоны — `fmt.phone`.

## minor

2. Ссылки на ТЗ и код в тексте: `promocodes.grantEligibleOnly` «…(F-00-019)», `plan.deferredNote` «…(F-00-028)»,
   `businesses.adsOptInHint` «…(см. qa/requests)», заметки волн на `/platform/plan` («F-00-179…», «см.
   qa/requests/platform.md», «раздел settings») → убрать ссылки: «Бесплатный месяц — только тем, кого подключили на
   визите»; «Пока переключаем мы — у салона своей настройки ещё нет».
      ✅ исправлено (fix-platform): в словаре и в данных сида нет F-номеров, путей и «раздел settings» (`grep -E "F-[0-9]{2}-|qa/|requests" messages/ru/platform.json` — пусто).
3. `plan.waveStatus.passed` «Прошла «Готово, когда»» (кавычки в кавычках, внутренний термин) → «Готово» / «Проверено».
      ✅ исправлено (fix-platform): «Готово».
4. Нет plural: `moderation.refundNote` / `paidBadge` «{coins} монет», `promocodes.tierMonths` «{months} мес»,
   `businesses.exported` «Файл готов: {rows} строк», `businesses.backupCounts` «{clients} клиентов, {bookings}
   записей…», `common.days` «дней» → ICU plural (в en тоже: «{n, plural, one {# coin} other {# coins}}»).
      ✅ исправлено (fix-platform): ICU plural целыми фразами (монеты, месяцы, строки, клиенты/записи, дни).
5. Звёздочка названа рейтингом: `ads.minStars` «Не меньше звёзд» и `ads.targetMinStars` «Минимум звёздочек» (два ключа
   на одно), en «Minimum star rating»; `ads.targetMinStarsHint` «Мы не считаем рейтинг сами…». Звёздочка — число
   поставивших, не оценка → оставить один ключ: ru «Звёздочек не меньше» · en «At least this many stars»; подсказка —
   «Пока звёздочки не подключены, число вводится вручную».
      ✅ исправлено (fix-platform): один ключ «Звёздочек не меньше» / «At least this many stars», подсказка про ручной ввод.
6. `businesses.leftTitle` «Уход клиента» — здесь «клиент» = бизнес, путается с клиентами салонов → «Бизнес уходит» /
   en «Business leaving».
      ✅ исправлено (fix-platform): «Бизнес уходит — выдать данные».
7. `support.businessLabel` «Салон» / `support.businessOptional` «Салон (если это бизнес)» (en «Business»), а обращаются
   и частные мастера → «Салон или мастер» / «Салон или мастер (если пишет бизнес)».
      ✅ исправлено (fix-platform): «Салон или мастер».
8. en: `support.channel.cabinet` «Cabinet» → «Business workspace»; `connect.title` «Onboard a salon» при пункте меню
   «Connect a salon» → «Connect a salon», `connect.start` «Start onboarding» → «Start connecting», `connect.draftsTitle`
   «Started onboardings» → «Unfinished connections».
      ✅ исправлено (fix-platform): «Business workspace», «Connect a salon», «Start connecting», «Unfinished connections».
9. en по глоссарию: «Solo master» (`connect.kindIndividual`, `ads.size.individual`, `visits.subtitle`, `plan.*`) →
   «Independent specialist»; «Sphere» (`connect.sphere`, `visits.sphere`, `demand.*`) → «Specialty».
      ✅ исправлено (fix-platform): «Independent specialist», «Specialty».
10. «Материал» в модерации (`moderation.filterKind` «Вид материала», `approved` «Материал одобрен», `detailsTitle`
    «Материал на проверке») путается с материалами мастера (гель-лак, база) → «Что проверяем», «Одобрено», «На проверке».
      ✅ исправлено (fix-platform): «Что проверяем», «Одобрено — клиенты уже видят», колонка «Бизнес».
11. `ads` → «Рекламодатель: Наша панель» (демо-данные / подпись по умолчанию) → «Azat (мы)».
      ✅ исправлено (fix-platform): «Azat (мы)».
12. `promocodes.personal` «Личный (только на этот салон)» → «Только для одного бизнеса»; `promocodes.kindDiscount`
    «Скидка по ступеням» → «Скидка на первые месяцы».
      ✅ исправлено (fix-platform): «Только для одного бизнеса», «Скидка на первые месяцы».
13. Спрос: строки «Лусине Погосян · массаж · Массаж · Первый во всей сфере» — сфера повторяется (название частного
    мастера в данных уже со сферой) → не добавлять сферу, если она уже в названии; «Первый во всей сфере» →
    «Единственный в городе».
      ✅ исправлено (fix-platform): «Первый: массаж · Арабкир» / «Единственный в городе: массаж», сфера не повторяется.
14. На en в плане запуска и спросе всё содержимое (названия волн, запросы «наращивание ресниц») по-русски — это данные;
    для своей панели допустимо, но названия волн лучше держать `LocalizedText`.
      ⏳ запросы клиентов («наращивание ресниц») — это данные на языке клиента, их не переводим; названия волн уже `LocalizedText`.
15. `connect.hereHint` «Без встроенных карт — просто нажмите кнопку, когда вы на месте» → «Нажмите кнопку, когда будете
    у входа — точка запомнится» (про «встроенные карты» человеку знать не нужно).
      ✅ исправлено (fix-platform)
