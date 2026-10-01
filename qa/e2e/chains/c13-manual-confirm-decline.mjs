// C13 · Мастер «с подтверждением» (F-00-067) отклоняет заявку → клиент получает отмену с выбором другого
// времени у того же мастера (F-00-100) → окно свободно (F-00-101). Стоматология: Ашот Торосян.
import { bookingById, clientBook, freeTimes, journalBlockText, setStatusInJournal, hm } from '../helpers.mjs';

const ASHOT = 'st_atam_ashot';
const DENTAL = '&sphere=dental';

export default {
  id: 'C13',
  title: 'Заявка к мастеру «с подтверждением» → мастер отклонил → клиенту другое время',
  personas: ['client', 'admin'],
  fids: ['F-00-067', 'F-00-071', 'F-00-100', 'F-00-101'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент видит «ждёт подтверждения мастера»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-067'],
      expect: 'Статус «Ждёт подтверждения» в «Мои записи»',
      run: async (t) => {
        const { booking } = await clientBook(t, { staffId: ASHOT });
        t.state.booking = booking;
        t.note(`запись ${booking.id} ${booking.start} ${booking.status}, appUserId ${booking.appUserId ?? '—'}, бизнес ${booking.businessId}`);
        t.assert(booking.status === 'awaiting_confirmation', `статус ${booking.status}`);
        await t.go('client', '/bookings');
        if (!(await t.has('Ждёт подтверждения'))) {
          const inList = await t.page.locator(`a[href="/bookings/${booking.id}"]`).count();
          t.fail(inList ? 'запись в «Мои записи» есть, но без метки «Ждёт подтверждения»' : `новой записи ${booking.id} (${booking.start.slice(0, 10)}) нет в «Мои записи» → «Предстоящие» — видны только записи сида`);
        }
      },
    },
    {
      id: 'S2',
      title: 'В заявке у клиники виден пациент и счётчик неявок',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-067', 'F-00-071'],
      expect: 'Журнал клиники: заявка с именем пациента и «не пришёл: N»',
      needs: ['S1'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}${DENTAL}`, 'desktop');
        const blocks = await journalBlockText(t, b);
        t.assert(blocks.length, 'заявки нет в журнале клиники');
        t.assert(!blocks[0].includes('Без клиента'), `заявка без пациента: «${blocks[0].replace(/\n/g, ' · ')}» — мастер не может решить, подтверждать ли`);
      },
    },
    {
      id: 'S3',
      title: 'Администратор отклоняет заявку («Отменена мастером»)',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-067', 'F-00-100'],
      expect: 'Статус cancelled_by_master сохранился',
      needs: ['S1'],
      run: async (t) => {
        const upd = await setStatusInJournal(t, 'admin', t.state.booking, 'cancelled_by_master', DENTAL);
        t.assert(upd.status === 'cancelled_by_master', `статус ${upd.status}`);
      },
    },
    {
      id: 'S4',
      title: 'Клиент видит отмену мастером и кнопку «выбрать другое время» у того же мастера',
      persona: 'client',
      area: 'client',
      fids: ['F-00-100'],
      expect: '«Отменена мастером» + кнопка другого времени у Ашота',
      needs: ['S3'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.expectText(/Отменена мастером|Отменил мастер|Отменена врачом/);
        const btn = t.page.locator('main a, main button', { hasText: /друг(ое|ое время)|Записаться снова|Повторить|Выбрать время/ });
        t.assert(await btn.count(), 'после отмены мастером нет кнопки выбрать другое время у того же мастера');
      },
    },
    {
      id: 'S5',
      title: 'Освободившееся после отказа окно снова свободно',
      persona: 'client',
      area: 'client',
      fids: ['F-00-101'],
      expect: 'Время заявки снова в списке окон Ашота',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        const db = await t.db();
        const svc = db.core.services.find((s) => s.id === b.services[0].serviceId);
        const times = await freeTimes(t, ASHOT, b.start.slice(0, 10), svc?.name.ru);
        t.assert(times.includes(hm(b.start)), `окно ${hm(b.start)} не вернулось (${times.join(', ')})`);
        t.state.db = db;
      },
    },
    {
      id: 'S6',
      title: 'Клиент получает пуш о решении мастера',
      persona: 'client',
      area: 'notify',
      fids: ['F-00-067', 'F-00-120'],
      expect: 'В «Уведомлениях» клиента (/notifications) — «Ашот Торосян отменил запись… выберите другое время»; в журнале отправок салона — пуш этому клиенту',
      needs: ['S3'],
      run: async (t) => {
        await t.go('client', '/notifications');
        const txt = await t.mainText();
        const idx = txt.indexOf('Ашот Торосян');
        const near = idx >= 0 ? txt.slice(idx, idx + 160) : '';
        t.assert(/отмен|отклон/i.test(near), `в уведомлениях клиента нет сообщения об отказе мастера (про Ашота: «${near.replace(/\n+/g, ' · ').slice(0, 100) || '—'}») — решение мастера в журнале не порождает пуш клиенту`);
      },
    },
  ],
};
