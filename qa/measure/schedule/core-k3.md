# Замечания хранителя ядра · k3 (25.09.2026)

1. **major · «Задерживаюсь» — событие ядра** (F-00-059): `sendDelayNotice` → `coreTx.reportDelay(nextBookingId, minutes)` в том же
   `request()` (или `reportBookingDelay`). Свой `delayNotices` можно оставить для бейджа мастера, но клиент узнаёт из события.
      ✅ исправлено (fix-schedule): sendDelayNotice → coreTx.reportDelay(следующая запись) в одном request; delayNotices — только для бейджа.
2. **minor · Серия одним запросом** (F-00-064): создавать все повторы в ОДНОМ `request()` с `coreTx.placeBooking` в цикле — сейчас
   каждый повтор платит задержку «сети». Запись в localStorage ядро уже удешевило.
      ✅ исправлено (fix-schedule): createSeries/extend — один request, coreTx.placeBooking в цикле.
3. **minor · Пояс филиала** — поле `Location.timezone` есть; окна по нему не пересчитывать (данные — время Еревана).
      ✅ исправлено (fix-schedule): окна по поясу не пересчитываются.
