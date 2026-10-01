# Тексты раздела client — проход 4 (text-q4)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md`, редакция 4.
Прочитано: `messages/{ru,en}/client.json`, 1033 ключа. Целиком прочитаны группы `memberships`, `certificates`,
`cashback`, `diary`, `reschedule`, `loyalty`. Видимый текст 12 экранов в ru и en (клиент и `/biz/apps/*`, владелец).

**Статус q1–q3.** В `client/text-q*.md` нет ни одной отметки сборщика ✅ или ⏳. q3 major №3 (en-экран `/biz/apps`
показывал русские списки) закрылся сам: фундамент починил массивы в словарях. На экране по-прежнему:
- «Решение, делаем ли своё приложение под бренд салона, ещё не принято…» (`/biz/apps/branded`);
- «1 локация / год», «Apple Developer / год» строками в коде (`BrandedAppScreen.tsx:260–261`);
- «скоро в сторах» (`messages/ru/client.json`, 2 места);
- «Не уверен(а) — мастер подберёт» (`book.shadeMaster`) — этот пример стоит в TEXT-STYLE §1 как образец ошибки.

По правилу §0.1 CONVENTIONS сборщик читает `text-*` в начале каждой пачки. Начните с оставшихся 4 major из q3.

Итого q4 (новое): **major 2 · minor 6**.

---

## major

### 1. en: «master» в новых экранах
- `diary.masterLabel` «Master», `diary.masterPlaceholder` «Master's name», `diary.emptyHint` «…book a master through
  the app», `reschedule.subtitle` «Pick a new time with the same master».
- Исправить: «Specialist», «Specialist’s name», «…book a specialist in the app», «…with the same specialist»
  (глоссарий; в ru — через `useTerms()`, у стоматологии это «врач»).

### 2. «Кэшбэк» у клиента при «бонусах» в кабинете
- Клиент видит блок «Кэшбэк» (`cashback.title`, `zeroHint` «Зарабатывайте кэшбэк…», `spendLimitPercent` «Можно
  оплатить кэшбэком…»). Мастер в разделе loyalty видит «бонусы» и «баллы». Один и тот же остаток называется
  по-разному у двух сторон.
- Исправить по глоссарию (§6 «Лояльность и деньги»): «Бонусы» / «Points». Примеры: «Копите бонусы с каждой оплаты и
  платите ими» / «Earn points on every payment and pay with them»; «Бонусами можно оплатить до {percent}%» / «Points
  can cover up to {percent}%». `loyalty.discountsTitle` ru «Скидки и бонусы» при en «Discounts» → «Discounts &
  points».

---

## minor

3. **Нет plural и сокращение.** `memberships.freezeDays` «до {days} дн.» → plural «до # дня / дней»;
   `cashback.earnPerVisit` «ещё {count} визит(а)» / en «visit(s)» → ICU plural.
4. **«Этого места».** `cashback.noProgram` «У этого места пока нет программы кэшбэка», `memberships.renewedToSale`
   «…вот доступные абонементы этого места» → «У салона пока нет бонусной программы», «…вот что сейчас продаёт салон»
   (глоссарий: «место» — только запасное слово; для частного мастера — «у мастера»).
5. **«Израсходован».** `memberships.usedUp`, `certificates.usedUp` → «Визиты закончились» / «No visits left» и
   «Остаток закончился» / «Balance used up».
6. **Тост «скопировано» со строчной.** `loyalty.copied` «скопировано» дублирует `cardNumberCopied` «Номер карты
   скопирован» → удалить `copied`, использовать `cardNumberCopied`.
7. **«Дневник» / «Diary».** Экран — это траты на красоту → «Мои траты» / «My spending»; `subtitle` «Визиты через
   приложение — сами, остальное впишите вручную» → «Визиты из приложения появляются сами, остальные траты добавьте
   вручную» / «Visits booked in the app appear on their own — add other spending yourself».
8. **Демо-данные на en-экране.** Главная `/?lang=en`: «Скидка 20% на первую запись в приложении»; поиск: «Manana
   Beauty · Нор-Норк · Nor Nork» — район дважды, один раз по-русски. Хранить `LocalizedText`, район показывать один
   раз на языке экрана.
