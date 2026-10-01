# Замечания сборки — schedule (25.09.2026, хранитель сборки, срез q4)

## 1. `src/api/schedule.ts:18` — неиспользуемый импорт `isCancelled`
- Серьёзность: **minor**
- Где: `src/api/schedule.ts:18` — `@typescript-eslint/no-unused-vars`.
- Что не так: появилось на финальном снимке `eslint` (не было в начале среза) — похоже на побочный
  продукт той же живой правки, что и партия tsc-ошибок в пункте 0 ниже.
- Как исправить: если `isCancelled` больше не нужен — убрать импорт; если нужен дальше по файлу —
  использовать. Решает раздел.

## 0. `npx tsc --noEmit`: массовая партия ошибок типов, похоже на середину живой правки — не файлы отчёта по каждой строке, один сводный пункт

- Серьёзность: **block** (если сохранится к следующему замеру — ломает типы всего проекта, `tsc`
  падает с ненулевым кодом), **но, вероятнее всего, уже неактуально** к моменту чтения этого файла.
- Где: на снимке 25.09 ~15:05 — 29 ошибок типов, почти все в `src/areas/schedule/**`:
  `CalendarScreen.tsx:297`, `components/BreaksEditor.tsx:38,76`, `components/MasterActionsCard.tsx:74`
  (×2), `components/NumberStepper.tsx:23,27`, `components/ScheduleCellView.tsx:62-64`,
  `components/ScheduleLegend.tsx:24,34,51`, `components/SchedulePanel.tsx` (15 мест, строки 217→389),
  `components/ScheduleRowMenu.tsx:29,36,39`, `ScheduleScreen.tsx:473` — плюс 2 в `online/requests/
  RequestsScreen.tsx:123` (описаны отдельно, `qa/measure/online/build-q4.md`, пункт 4).
- Что не так: подавляющее большинство (все `TS2345` с сообщением «не входит в
  `NamespacedMessageKeys<Messages, "schedule">`») — это ключи вида `panel.*`/`table.*`, переданные в
  `t()`, которых ещё нет в `messages/{ru,en,hy}/schedule.json`. При **пяти** прогонах `tsc` подряд за
  время этого среза список рос и менялся (2 → 3 → 5 → 9 → 29), а не колебался вокруг одного числа —
  это не флейк, это раздел прямо сейчас дописывает компоненты `SchedulePanel`/`ScheduleCellView`/
  `ScheduleLegend`/`ScheduleRowMenu`/`BreaksEditor`/`NumberStepper` и ещё не довёл словари до этих
  ключей (классический «ждёт раздела» по правилу CONVENTIONS — не дефект, если раздел ещё пишет).
  Отдельно два места **не про i18n-ключи** и стоит перепроверить целенаправленно, когда правка
  устаканится: `MasterActionsCard.tsx:74` (`notice.nextBookingId` — свойства нет в типе `DelayResult`,
  похоже на рассинхрон сигнатуры `sendDelayNotice`) и `ScheduleScreen.tsx:473` (сеттер
  `Dispatch<SetStateAction<string[]>>` передаётся туда, где ожидается `(cells: SelectedCell[]) => void`
  — тип стейта, похоже, поменяли в одном месте, но не везде).
- Как исправить: ничего не предпринимаю сам (правки раздела не мои) — фиксирую для раздела schedule:
  перед сдачей своей пачки прогнать `npx tsc --noEmit` самостоятельно и добить недостающие ключи в
  `messages/*/schedule.json`, отдельно проверить `MasterActionsCard.tsx:74` и `ScheduleScreen.tsx:473`
  — это не про словари, вероятная рассинхронизация типа с местом, где он используется.
