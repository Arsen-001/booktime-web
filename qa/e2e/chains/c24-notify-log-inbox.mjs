// C24 · Уведомления от события записи (F-05-024…032, F-00-101): клиент записался в приложении → в «Журнале
// отправок» кабинета — сообщение клиенту пушем (не SMS/WhatsApp — сняты, только пуш) → в «Центре уведомлений» —
// «Новая онлайн-запись» → салон отменил → в журнале отправок — сообщение об отмене, в центре уведомлений — отмена →
// клиент видит отмену у себя в «Уведомлениях». Журнал отправок и центр — раздел notify, запись — client и journal.
import { Fail, addDays, today } from '../lib.mjs';
import { clientBook, hm, setStatusInJournal } from '../helpers.mjs';

const SONA = 'st_nuri_sona';
const PHONE_TAIL = '160001'; // клиент приложения au_01 — +374 00 160 001

function ddmm(date) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

async function logRows(t) {
  await t.go('owner', '/biz/notifications/log', 'desktop');
  const search = t.page.locator('input[placeholder="Поиск по телефону или email"]').filter({ visible: true }).first();
  if (!(await search.count())) throw new Fail('в журнале отправок нет поиска по телефону');
  await search.fill(PHONE_TAIL);
  await t.settle(600);
  const rows = await t.page.locator('main tr, main li, main [data-row]').allInnerTexts();
  return rows.map((r) => r.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export default {
  id: 'C24',
  title: 'Запись из приложения → журнал отправок и центр уведомлений кабинета → отмена салоном → клиент узнаёт',
  personas: ['client', 'owner', 'admin'],
  fids: ['F-05-024', 'F-05-061', 'F-00-101'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент записывается к Соне на завтра через приложение',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092'],
      expect: 'Запись создана, источник «приложение»',
      run: async (t) => {
        const r = await clientBook(t, { staffId: SONA, date: addDays(today(), 1) }).catch(() => clientBook(t, { staffId: SONA, date: addDays(today(), 2) }));
        t.state.booking = r.booking;
        t.note(`запись ${r.booking.id} ${r.booking.start}, статус ${r.booking.status}, источник ${r.booking.source}`);
      },
    },
    {
      id: 'S2',
      title: 'В «Журнале отправок» — сообщение клиенту о записи, пушем в приложение',
      persona: 'owner',
      area: 'notify',
      fids: ['F-05-024', 'F-05-025', 'F-05-130'],
      expect: '/biz/notifications/log → поиск по номеру: строка с датой и временем записи; канал «Пуш в приложение» (клиент в приложении; SMS и WhatsApp клиентам сняты)',
      needs: ['S1'],
      run: async (t) => {
        const b = t.state.booking;
        const rows = await logRows(t);
        const mine = rows.filter((r) => r.includes(ddmm(b.start.slice(0, 10))) && r.includes(hm(b.start)));
        t.note(`строк по номеру: ${rows.length}; про эту запись: ${mine.length} — «${(mine[0] ?? rows[0] ?? '').slice(0, 160)}»`);
        t.assert(mine.length, `в журнале отправок нет сообщения клиенту о записи на ${ddmm(b.start.slice(0, 10))} ${hm(b.start)}`);
        // q4: у строки появилась кнопка «Напомнить через WhatsApp» — канал смотрим без неё
        const paid = mine.find((r) => /SMS|WhatsApp/.test(r.replace(/Напомнить через WhatsApp/g, '')));
        t.assert(!paid, `клиенту с приложением сообщение ушло не пушем: «${(paid ?? '').slice(0, 120)}» (платные SMS/WhatsApp клиентам сняты — только пуш)`);
        // клиент записался из приложения — пуш ему доставляется; «Не доставлено» + «Напомнить через WhatsApp» — для клиентов без приложения (F-00-121)
        const undelivered = mine.find((r) => /Не доставлено/.test(r));
        t.assert(
          !undelivered,
          `пуш клиенту, который только что записался из приложения, помечен «Не доставлено» и предлагает «Напомнить через WhatsApp» (F-00-121 — только для клиентов без приложения): «${(undelivered ?? '').replace(/\s+/g, ' ').slice(0, 140)}»`,
        );
        t.state.logCountBefore = mine.length;
      },
    },
    {
      id: 'S3',
      title: 'В «Центре уведомлений» кабинета — «Новая онлайн-запись» с клиентом и временем',
      persona: 'owner',
      area: 'notify',
      fids: ['F-05-061'],
      expect: '/biz/notifications/inbox → «Записи»: «Новая онлайн-запись · Ани Мелкумян · завтра, ЧЧ:ММ · Сона Григорян»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('owner', '/biz/notifications/inbox', 'desktop');
        const txt = await t.mainText();
        const b = t.state.booking;
        const i = txt.indexOf('Новая онлайн-запись');
        t.assert(i >= 0, 'в центре уведомлений нет «Новая онлайн-запись»');
        t.assert(
          txt.includes(hm(b.start)) || txt.includes('Мелкумян'),
          `событие в центре уведомлений не говорит, какая запись: ни клиента, ни мастера, ни времени визита — только «${txt.slice(i, i + 50).replace(/\n+/g, ' · ')}» (время создания)`,
        );
      },
    },
    {
      id: 'S4',
      title: 'Администратор отменяет запись от лица салона',
      persona: 'admin',
      area: 'journal',
      fids: ['F-01-054'],
      expect: 'Окно записи → «Отменил мастер» → «Сохранить»; статус cancelled_by_master',
      needs: ['S1'],
      run: async (t) => {
        const upd = await setStatusInJournal(t, 'admin', t.state.booking, 'cancelled_by_master');
        t.note(`статус ${upd.status}; тосты «${upd.__ui.toasts.join(' / ')}»`);
        t.assert(upd.status === 'cancelled_by_master', `статус не сменился: ${upd.status}`);
      },
    },
    {
      id: 'S5',
      title: 'В «Журнале отправок» — сообщение клиенту об отмене',
      persona: 'owner',
      area: 'notify',
      fids: ['F-05-027', 'F-00-101'],
      expect: 'Новая строка по номеру клиента про эту запись — «запись отменена»',
      needs: ['S4'],
      run: async (t) => {
        const b = t.state.booking;
        const rows = await logRows(t);
        const mine = rows.filter((r) => r.includes(ddmm(b.start.slice(0, 10))) && r.includes(hm(b.start)));
        t.note(`про эту запись строк: было ${t.state.logCountBefore}, стало ${mine.length}; «${mine.map((r) => r.slice(0, 90)).join(' | ')}»`);
        t.assert(mine.length > t.state.logCountBefore || mine.some((r) => /отмен/i.test(r)), 'об отмене салоном клиенту ничего не ушло');
      },
    },
    {
      id: 'S6',
      title: 'В «Центре уведомлений» отмена видна как отмена, а не как новая запись',
      persona: 'owner',
      area: 'notify',
      fids: ['F-05-061'],
      expect: 'Событие «Запись отменена» (кто, когда), а не прежняя «Новая онлайн-запись»',
      needs: ['S4'],
      run: async (t) => {
        await t.go('owner', '/biz/notifications/inbox', 'desktop');
        const txt = await t.mainText();
        const b = t.state.booking;
        const around = txt.split('\n').filter((l) => /запис/i.test(l)).slice(0, 6).join(' · ');
        t.note(`строки центра: «${around.slice(0, 200)}»`);
        t.assert(/отмен/i.test(txt), `отмена в центре уведомлений не видна — запись ${hm(b.start)} по-прежнему «Новая онлайн-запись» (центр строит события из самих записей по source, а не из журнала событий ядра listBookingEvents)`);
      },
    },
    {
      id: 'S7',
      title: 'Клиент видит в «Уведомлениях» приложения, что салон отменил запись',
      persona: 'client',
      area: 'client',
      fids: ['F-00-101', 'F-14-055'],
      expect: '/notifications: «Салон отменил вашу запись … — выберите другое время»',
      needs: ['S4'],
      run: async (t) => {
        await t.go('client', '/notifications', 'phone');
        const txt = await t.mainText();
        t.assert(
          /отмен/i.test(txt) && txt.includes('Сона'),
          'журнал отправок кабинета пишет «доставлено» клиенту, а в приложении клиента уведомления об отмене нет — «Уведомления» клиента читают свой список в срезе client, а не события записи ядра',
        );
      },
    },
  ],
};
