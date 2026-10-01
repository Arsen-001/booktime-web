# Тексты раздела online — проход 2 (text-q2)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md` (редакция 2).
Прочитано: `messages/{ru,en}/online.json` целиком (464 ключа); экраны (десктоп, ru/en): `/biz/online`,
`/biz/online/page`, `/biz/online/widget`, `/biz/online/settings`, `/biz/online/requests`, `/biz/online/places` (owner),
`/b/nuri-nail-studio`, `/b/nuri-nail-studio/book` (guest).

**Статус q1 (`text-q1.md`, 17 замечаний):** исправлено 1 — №1 «Отзывы» на публичной странице убраны (о салоне теперь
«постоянные клиенты»). Остальные в силе, в т. ч. №2 «следующей пачкой», №8 КАПС в группах, №13 «Форма компании».

Итого q2: **major 6 · minor 17**.

---

## major

### 1. «Следующей пачкой» — и на публичной странице для клиентов (q1 №2, не исправлено)
- `confirmed.rescheduleSoon` «Перенос запишем следующей пачкой» — видит клиент после записи;
  `linkSettings.sections.comingSoon` «Раздел строится следующей пачкой.» — видит владелец.
- Исправить: `rescheduleSoon` → «Перенести пока можно по телефону: {phone}» / «For now, reschedule by phone: {phone}»
  (перенос уже есть — `confirmed.reschedule*`; если работает, ключ удалить); `comingSoon` → «Скоро здесь можно будет
  это настроить» / «You’ll be able to set this up here soon». `booking.cabinetSoon` «Личный кабинет клиента скоро
  будет здесь» → «Скоро здесь будут ваши записи».

### 2. Опечатка у клиента: «Систему подберёт свободного…»
- `booking.staffStep.anyHint` «Систему подберёт свободного {masterGenitive}» (en «The system will pick…»).
- Исправить: «Подберём свободного {masterGenitive}» / «We’ll pick a free {masterLower}».

### 3. Клиентские статусы — своя, третья копия, и от лица мастера
- На странице после записи (`confirmed.status.*`): «Клиент пришёл», «Неявка», «Ждёт предоплату» — клиенту про него
  же в третьем лице. В `client` и `ui` те же статусы названы по-другому.
- Исправить по глоссарию (TEXT-STYLE §6, «Клиенту»): `arrived` «Визит состоялся» / «Visit done», `noShow` «Вы не
  пришли» / «You didn’t come», `awaitingPrepayment` «Нужна предоплата» / «Prepayment needed», `awaitingConfirmation`
  «Ждёт подтверждения мастера» / «Waiting for the specialist». Когда фундамент выберет один общий ключ — перейти на него.

### 4. Галочка согласия с родом (q1 №10)
- `booking.details.consent` «Согласен на обработку персональных данных».
- Исправить: «Принимаю условия и разрешаю хранить мои имя и телефон» / «I accept the terms and allow storing my name
  and phone» (одинаково с client `login.consentText`).

### 5. КАПС на публичной странице и в кабинете (q1 №8, расширилось)
- `/b/nuri-nail-studio`: категории услуг «МАНИКЮР», «ПЕДИКЮР», «ДИЗАЙН И НАРАЩИВАНИЕ» (en «DESIGN & EXTENSIONS»);
  `/biz/online`: «ИНФОРМАЦИЯ О КОМПАНИИ», «ЕЩЁ БОЛЬШЕ ВОЗМОЖНОСТЕЙ».
- Исправить: убрать `uppercase` — обычный заголовок секции («Маникюр»); группы — «О салоне» / «Дополнительно».

### 6. Код виджета с чужим адресом — «w1400000.book.me»
- `/biz/online/widget`: в готовом коде `src="https://w1400000.book.me/widgetJS"`, `data-url="https://n1400000.book.me"`;
  рядом «Номера для ссылок» показывают не номера, а внутренние id «st_nuri_owner», «sv_nuri_classic».
- Исправить: адрес — наш (публичная страница `/b/<slug>` или заглушка домена Azat), без чужого домена; блок
  «Номера для ссылок» → «Коды для ссылок» и показывать то, что реально вставляется в ссылку.

---

## minor

7. «Локация» (q1 №4, расширилось): `hub.description`, `linkSettings.steps.staffForAllBookingsHint`,
   `settings.pause.description` «…этой локации», `widget.ids.locations` «Локации», `widget.ids.hint` → «филиал» /
   «branch».
8. «Сотрудник» у клиента (q1 №3): `booking.staffStep.noneDescription` «Ни один сотрудник не выполняет выбранные
   услуги» → «Никто из {masters} не делает все выбранные услуги сразу — уберите одну»; en «employee» → «specialist».
9. `booking.details.anySpecialistBadge` «{master} не важен» / «{master} not important» → «Любой {master}» / «Any
   {masterLower}».
10. «Предвыбор»: `linkSettings.steps.preselectedStaff / preselectedService` «Предвыбранный сотрудник / услуга» →
    «Сотрудник выбран заранее» / «Услуга выбрана заранее»; `mismatchError` «Предвыбранный мастер не оказывает
    предвыбранную услугу — смените одно из двух» → «Этот мастер не делает выбранную услугу — поменяйте мастера или
    услугу»; `staffForAllBookingsHint` «…главнее предвыбора выше» → «…важнее выбора выше».
11. Ссылки: `links.new.typeLabel` «Вы здесь, чтобы создать» → «Какую ссылку создать» (q1 №5); `links.subtitle`
    «…сколько угодно, число не ограничено» → «…сколько нужно» (q1 №6); `links.new.description` — удалить;
    `links.form.staffAny` «Без привязки к сотруднику» → «Любой сотрудник»; `links.card.copy` «Копировать адрес» →
    «Скопировать ссылку», `links.card.copied` → «Ссылка скопирована»; `links.delete.description` «Действие нельзя
    отменить.» → «Вернуть её будет нельзя»; имя ссылки из данных «Форма компании» → «Основная ссылка» (q1 №13).
12. `booking.details.codeWrong` «Неверный код» → «Код не подошёл — проверьте цифры»; `booking.details.phoneInvalid`
    «Проверьте номер телефона» → «Введите 8 цифр после +374».
13. `booking.workplaceStep.fee` en «House-call fee {fee} AMD» → деньги через `money()` («5 000 ֏»), а не «AMD»;
    `booking.workplaceStep.title` «Где оказывается услуга» → «Где будет визит»; `places.workplaceHint.online`,
    `places.online.hint` «Услуга оказывается по видеосвязи» → «Встреча по видеосвязи — адрес не нужен».
14. Одно место работы — три названия: `requests.workplace.home` и `places.workplace.home` «На дому», `common.workplace.home`
    «Дома у мастера» → «Дома у мастера» везде (брать `common.workplace.*`, свои копии удалить); то же для
    `bookingWindow.source.*` → `common.bookingSource.*`.
15. `public.acceptsWomen / acceptsMen` «Только женщины / мужчины», а в `common.accepts` — «Только женщин / мужчин» →
    «Принимает только женщин» (с глаголом, чтобы не читалось как «здесь только женщины»).
16. Правила записи: `settings.cancelWindow.label` «Бесплатная отмена, часов до записи» → «Бесплатная отмена — не
    позже чем за … ч»; `settings.rescheduleWindow.label` «Самостоятельный перенос, часов до записи» → «Клиент сам
    переносит — не позже чем за … ч»; `settings.confirmMode.manualShort` «По подтверждению» при полном «С
    подтверждением» → «С подтверждением»; `settings.accepts.label` «Кого принимаю» (владелец настраивает мастера) →
    «Кого принимает».
17. `confirmed.cancelWindowPassed` «…сейчас отмена может считаться неявкой» — у клиента в приложении «засчитается как
    неявка»; «может» пугает неопределённостью → «Срок бесплатной отмены прошёл — отмена засчитается как неявка».
    `confirmed.rescheduleTooLate` «Срок самостоятельного переноса уже прошёл — позвоните напрямую» → «Перенести самим
    уже нельзя — позвоните мастеру».
18. Дизайн виджета: `linkSettings.design.colorHint / colorInvalid` «HEX-код, например #060f07» → выбор цвета
    `ColorPicker` без слова HEX; `contrastLow` «Низкий контраст элементов…» → «Цвет плохо видно на фоне — выберите
    светлее или темнее»; en «colour» → «color» (q1 №15).
19. `linkSettings.mainDescription` «Изменения будут отображены после сохранения.» → «Клиенты увидят изменения после
    сохранения» (q1 №9); `settings.pause.description` «Приостанавливает запись…» → «Клиенты не смогут записаться онлайн
    ни по одной ссылке этого филиала».
20. `requests.empty.title` «Нет заявок» → «Новых заявок нет»; `requests.actionFailed` «Не удалось обработать заявку»
    → «Не получилось — попробуйте ещё раз».
21. `booking.details.forWhomOther` «Другой» → «Другой человек» (как `common.forWhom.other`).
22. `/biz/online/settings`: переключатель языков текста согласия «RU / EN / HY» — армянский выключен (§0.4); список
    языков — из `LOCALES`, подписи — названиями языков, а не кодами КАПСОМ.
23. `SettingsScreen.tsx:362` — подпись по умолчанию «Комментарий к записи» строкой в коде → ключ
    `booking.details.comment` (на en сейчас уйдёт русская подпись).
