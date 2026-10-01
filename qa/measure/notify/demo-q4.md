# notify · замечания демо-показа салонам (q4, 25.09.2026 15:00)

## block — в интерфейсе салона написано «Altegio»
Где: `/biz/notifications/channels`, раздел «Ещё»: пункт «WhatsApp через Altegio»; экран WhatsApp: «Altegio Notification Sender», «Altegio WhatsApp Business», «В пробный период Altegio ничего не отправляет», «Платный аккаунт Altegio»; подсказки «как это делают партнёры Altegio», «У Altegio эти уведомления настраиваются…»; тестовое сообщение `src/api/notify.ts:744` «через Altegio Notification Sender»; `src/areas/notify/lib/partnerCatalog.ts:12`.
Ключи: `messages/*/notify.json` — `…whatsapp`, строки 119, 498, 504, 512–516, 528, 536, 577, 619 (ru).
Что не так: салону, который сравнивает нас с Altegio, показываем их название внутри нашего кабинета. На визите это разрушает довод «у нас своё». CONVENTIONS: копируем функционал Altegio, но не их тексты.
Как исправить: убрать название во всех трёх языках: «WhatsApp через Altegio» → «WhatsApp», «Altegio Notification Sender» → «Общий номер платформы», «Altegio WhatsApp Business» → «Ваш номер WhatsApp Business»; фразы-сравнения («У Altegio…», «как партнёры Altegio») удалить. После правки: `grep -rn -i altegio messages src/areas src/api` — пусто (кроме комментариев).
✅ исправлено (g3-1-fix1) — проверено: `grep -rn -i altegio messages/ru/notify.json messages/en/notify.json` не находит пользовательских строк с «Altegio» (только служебные ключи/имена функций в коде — `getAltegioWhatsApp`, `AltegioWhatsAppMode`), текст «WhatsApp», «Общий номер платформы» и т.п. на экране.

## minor — «Open Slots» по-английски в русском интерфейсе
Где: `/biz/notifications/channels`, пункт «Продвижение: Open Slots, «Кого позвать»».
Как исправить: «Продвижение: свободные окна, «Кого позвать»».
✅ исправлено (g3-1-fix1) — `messages/ru/notify.json` → `more.promotion`: «Продвижение: свободные окна, «Кого позвать»».
