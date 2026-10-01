# Первый вход и подсказки — раздел online (onboarding-k3)

Дата: 25.09.2026. Проверяющий: «Первый вход и подсказки», круг 3. Код раздела не правился.
Правила и пути ролей — `docs/ONBOARDING.md` (редакция 3); компоненты — `src/ui/onboarding/*`, витрина — `/dev/ui/onboarding`.
Серьёзность: block / major / minor. Новое в k3: пустой бизнес для проверки (`?demo=owner&empty=1`, в measure — `--persona owner-empty` / `individual-empty`) и два новых компонента: `ShareLinkCard` («ваша ссылка — только ваша» с «Копировать / Поделиться») и `OneTimeChoice` («спросить один раз → тихая строка „Режим: … · Изменить“»).
Отмечайте под пунктом `✅ исправлено (<метка>)` или `⏳ позже — почему`.
Смотрел: `/biz/online` (owner и owner-empty), `/biz/online/page` (owner-empty), телефон. Снимки: `qa/shots/onboarding-k3/owner/biz-online__owner-nails-ru-light-phone__full.png`,
`qa/shots/onboarding-k3/empty/biz-online__owner-empty-nails-ru-light-phone.png`, `qa/shots/onboarding-k3/empty/biz-online-page__owner-empty-nails-ru-light-phone.png`.

Итог по k2: из 9 пунктов сделан 1 (свой блок «Видимость в каталоге» на «Странице для клиентов» — наполовину, см. №3).

## 1. major · Своя ссылка — в самом низу, «ваша ссылка — только ваша» не сказано (k2 №1 и №8 — не сделано)
- Где: `src/areas/online/links/LinksScreen.tsx`. На телефоне у owner основная ссылка начинается на ~2 300 px (третий экран) — после
  «Новой ссылки», серой плашки про мобильный браузер и шести плиток «Что настроить». Ради неё сюда и приходят.
- Как исправить: первой на экране — `ShareLinkCard` (новый компонент, витрина «Ваша ссылка — только ваша»):
  ```tsx
  <ShareLinkCard url={mainLink.url} title={t('hub.yourLink')} badge={<Badge tone="success">{t('hub.main')}</Badge>}
    description={t('hub.yourLinkOnlyYours')}   // «Только ваш салон — без соседей, рекламы и чужих сторис»
    shareText={t('hub.shareText', { name })} onShared={markLinkShared}
    extraActions={<Button variant="ghost" leftIcon={<QrCode />} onClick={openQr}>{t('hub.qr')}</Button>} />
  ```
  Дальше — остальные ссылки, потом «Что настроить». «Новая ссылка» — secondary (одной основной хватает почти всем).
  Отдельный `HintBanner online.linkIsYours` тогда не нужен — обещание уже в карточке.

## 2. major · Пустой бизнес: ссылки нет вовсе (k2 №2 — не сделано)
- Где: `/biz/online` у owner-empty — ни ссылки, ни пустого состояния на первом экране.
- Как исправить: основная ссылка должна быть у бизнеса всегда (адрес `/b/<slug>` есть с регистрации — `uniqueBusinessSlug`). Показывайте
  `ShareLinkCard` с ним сразу; пока в бизнесе нет услуг/окон — `badge` `<Badge tone="warning">Клиенты пока не смогут записаться</Badge>` и под
  карточкой ссылка «Что добавить» → `/biz/online/page`.

## 3. minor · «Видимость в каталоге» — есть, но без пути «как исправить»
- Где: `/biz/online/page`, блок «Видимость в каталоге» (Тереза Мовсесян · «Нет онлайн-услуг»).
- Что: владелец узнаёт, что его не видно, но не может нажать, чтобы исправить; блок третий по счёту, ниже «Кто видит мой календарь».
- Как исправить: `VisibilityCard` первым блоком экрана, причины из `staffClientVisibility(...).reasons`, каждая ведёт исправлять
  («Нет онлайн-услуг» → `/biz/services`, «Нет окон» → `/biz/schedule`, «Нет фото» → блок фото), `action` — «Как видят клиенты» (`/b/<slug>`).

## 4. minor · Шум первого экрана: серая плашка про мобильный браузер и «?» отдельной строкой
- Где: `LinksScreen.tsx:91` (`meta={<HelpHint …/>}` — значок «?» на своей строке под пояснением) и плашка «Раздел „Онлайн-запись“
  работает так же в браузере…» (5 строк на телефоне).
- Как исправить: «?» — в `PageHeader actions` рядом с главной кнопкой (`TourButton iconOnly` или ваш `HelpHint`); плашку — в текст справки
  (`help.links.body`) или `HintBanner id="online.worksOnPhone" tone="info"` один раз с крестиком.

## 5. minor · Заголовки групп КАПСОМ (k2 №9 — не сделано)
- `LinksScreen.tsx:104, 112` — `uppercase tracking-wide` → обычный регистр `text-sm font-semibold text-muted`.

## 6. minor · Системная подсказка `title` у «Перенести» (k2 №7 — не сделано)
- `src/areas/online/booking/BookingConfirmedScreen.tsx:178` — `title=` запрещён (CONVENTIONS §0.3) и не работает пальцем: причина строкой под кнопками.

## 7. minor · Остальное из k2 (№4 «без установки», №5 нет окон — только «позвоните», №6 позвать в приложение после записи) — не сделано
- `BookingWizard.tsx:445` — нет окон: `action` «Показать другие дни» + «Сообщить, когда появится» (лист ожидания F-00-102).
