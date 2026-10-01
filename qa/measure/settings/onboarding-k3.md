# Первый вход и подсказки — раздел settings (onboarding-k3)

Дата: 25.09.2026. Проверяющий: «Первый вход и подсказки», круг 3. Код раздела не правился.
Правила и пути ролей — `docs/ONBOARDING.md` (редакция 3); компоненты — `src/ui/onboarding/*`, витрина — `/dev/ui/onboarding`.
Серьёзность: block / major / minor. Новое в k3: пустой бизнес для проверки (`?demo=owner&empty=1`, в measure — `--persona owner-empty` / `individual-empty`) и два новых компонента: `ShareLinkCard` («ваша ссылка — только ваша» с «Копировать / Поделиться») и `OneTimeChoice` («спросить один раз → тихая строка „Режим: … · Изменить“»).
Отмечайте под пунктом `✅ исправлено (<метка>)` или `⏳ позже — почему`.
Смотрел: `/biz/onboarding` у owner-empty (телефон), снимок `qa/shots/onboarding-k3/empty/biz-onboarding__owner-empty-nails-ru-light-phone.png`.

## 1. major · «Быстрый старт» и «Первые шаги» — всё ещё заглушка «скоро появится» (k1, k2 — не сделано)
- Что: это единственный экран, который собирает первый вход владельца и индивидуала (ONBOARDING §2.1–2.2); без него у нового салона нет
  ни приветствия, ни чек-листа, ни ответа «видно ли меня в каталоге».
- Как исправить (всё уже есть в `src/ui/onboarding`, витрина показывает каждое): вверху `VisibilityCard` → `ChecklistCard id="settings.firstSteps"`
  (6 шагов из ONBOARDING §2.1, `done` — по данным, прогресс — `checklistProgress`) → `ShareLinkCard` на шаге «Поделитесь ссылкой»
  (`onShared` отмечает шаг). Приветствие `WelcomeDialog id="settings.welcome.owner"`. Для журнала и шапки отдайте хук прогресса
  (`useFirstStepsProgress()` поверх `checklistProgress`) — journal и хранитель дизайна ждут его, чтобы не считать шаги сами.
- Проверять на `?demo=owner&empty=1` и `?demo=individual&empty=1` (пустой бизнес теперь есть) — у пустого бизнеса своя память подсказок.
