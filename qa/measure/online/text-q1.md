# Тексты раздела online — проход 1 (text-q1)

Дата: 25.09.2026. Редактор текстов. Код не правился. Правила и глоссарий — `docs/TEXT-STYLE.md`.
Прочитано: `messages/{ru,en,hy}/online.json`; экраны `/biz/online` (owner), `/b/nuri-nail-studio`, `/b/nuri-nail-studio/about`,
`/b/nuri-nail-studio/book` (guest), ru/en/hy, телефон.
Ждёт раздела: `/biz/online/page`, `/biz/online/widget`, `/biz/online/settings` (заглушки).

Итого: **major 2 · minor 15**.

---

## major

### 1. «Отзывы» на публичной странице — в продукте отзывов нет
- `about.reviews` «Отзывы» + `about.reviewsEmpty` «Здесь пока ничего нет» на `/b/…/about`. По нашим решениям (F-00-116,
  «Снято» п. 9–10) у мастера только звёздочка: другие видят, сколько людей её поставили.
- Исправить: блок заменить на звёздочку: ru «{n, plural, one {# человек поставил звёздочку} few {# человека поставили
  звёздочку} many {# человек поставили звёздочку} other {# человека поставили звёздочку}}» · en «{n, plural, one {# person
  gave a star} other {# people gave a star}}» · hy «{n} հոգի աստղիկ է դրել». Пока звёздочек нет — блок не показывать.

### 2. «Следующей пачкой» — слово разработчика, а в hy — бессмыслица
- `linkSettings.sections.comingSoon` «Раздел строится следующей пачкой», `confirmed.rescheduleSoon` «Перенос запишем
  следующей пачкой». В hy «հաջորդ պատով» (буквально «следующей стеной»).
- Исправить:
  - `comingSoon`: ru «Скоро здесь можно будет это настроить» · en «You’ll be able to set this up here soon» ·
    hy «Շուտով այստեղ կկարողանաք սա կարգավորել»
  - `rescheduleSoon`: ru «Перенести пока можно по телефону: {phone}» · en «For now, reschedule by phone: {phone}» ·
    hy «Ժամը փոխելու համար առայժմ զանգեք՝ {phone}»

---

## minor

3. Три слова для одного человека в одном потоке записи: `public.masters` «Мастера», `booking.steps.staff` «Специалист»,
   `booking.staffStep.noneDescription` «Ни один сотрудник…», `links.new.typeCommonHint` «…выбирает сотрудника» →
   клиенту везде `useTerms().master` («Мастер», у стоматологии «Врач»); «сотрудник» — только в кабинете.
4. «Локация» (`hub.description` «…этой локации») → «этого филиала» / en «this branch» / hy «այս մասնաճյուղի».
5. `links.new.typeLabel` «Вы здесь, чтобы создать» → «Какую ссылку создать» / en «What kind of link» / hy «Ինչպիսի՞ հղում ստեղծել».
6. `links.subtitle` «…сколько угодно, число не ограничено» (повтор) → «Общая ссылка, ссылка на мастера или для сайта —
   сколько нужно».
7. `links.form.staffHint` «Видно только сотрудникам кабинета, не клиентам» — подсказка стоит у поля «Сотрудник», а
   описывает «Описание» → перенести к `links.form.description`: «Видите только вы и ваша команда»; en «cabinet staff» →
   «your team».
8. `hub.groupMore` «Ещё больше возможностей» → «Дополнительно» / en «More settings»; `hub.groupBrand` «Информация о
   компании» → «О салоне» / en «About your salon». Подписи групп сейчас КАПСОМ («ИНФОРМАЦИЯ О КОМПАНИИ») — убрать
   `uppercase` (§0 «без капса»).
9. `linkSettings.mainDescription` «Изменения будут отображены после сохранения.» → «Клиенты увидят изменения после
   сохранения» / en «Clients will see changes after you save».
10. `booking.details.consent` «Согласен на обработку персональных данных» (род) → «Даю согласие на обработку моих данных».
11. `public.poweredBy` «Работает на {product}» → «Запись через {product}» · en «Booking by {product}» · hy «Գրանցումը՝
    {product}-ով» (сейчас «Աշխատում է Azat-ի հիման վրա» — канцелярит).
12. `booking.cabinetSoon` «Личный кабинет клиента скоро будет здесь» → «Скоро здесь будут ваши записи»; hy — без
    «կաբինետ»: «Շուտով այստեղ կլինեն ձեր գրանցումները».
13. Имя ссылки из демо-данных «Форма компании» — термин Altegio → «Основная ссылка» (en «Main link», hy «Հիմնական հղում»).
14. hy — разнобой с общими словами: `bookingWindow.source.journal` «Օրագրից» (дневник) → «Օրացույցից»;
    `links.form.bookingTypeGroup` «Խմբակային» → «Խմբային» (как `common.nav.groups`); `confirmed.reschedule` «Տեղափոխել» →
    «Փոխել ժամը»; `confirmed.addToCalendar` «Ավելացնել օրացույց» → «Ավելացնել օրացույցում»; `links.form.staffHint`
    «կաբինետի աշխատակիցներին» → «ձեր թիմին».
15. en: `linkSettings.sections.designHint` «colour» → «color» (американское написание, как в `ui.json`);
    `public.masters` «Masters» → «Specialists».
16. `public.noneOnline.description` «…Позвоните напрямую — контакты ниже.» → «Сейчас записаться онлайн нельзя.
    Позвоните — номер ниже».
17. `hub.tiles.grid` «Доступное время» при соседнем «Свободное время» в других разделах → «Свободное время» /
    en «Free time» / hy «Ազատ ժամեր».
