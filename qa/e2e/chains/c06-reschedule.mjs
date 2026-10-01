// C06 · Перенос клиентом (F-00-099): окна того же мастера на ту же услугу → новое время в журнале,
// старое освободилось.
import { Fail, addDays, today } from '../lib.mjs';
import { bookingById, clientBook, freeTimes, journalBlockText, hm } from '../helpers.mjs';

const GAYANE = 'st_nuri_gayane';
const CLASSIC = 'Маникюр классический';

export default {
  id: 'C06',
  title: 'Перенос клиентом → журнал показывает новое время, старое свободно',
  personas: ['client', 'admin'],
  fids: ['F-00-099', 'F-00-101'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент записан к Гаяне через 2+ дня',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092'],
      expect: 'Запись создана',
      run: async (t) => {
        // q4: окна Гаяне сдвинулись — берём первый день ≥ +2 с окнами (было: только +3 / +4)
        let r;
        const tried = [];
        for (let d = 2; d <= 9 && !r; d++) {
          r = await clientBook(t, { staffId: GAYANE, service: CLASSIC, date: addDays(today(), d) }).catch((e) => {
            tried.push(`${addDays(today(), d)}: ${e.message}`);
            return undefined;
          });
        }
        if (!r) throw new Fail(`не удалось записаться к Гаяне ни на один день +2…+9: ${tried.slice(0, 3).join('; ')}`);
        if (tried.length) t.note(`пропущено: ${tried.join('; ')}`);
        t.state.booking = r.booking;
      },
    },
    {
      id: 'S2',
      title: '«Перенести» сразу показывает окна того же мастера и услуги; перенос одним выбором',
      persona: 'client',
      area: 'client',
      fids: ['F-00-099'],
      expect: '/bookings/[id] → «Перенести» → экран «Перенос записи» → окно → «Запись перенесена»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.click('text=Перенести', { after: 700 });
        await t.expectText('Перенос записи');
        // другой день: следующий в полосе дат
        const days = t.page.locator('button.min-w-16');
        if ((await days.count()) > 1) {
          await days.nth(1).click();
          await t.settle(300);
        }
        const slot = t.page.locator('button.min-h-11').first();
        await slot.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {
          throw new Fail('на экране переноса нет окон');
        });
        await slot.click();
        await t.settle(1200);
        const db = await t.db();
        const b = bookingById(db, t.state.booking.id);
        t.assert(b.start !== t.state.booking.start, 'время записи не изменилось');
        t.state.moved = b;
        t.note(`${t.state.booking.start} → ${b.start}, статус ${b.status}`);
      },
    },
    {
      id: 'S3',
      title: 'Старое время освободилось для других',
      persona: 'client',
      area: 'client',
      fids: ['F-00-101'],
      expect: 'В записи к Гаяне на старый день снова есть старое время',
      needs: ['S2'],
      run: async (t) => {
        const old = t.state.booking;
        const times = await freeTimes(t, GAYANE, old.start.slice(0, 10), CLASSIC);
        t.assert(times.includes(hm(old.start)), `старое окно ${hm(old.start)} не освободилось (${times.join(', ')})`);
      },
    },
    {
      id: 'S4',
      title: 'В журнале запись стоит на новом времени, на старом — пусто',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-099'],
      expect: 'Блок «Маникюр классический» на новой дате/времени, на старых — нет',
      needs: ['S2'],
      run: async (t) => {
        const moved = t.state.moved;
        await t.go('admin', `/biz/journal?date=${moved.start.slice(0, 10)}`, 'desktop');
        const now = (await journalBlockText(t, moved)).filter((x) => x.includes(CLASSIC));
        t.assert(now.length, 'на новом времени записи нет в журнале');
        const old = t.state.booking;
        await t.go('admin', `/biz/journal?date=${old.start.slice(0, 10)}`, 'desktop');
        const was = (await journalBlockText(t, old)).filter((x) => x.includes(CLASSIC));
        t.assert(!was.length, 'на старом времени в журнале остался блок');
      },
    },
    {
      id: 'S5',
      title: 'После переноса к мастеру «сразу» запись остаётся подтверждённой',
      persona: 'client',
      area: 'client',
      fids: ['F-00-099', 'F-00-067'],
      expect: 'Статус не откатывается в «Ждёт подтверждения» у мастера без подтверждения',
      needs: ['S2'],
      run: async (t) => {
        t.assert(t.state.moved.status !== 'awaiting_confirmation', `после переноса статус ${t.state.moved.status} при confirmMode Гаяне = instant`);
      },
    },
  ],
};
