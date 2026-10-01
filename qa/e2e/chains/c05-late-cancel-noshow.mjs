// C05 · Поздняя отмена = неявка (F-00-098) → счётчик неявок клиента у мастера (F-00-071).
import { addDays, today } from '../lib.mjs';
import { bookingById, clientBook, crmClientByPhone, freeTimes, hm } from '../helpers.mjs';

const GAYANE = 'st_nuri_gayane';

export default {
  id: 'C05',
  title: 'Поздняя отмена клиентом = неявка → счётчик неявок в CRM и в заявке',
  personas: ['client', 'admin'],
  fids: ['F-00-098', 'F-00-071', 'F-00-068', 'F-00-101'],
  steps: [
    {
      id: 'S0',
      title: 'Владелец ставит Гаяне срок бесплатной отмены 72 ч в «Правилах записи»',
      persona: 'owner',
      area: 'online',
      fids: ['F-00-098', 'F-00-066'],
      expect: '/biz/online/settings → «Правила мастеров» → Гаяне → «Бесплатная отмена, часов до записи» = 72 → «Сохранить»; правило легло в ядро (Staff.bookingRules.cancelWindowMin = 4320) — единый источник для приложения, ссылки и журнала',
      run: async (t) => {
        await t.go('owner', '/biz/online/settings', 'desktop');
        await t.click('button:has-text("Гаяне Оганесян")', { after: 500 });
        const label = t.page.locator('text=Бесплатная отмена, часов до записи').first();
        if (!(await label.count())) t.fail('в правилах мастера нет поля «Бесплатная отмена, часов до записи»');
        const input = label.locator('xpath=following::input[1]');
        await input.fill('72');
        await label.locator('xpath=following::button[normalize-space()="Сохранить"][1]').click();
        await t.settle(900);
        const db = await t.db();
        const st = db.core.staff.find((s) => s.id === GAYANE);
        const coreMin = st.bookingRules?.cancelWindowMin;
        const draft = JSON.stringify(db.areas.online ?? {}).match(/"cancel\w*":\s*(\d+)/g);
        t.note(`после «Сохранить»: Staff.bookingRules = ${JSON.stringify(st.bookingRules ?? null)}; черновики в срезе online: ${draft?.join(', ') ?? 'нет'}; срез client.cancelWindowHours[Гаяне] = ${db.areas.client?.cancelWindowHours?.[GAYANE] ?? 'нет (24 по умолчанию)'}`);
        t.assert(coreMin === 72 * 60, `правило мастера не легло в ядро: Staff.bookingRules.cancelWindowMin = ${coreMin ?? 'нет'} (ждали 4320)`);
      },
    },
    {
      id: 'S1',
      title: 'Клиент записывается к Гаяне на послезавтра (≈48 ч до визита)',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092'],
      expect: 'Запись создана; 48 ч — позже срока 72 ч, но раньше 24 ч «по умолчанию»',
      run: async (t) => {
        const r = await clientBook(t, { staffId: GAYANE, service: 'Маникюр классический', date: addDays(today(), 2) });
        t.state.booking = r.booking;
        const user = r.db.core.appUsers.find((u) => u.id === 'au_01');
        t.state.crmBefore = crmClientByPhone(r.db, 'biz_nuri', user.phone);
        t.note(`запись ${r.booking.id} на ${r.booking.start}`);
      },
    },
    {
      id: 'S2',
      title: 'В записи клиент заранее видит: срок бесплатной отмены прошёл',
      persona: 'client',
      area: 'client',
      fids: ['F-00-098'],
      expect: 'Правило мастера (72 ч) из ядра доходит до приложения: «Срок бесплатной отмены прошёл — отмена засчитается как неявка»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.expectText('засчитается как неявка');
      },
    },
    {
      id: 'S3',
      title: 'Поздняя отмена: «Отменил клиент» + неявка (правило ядра)',
      persona: 'client',
      area: 'client',
      fids: ['F-00-098', 'F-00-068'],
      expect: '«Отменить запись» в окне подтверждения → статус «Отменил клиент» (cancelled_by_client), поздняя отмена считается неявкой (clientCancelOutcome ядра)',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.click('role=button[name="Отменить запись"]', { after: 400 });
        const dlgText = await t.page.locator('[role="dialog"], [role="alertdialog"]').last().innerText().catch(() => '');
        t.state.lateWarned = /неявк/i.test(dlgText);
        t.note(`окно отмены: «${dlgText.replace(/\n+/g, ' · ').slice(0, 140)}»`);
        await t.clickInDialog(/^(Да, отменить|Отменить запись)$/, { after: 900 });
        const db = await t.db();
        const b = bookingById(db, t.state.booking.id);
        t.state.db = db;
        // Правило ядра clientCancelOutcome: позже срока = «Отменил клиент» + неявка в счётчик (не статус no_show)
        if (!t.state.lateWarned) t.note('окно отмены назвало её бесплатной («без последствий») — срок мастера 72 ч до приложения не дошёл (см. S2)');
        t.assert(b.status === 'cancelled_by_client', `статус после поздней отмены «${b.status}»; по правилу ядра clientCancelOutcome — cancelled_by_client + счётчик неявок (приложение ставит no_show своей копией правила)`);
      },
    },
    {
      id: 'S4',
      title: 'Счётчик неявок клиента в CRM салона вырос',
      persona: 'admin',
      area: 'client',
      fids: ['F-00-071'],
      expect: 'Client.noShowCount карточки клиента в Nuri +1 (его видит мастер в заявке)',
      needs: ['S2', 'S3'],
      run: async (t) => {
        const before = t.state.crmBefore;
        const after = t.state.db.core.clients.find((c) => c.id === before?.id);
        t.assert(before && after, 'нет карточки клиента в CRM');
        t.assert(after.noShowCount === before.noShowCount + 1, `noShowCount ${before.noShowCount} → ${after.noShowCount}: поздняя отмена в приложении записана статусом no_show, но счётчик неявок карточки CRM не меняется (cancelBookingByClient его не трогает)`);
      },
    },
    {
      id: 'S5',
      title: 'Администратор видит неявку в карточке клиента',
      persona: 'admin',
      area: 'clients',
      fids: ['F-00-071'],
      expect: '/biz/clients → карточка клиента: «Не пришёл: N» с учётом поздней отмены',
      needs: ['S3'],
      run: async (t) => {
        await t.openOrWait('admin', `/biz/clients/${t.state.crmBefore.id}`, 'clients', 'карточка клиента /biz/clients/[id] — заглушка');
        const txt = await t.mainText();
        t.assert(/неяв|не приш/i.test(txt), 'в карточке клиента нет счётчика неявок');
      },
    },
    {
      id: 'S6',
      title: 'Время поздно отменённой записи всё же снова предлагается другим',
      persona: 'client',
      area: 'client',
      fids: ['F-00-101'],
      expect: 'Окно освободилось (отмена = неявка для репутации, но время свободно)',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        const times = await freeTimes(t, GAYANE, b.start.slice(0, 10), 'Маникюр классический');
        t.assert(times.includes(hm(b.start)), `окно ${hm(b.start)} после поздней отмены осталось занятым: статус no_show держит время в расчёте окон`);
      },
    },
  ],
};
