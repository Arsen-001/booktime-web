// C03 · Ручная предоплата по реквизитам (F-00-097): запись → «ждёт предоплату» держит окно → «Я оплатил» →
// мастер отмечает «получена»; и ветка «не оплатил вовремя → окно освободилось само».
import { bookingById, clientBook, freeTimes, openInJournal, journalBlockText, hm } from '../helpers.mjs';

const ERIK = 'st_kaytsak_erik'; // Kaytsak Barbershop, в сиде client: предоплата 5 000 ֏, 15 мин
const BARBER = '&sphere=barber';

export default {
  id: 'C03',
  title: 'Предоплата вручную: ждёт предоплату → «Я оплатил» → мастер получил; просрочка освобождает окно',
  personas: ['client', 'admin'],
  fids: ['F-00-097', 'F-00-092', 'F-00-101'],
  steps: [
    {
      id: 'S1',
      title: 'Запись к мастеру с предоплатой создаётся в статусе «Ждёт предоплату»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-097'],
      expect: 'Статус awaiting_prepayment, сумма 5 000 ֏, окно держится 15 мин',
      run: async (t) => {
        const { booking, db } = await clientBook(t, { staffId: ERIK });
        t.state.booking = booking;
        t.state.policy = db.areas.client.prepaymentPolicy[ERIK];
        t.assert(booking.status === 'awaiting_prepayment', `статус «${booking.status}»`);
        t.assert(booking.prepayment?.amount === t.state.policy?.amount, `сумма предоплаты ${booking.prepayment?.amount}, в правиле мастера ${t.state.policy?.amount}`);
        t.note(`запись ${booking.id} ${booking.start}; правило ${JSON.stringify(t.state.policy)}`);
      },
    },
    {
      id: 'S2',
      title: 'Клиент видит сумму, реквизиты мастера и до какого времени держится окно',
      persona: 'client',
      area: 'client',
      fids: ['F-00-097'],
      expect: '«Мастер просит предоплату 5 000 ֏», реквизиты из правила мастера (Idram …), «Окно держится до ЧЧ:ММ»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.expectText('Мастер просит предоплату');
        await t.expectText('Окно держится до');
        const req = t.state.policy.requisites;
        const txt = await t.text();
        t.assert(txt.includes(req) || txt.includes('Idram'), `реквизиты на экране не из правила мастера («${req}») — показан телефон мастера`);
      },
    },
    {
      id: 'S3',
      title: 'Администратор видит в журнале запись «ждёт предоплату», время закрыто',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-097'],
      expect: 'Блок на это время у Эрика; в окне записи статус «Ждёт предоплату» (а не «Ждёт подтверждения»)',
      needs: ['S1'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}${BARBER}`, 'desktop');
        const blocks = await journalBlockText(t, b);
        t.assert(blocks.length, 'записи нет в журнале барбершопа');
        const dlg = await openInJournal(t, 'admin', b, BARBER);
        const zone = dlg.locator('[data-f~="F-01-054"]');
        const shown = (await zone.count())
          ? ((await zone.locator('[aria-pressed="true"], [aria-selected="true"], [data-selected="true"]').allInnerTexts()).join(' ').trim() || '(ничего не выбрано)')
          : await dlg.locator('select').last().evaluate((s) => s.options[s.selectedIndex]?.text ?? '(пусто)');
        t.assert(/Ждёт предоплату/.test(shown), `в окне записи статус показан как «${shown}» — статус записи не выделен как «Ждёт предоплату»`);
      },
    },
    {
      id: 'S4',
      title: 'Клиент нажимает «Я оплатил» — таймер стоп, мастер получает отметку',
      persona: 'client',
      area: 'client',
      fids: ['F-00-097'],
      expect: 'Тост «Отметили, что вы оплатили…», срок держания окна снят, prepayment.paid = true',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.click('role=button[name="Я оплатил"]', { after: 800 });
        const db = await t.db();
        const b = bookingById(db, t.state.booking.id);
        t.assert(b.prepayment?.paid === true, 'prepayment.paid не стал true');
        t.assert(!db.areas.client.prepaymentDeadline[b.id], 'срок держания окна не снят');
      },
    },
    {
      id: 'S5',
      title: 'Мастер отмечает «предоплата получена» → запись подтверждена',
      persona: 'admin',
      area: 'finance',
      fids: ['F-00-097'],
      expect: 'В окне записи (вклад finance) кнопка «Предоплата получена» → статус «Подтверждена»',
      needs: ['S4'],
      run: async (t) => {
        const dlg = await openInJournal(t, 'admin', t.state.booking, BARBER);
        const txt = await dlg.innerText();
        const btn = dlg.getByRole('button', { name: /получена|Подтвердить (пред)?оплату/i });
        if (!(await btn.count())) {
          if (!/клиент отметил|оплатил|5\s?000/i.test(txt)) t.note('в окне записи журнала нет ни суммы предоплаты, ни пометки «клиент нажал „Я оплатил“» — только чип статуса «Ждёт предоплату»');
          t.wait('finance', 'кнопки «Предоплата получена» нет ни в журнале, ни во вкладе finance (заглушка)');
        }
        await btn.first().click();
        await t.settle(500);
        const b = bookingById(await t.db(), t.state.booking.id);
        t.assert(['scheduled', 'client_confirmed'].includes(b.status), `после «получена» статус ${b.status}`);
      },
    },
    {
      id: 'S6',
      title: 'Не нажал «Я оплатил» вовремя → окно освобождается само',
      persona: 'client',
      area: 'client',
      fids: ['F-00-097', 'F-00-101'],
      expect: 'Срок прошёл → запись снята, окно снова в списке свободных у мастера',
      run: async (t) => {
        const { booking, db: db0 } = await clientBook(t, { staffId: ERIK });
        t.state.serviceName = db0.core.services.find((s) => s.id === booking.services[0].serviceId)?.name.ru;
        t.assert(booking.status === 'awaiting_prepayment', `вторая запись в статусе ${booking.status}`);
        // «Прошло 15 минут»: переводим срок держания окна в прошлое (часы в демо не подкрутить)
        t.note(`срок держания окна: Booking.prepayment.holdUntil = ${booking.prepayment?.holdUntil ?? 'нет'}; срез client.prepaymentDeadline = ${(await t.db()).areas.client?.prepaymentDeadline?.[booking.id] ?? 'нет'}`);
        // сдвигаем срок в прошлое в обоих местах, где он может жить (ядро и черновик client)
        await t.patchDb(
          "const b = db.core.bookings.find((x) => x.id === arg.id); if (b && b.prepayment) b.prepayment.holdUntil = arg.past; if (db.areas.client && db.areas.client.prepaymentDeadline) db.areas.client.prepaymentDeadline[arg.id] = arg.past;",
          { id: booking.id, past: '2000-01-01T00:00' },
        );
        await t.go('client', '/bookings');
        const db = await t.db();
        const b = bookingById(db, booking.id);
        t.assert(b.status !== 'awaiting_prepayment', 'запись так и висит «ждёт предоплату» после срока');
        t.note(`после срока статус записи: ${b.status} (клиенту это показано как «${b.status === 'cancelled_by_client' ? 'Отменена вами' : b.status}»)`);
        t.state.expired = b;
        const times = await freeTimes(t, ERIK, booking.start.slice(0, 10), t.state.serviceName);
        t.assert(times.includes(hm(booking.start)), `окно ${hm(booking.start)} не вернулось в список свободных (${times.join(', ') || 'пусто'})`);
      },
    },
    {
      id: 'S7',
      title: 'Снятая по сроку запись не выдаётся клиенту за «Отменена вами»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-097', 'F-00-068'],
      expect: 'Отдельная понятная причина («не оплачена вовремя»), а не отмена клиентом',
      needs: ['S1'],
      run: async (t) => {
        t.assert(t.state.expired, 'шаг S6 не дошёл до снятия записи');
        t.assert(t.state.expired.status !== 'cancelled_by_client', 'просроченная предоплата записана как cancelled_by_client — клиент и салон увидят «Отменена клиентом», хотя он ничего не отменял');
      },
    },
  ],
};
