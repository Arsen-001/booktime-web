# staff · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра.

## Major

1. **Права — одна функция `can()`** (`src/domain/rules/permissions.ts`): `can(persona, permission, { overrides, actorStaffId,
   targetStaffId })`. Галочки администратора, которые вы пишете `setStaffPermissions`, действуют через неё и в экранах (`useCan`),
   и в api (`assertCan`). Учтите зависимости прав (`PERMISSION_REQUIRES`): `journal.create`/`journal.reschedule` работают только
   вместе с `journal.edit`, `clients.phones/export/edit` — с `clients.view`. В редакторе прав показывайте зависимые галочки
   неактивными без базовой.
2. **Контакты мастера — поле ядра `Staff.contacts`** (`whatsapp`, `telegram`, `instagram`, `callMode`: always / hours / busy /
   messages) и `Staff.callHours` — хозяин вы (решение ядра №12). Черновик сейчас в срезе client (`contacts`) — заведите редактор
   в карточке сотрудника, client перейдёт на чтение поля и удалит черновик. Телефон клиенту уходит только через
   `toPublicStaff(...).contacts.phone`, когда открыт звонок или WhatsApp (F-00-104/105).

## Minor

- `Staff.bookingRules` (свои сроки отмены/переноса) пишет online, `Staff.prepayment` — вы (k1): показывайте в карточке сотрудника.
