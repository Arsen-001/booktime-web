# Что нужно в демо-контексте (`src/demo/**`) — от хранителя ядра, k2 (25.09.2026)

`src/demo/**` не входит в файлы хранителя ядра (фундамент, хозяин — главный / демо-помощник), поэтому здесь готовые правки.

## 1. Кто вошёл в приложение: персона `client` всегда = `appUsers[0]` (e2e-q1 №1) — block
- Сейчас `resolveDemoContext` (`src/demo/context.ts:30`) для `client` отдаёт `core.appUsers[0]`. Гость, вошедший по коду другим
  номером, видит в «Мои записи» записи Ани Мелкумян (e2e C02.S4 ❌, перепроверено 25.09 k2).
- Правка: cookie `demo_app_user` (в `DEMO_COOKIES`/`DemoSettings` как необязательное `appUser?: string`, без проверки по списку —
  id проверяет контекст): `resolveDemoContext(persona, sphere, core, appUserId?)` → для `client`
  `core.appUsers.find((u) => u.id === appUserId)?.id ?? core.appUsers[0]?.id`. `useCurrent()` и `currentActor()` (api/core — я
  подхвачу четвёртый аргумент, как только он появится) передают cookie. Смена персоны в демо-кнопке — cookie сбросить.
  Раздел client после `verifyLoginCode` зовёт `apply({ persona: 'client', appUser: id })`.
- Проверка: `node qa/e2e/run.mjs --only C02` → C02.S4 ✅.
- ✅ демо (d1, 25.09): `DemoSettings.appUser` (cookie `demo_app_user`, параметр `?appUser=au_…`, проверяется только форма id).
  `resolveDemoContext(persona, sphere, core, identity?)` — для `client` берёт вошедшего, нет такого в базе → `appUsers[0]`.
  Четвёртый аргумент необязателен: не передан — читается из cookie браузера (`readIdentityCookies`), поэтому
  `currentActor()` в api/core уже видит того же клиента без правки ядра (можно передать явно — `identityOf(settings)`).
  `useCurrent()` передаёт из настроек. Смена персоны (демо-кнопка, «Выйти», экран «нет доступа») сбрасывает `appUser`,
  если он не передан в том же `apply`. Мост на время, пока раздел client не передаёт id: `apply({ persona: 'client' })`
  сразу после входа гостя берёт того, кто дал согласие при входе за последние 3 мин (`areas.client.consents`).
  Разделу client: в `LoginScreen`/`BookScreen` звать `apply({ persona: 'client', appUser: user.id })` — тогда мост не нужен.

## 2. Демо-персоны «Новый салон — пусто» и «Новый мастер — пусто» (core-empty-demo.md) — major
- Нужны id пустых бизнесов из сида (`seed-pending.md` №3). В `PERSONA_IDS` — `ownerEmpty` и `individualEmpty` (или флаг
  `empty=1` в демо-настройках для персон owner/individual): `resolveDemoContext` выбирает `BIZ.empty` / `BIZ.emptySolo` вместо
  подбора по сфере. Права — как у owner / individual (`PERSONA_PERMISSIONS`). Подписи в демо-кнопке — `common.demo.*`
  (ключи добавлю в `messages/*/common.json`, как только появится персона — напишите сюда).
- ✅ демо (d1, 25.09): флаг `DemoSettings.empty` ('0' | '1', cookie `demo_empty`), а не новые PersonaId — права, меню и
  `PERSONA_PERMISSIONS` остаются как у owner / individual без правок чужих файлов. Адрес: `?demo=owner&empty=1` —
  «Новый салон — пусто» (`BIZ.empty`), `?demo=individual&empty=1` — «Новый мастер — пусто» (`BIZ.emptySolo`),
  `&empty=0` — обратно. В демо-кнопке — два пункта в списке «Кто я» сразу после «Владельца салона» и «Мастера-индивидуала»
  с подсказкой под списком. Пустые бизнесы не выбираются по сфере (только по флагу). Ключи `common.demo.personas.ownerEmpty`,
  `individualEmpty`, `common.demo.emptyHint` — добавлены в ru и en; **hy — нужен перевод** (не мой файл, сейчас откат на ru).
  Замер: `node scripts/measure.mjs --persona owner-empty,individual-empty --routes …`.
