# Замечания сборки — platform (25.09.2026, хранитель сборки, срез q2)

Источник: `npx tsc --noEmit` (проект целиком, 0 ошибок), `npx eslint src` (проект целиком, 0 errors /
11 warnings — 4 из них в файлах раздела platform, без изменений с q1). Обход `/dev/routes` персонами
owner/client/platform по маршрутам раздела (`/platform`, `/platform/businesses`, `/platform/plan`,
`/platform/moderation`, `/platform/connect`, `/platform/visits`, `/platform/promocodes`,
`/platform/ads`, `/platform/demand`, `/platform/sphere-requests`, `/platform/ideas`,
`/platform/support`) во втором (авторитетном) прогоне — 0 плохих ответов, 0 ошибок консоли. В первом
прогоне почти все страницы `/platform/*` ловили 500 разом (`Module not found: Can't resolve
'@/ui/parts/ChannelPicker'` из `src/ui/PhoneVerify.tsx` — файл фундамента) под всеми тремя персонами;
сразу после и во втором полном обходе (369 страниц) — уже 200, `ChannelPicker.tsx` на месте и
экспортирует то, что от него ждут. Похоже на самозалечившийся сбой турбопака во время правки фундамента
параллельным сборщиком — не отчитано разделу platform как баг (причина не в файлах раздела), фундаменту
тоже не заведено отдельно: не воспроизвелось при прямой проверке (флейк, не измерение).

## 1. `src/api/platform.ts:1045` — неиспользуемый параметр `_placementId`
- Серьёзность: **major**
- Где: `src/api/platform.ts`, строка 1045 (eslint `@typescript-eslint/no-unused-vars`)
- Что не так: то же замечание, что в срезе q1 (там была строка 985 — сдвинулась из-за правок раздела
  между срезами) — параметр объявлен и нигде не читается.
- Как исправить: без изменений с q1 — использовать параметр или убрать из сигнатуры (и из мест вызова),
  либо оставить с подчёркиванием и комментарием `// зарезервировано: …`, если он под будущую логику.
- ✅ исправлено (fix-platform): параметр убран — `getAdReach()` без аргумента, охват показан в форме поставщика до сохранения.

## 2–3. `src/areas/platform/ConnectScreen.tsx:116,117` — неиспользуемые `_args`, `_id`
- Серьёзность: **major**
- Где: `src/areas/platform/ConnectScreen.tsx`, строки 116 и 117 (eslint `@typescript-eslint/no-unused-vars`)
- Что не так: без изменений с q1 — два параметра колбэка объявлены и не используются.
- Как исправить: убрать неиспользуемые параметры из сигнатуры колбэка (или использовать их, если это
  заготовка под будущий шаг мастера подключения).
- ✅ исправлено (fix-platform): мастер переписан, неиспользуемых параметров нет (eslint раздела — 0).

## 4. `src/areas/platform/ModerationScreen.tsx:282` — `<img>` вместо `next/image`
- Серьёзность: **major**
- Где: `src/areas/platform/ModerationScreen.tsx`, строка 282 (eslint `@next/next/no-img-element`)
- Что не так: без изменений с q1 — превью материала на проверке рисуется голым `<img>`.
- Как исправить: заменить на `<Image>` из `next/image` с явными `width`/`height` (или `fill` в
  контейнере с заданным размером), как в карточках фото в других разделах.
- ✅ исправлено (fix-platform): все картинки раздела — `next/image` (ModerationThumb, ModerationPreview, AdThumb, AdDetailSheet).
