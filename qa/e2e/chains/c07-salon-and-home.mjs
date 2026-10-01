// C07 · Мастер и в салоне, и дома (F-00-045, F-00-046, F-00-047, F-00-048, F-00-073):
// клиент записывается на «домашнее» окно → у админа салона это время закрыто и подписано «дома» без имени.
import { Fail, nextWeekday, today, addDays } from '../lib.mjs';
import { bookingById, clientBook, journalBlockText, hm } from '../helpers.mjs';

const ANI = 'st_nuri_ani'; // салон пн–пт, дома — вс 11:00–16:00 (сид)

export default {
  id: 'C07',
  title: 'Мастер в салоне и дома: домашняя запись закрывает время у админа без имени',
  personas: ['client', 'master', 'admin', 'owner'],
  fids: ['F-00-045', 'F-00-046', 'F-00-047', 'F-00-048', 'F-00-073'],
  steps: [
    {
      id: 'S1',
      title: 'Карточка мастера: видно «в салоне» и «дома у мастера»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-048'],
      expect: 'Метки обоих мест работы',
      run: async (t) => {
        await t.go('client', `/masters/${ANI}`);
        await t.expectText('В салоне');
        await t.expectText('Дома у мастера');
      },
    },
    {
      id: 'S2',
      title: 'Мастер видит свой домашний график рядом с салонным',
      persona: 'master',
      area: 'schedule',
      fids: ['F-00-045', 'F-00-073'],
      expect: '/biz/schedule: в воскресенье у Ани 11:00–16:00 «дома», а не «—»',
      run: async (t) => {
        await t.go('master', '/biz/schedule', 'desktop');
        const sunday = nextWeekday(today(), 6);
        const txt = await t.mainText();
        const dd = String(Number(sunday.slice(8, 10)));
        const idx = txt.search(new RegExp(`вс, ${dd} `));
        const around = idx >= 0 ? txt.slice(Math.max(0, idx - 40), idx + 10) : '';
        t.assert(/11:00/.test(around) || /дома/i.test(txt), `в графике мастера воскресенье (${sunday}) пустое: «${around.replace(/\s+/g, ' ')}» — домашний график (workplace home) не показан`);
      },
    },
    {
      id: 'S3',
      title: 'Клиент записывается на воскресное окно «дома у мастера»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-073', 'F-00-045'],
      expect: 'Запись на воскресенье 11:00+ (домашний график) создана',
      run: async (t) => {
        const sunday = nextWeekday(addDays(today(), 1), 6);
        const { booking, db } = await clientBook(t, { staffId: ANI, service: 'Маникюр классический', date: sunday });
        t.state.booking = booking;
        t.state.db = db;
        t.note(`запись ${booking.id} ${booking.start}, workplace ${booking.workplace}`);
      },
    },
    {
      id: 'S3b',
      title: 'Запись на «домашнее» окно помечена местом «дома»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-073', 'F-00-045'],
      expect: 'booking.workplace = home (окно из графика workplace home); клиент видит «дома у мастера» в записи',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        t.assert(b.workplace === 'home', `окно из домашнего графика, а запись создана с workplace «${b.workplace}» (bookAppointment ставит salon всегда)`);
      },
    },
    {
      id: 'S4',
      title: 'Администратор салона видит это время закрытым и подписанным «дома»',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-046'],
      expect: 'В колонке Ани на это время — «Дома» без имени клиента и суммы',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const blocks = await journalBlockText(t, b);
        const txt = await t.mainText();
        if (!blocks.length) {
          t.assert(/дома/i.test(txt), 'время домашней записи у админа никак не закрыто: ни блока, ни пометки «дома»');
          return;
        }
        t.assert(/дома/i.test(blocks.join(' ')), `домашняя запись показана админу как обычная салонная: «${blocks[0].replace(/\n/g, ' · ')}»`);
        t.assert(!/Маникюр|₽|֏/.test(blocks.join(' ')), 'админ видит услугу/сумму домашней записи');
      },
    },
    {
      id: 'S5',
      title: 'Двойная запись на это время невозможна: админ пробует записать Ани в салон',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-045'],
      expect: 'Новая запись на это же время → «Это время у мастера уже занято»; вторая запись не создаётся',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        const before = (await t.db()).core.bookings.length;
        await t.go('admin', `/biz/journal?new=1&staff=${ANI}&start=${hm(b.start)}&date=${b.start.slice(0, 10)}`, 'desktop');
        const dlg = t.page.locator('[role="dialog"]').first();
        if (!(await dlg.count())) throw new Fail('окно новой записи не открылось по ссылке ?new=1');
        await dlg.locator('input[type="tel"]').first().fill('00199911');
        await dlg.locator('input[placeholder="Имя"]').first().fill('Салонная Проба');
        const svc = dlg.locator('button', { hasText: 'Маникюр классический' }).first();
        if (await svc.count()) await svc.click();
        await dlg.getByRole('button', { name: /^(Записать|Сохран|Созда)/ }).last().click();
        await t.settle(500);
        const dialogs = t.page.locator('[role="dialog"], [role="alertdialog"]');
        if ((await dialogs.count()) > 1) {
          t.note(`диалог: «${(await dialogs.last().innerText()).replace(/\n+/g, ' · ').slice(0, 120)}»`);
          await dialogs.last().getByRole('button').last().click();
          await t.settle(500);
        }
        const after = (await t.db()).core.bookings.length;
        t.assert(after === before, 'вторая запись на то же время создана — пересечение с домашней записью не проверено');
      },
    },
    {
      id: 'S6',
      title: 'Салон запрещает домашние записи в часы смены',
      persona: 'owner',
      area: 'staff',
      fids: ['F-00-047'],
      expect: 'Галочка владельца «запретить домашние записи в часы смены»; при выключенной — предупреждение мастеру и уведомление админу',
      run: async (t) => {
        await t.openOrWait('owner', '/biz/staff', 'staff', '/biz/staff — заглушка; поле Business.forbidHomeBookingsDuringShift в ядре есть, экрана нет');
        t.fail('сотрудники построены — дописать проверку галочки «запретить домашние записи в часы смены»');
      },
    },
  ],
};
