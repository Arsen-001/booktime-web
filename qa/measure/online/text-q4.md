# Тексты раздела online — проход 4 (text-q4)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила — `docs/TEXT-STYLE.md`, редакция 4.
Прочитано: `messages/{ru,en}/online.json`, 735 ключей. Целиком прочитаны группы, которых не было в q1–q3:
`settings.clientFields`, `settings.depositPolicy`, `widget.channels`, `widget.mobileApp`, `widget.domain`,
`linkSettings.packages`, `linkSettings.analytics`. Видимый текст 7 экранов в ru и en.

**Статус q3.**
- Исправлены major №1 (фраза «приложения для бизнеса у нас нет» ушла) и №3 (`ms_booking` и `book.me` больше нет в
  готовом коде).
- «Перенос запишем следующей пачкой» и «Раздел строится следующей пачкой» на экране больше не видны. Ключи
  `confirmed.rescheduleSoon` и `linkSettings.sections.comingSoon` остались в словаре — удалите их.
- В силе:
  - «Промоблок в виджете» и `page.promo.*` (глоссарий: «баннер»);
  - «локация» в `hub.description`, `settings.pause.description`, `widget.ids.*`;
  - «Форма компании» — название основной ссылки в сиде (`src/mock/slices/online.ts:83`). На en-экране `/biz/online`
    по-русски, это слово Altegio → «Основная ссылка» / «Main link».

Итого q4 (новое): **major 2 · minor 7**.

---

## major

### 1. «Брендированное приложение», «лицензия», «(демо)» в конце
- `widget.mobileApp.orderTitle` «Брендированное приложение» (глоссарий: «своё приложение салона»);
  `widget.channels.requiresLicense` «Только с оплаченной лицензией» (лицензия — слово Altegio, у нас подписка);
  `widget.mobileApp.orderSent` «…с вами свяжется персональный менеджер (демо)»; `widget.channels.hint` «Демо:
  переключатель показывает вид кабинета после подключения, реального похода на площадку нет» (en «…the cabinet…»).
- Исправить:
  - «Своё приложение салона» / «Your own salon app»;
  - «Только с платной подпиской» / «Paid subscription only»;
  - «Демо: заявка отправлена {date} — с вами свяжется менеджер» / «Demo: request sent {date} — a manager will contact
    you»;
  - «Демо: подключение показано для примера, на площадку ничего не отправляется» / «Demo: this only shows how it
    looks — nothing is sent to the platform».

### 2. «Депозит» и «эквайринг» в правилах записи
- `settings.depositPolicy.label` «Депозит или гарантия картой»; `deposit` «Депозит (частичная предоплата)»; `amount`
  «Сумма депозита, ֏»; `cardGuaranteeHint` «…онлайн-эквайринга нет»; `noShowPenaltyHint` «Нет значения — штрафа
  сверх депозита нет».
- «Депозит» у нас — счёт клиента в лояльности (глоссарий §6). Здесь речь о предоплате. Исправить:
  - label → «Частичная предоплата или карта в залог» / «Partial prepayment or card hold»;
  - вариант → «Частичная предоплата» / «Partial prepayment»;
  - `amount` → «Сумма предоплаты, ֏»;
  - `cardGuaranteeHint` → «Демо: карта не привязывается — оплаты картой онлайн пока нет»;
  - `noShowPenaltyHint` → «Оставьте пустым, если штрафа нет» / «Leave empty for no fee».

---

## minor

3. **Удаление пакета: вопрос и объяснение в заголовке.** `linkSettings.packages.deleteConfirm.title` «Удалить этот
   пакет? У клиентов, уже записанных на него, запись останется.» → заголовок «Удалить пакет?» / «Delete package?»,
   текст «Кто уже записан на этот пакет, останется записан» / «Clients already booked keep their bookings».
4. **«Сначала добавьте услуги бизнесу».** `linkSettings.packages.noServices` → «Сначала добавьте услуги в меню
   Услуги» / «Add services first (Services menu)».
5. **Свой адрес.** `widget.domain.title` «Персональный домен» → «Свой адрес страницы» / «Your page address»; `hint`
   «Короткий фирменный адрес вместо технического номера формы» → «Короткий адрес вместо длинной ссылки» / «A short
   address instead of a long link». `taken2` «Занят» и `taken` дублируют смысл — оставить один.
6. **«Журнал событий» в аналитике.** `linkSettings.analytics.eventsLog` → «История событий» / «Event history»
   (глоссарий: «журнал» — экран записей).
7. **Каналы записи: 2GIS.** `widget.channels.twoGis.*` — 2GIS в Армении не работает. Спрячьте карточку или пометьте
   `unavailable` («Пока недоступно в Армении»), как у Google.
8. **Отчество.** `settings.clientFields.fullName` «Фамилия и отчество», `patronymic` «Спрашивать отчество» — в Армении
   отчество в записи не спрашивают. Оставить «Спрашивать фамилию», отчество убрать. В en «patronymic» непонятен.
9. **Встроенные поля.** `settings.clientFields.lockedHint` «Нужно для записи» и `builtInHint` «Имя и телефон всегда
   обязательны и не отключаются» говорят одно и то же рядом → оставить одну подсказку, `builtInHint`.
