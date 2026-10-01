// C14 · Мастер отмечает «занято» в своём календаре за 1–2 нажатия → окно пропадает у клиента сразу
// (F-00-001 «главный риск — устаревшее расписание», F-00-051, F-00-054).
import { Fail, today, addDays, weekdayIndex } from '../lib.mjs';
import { freeTimes } from '../helpers.mjs';

const ANI = 'st_nuri_ani';

function dayHeading(date) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${Number(date.slice(8, 10))} ${months[Number(date.slice(5, 7)) - 1]}`;
}

export default {
  id: 'C14',
  title: 'Мастер отметил «занято» в календаре → окно исчезло у клиента',
  personas: ['client', 'master'],
  fids: ['F-00-001', 'F-00-051', 'F-00-054'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент видит у Ани свободное время на ближайший будний день (салон)',
      persona: 'client',
      area: 'client',
      fids: ['F-00-108'],
      expect: 'Список окон на день D',
      run: async (t) => {
        for (let i = 0; i < 7; i++) {
          const d = addDays(today(), i);
          const times = await freeTimes(t, ANI, d, 'Маникюр классический');
          if (times.length >= 2 && d !== today() && weekdayIndex(d) < 5) {
            t.state.date = d;
            t.state.time = times[0];
            t.note(`день ${d}, первое окно ${times[0]} (из ${times.length})`);
            return;
          }
        }
        throw new Fail('у Ани нет окон на неделю вперёд');
      },
    },
    {
      id: 'S2',
      title: 'Мастер в «Мой календарь» отмечает это время занятым',
      persona: 'master',
      area: 'schedule',
      fids: ['F-00-051', 'F-00-054'],
      expect: '«Мой календарь» → окно дня → «Занятое время: С / До» → «Отметить занятым» → «Сохранить»; отметка сохранена',
      needs: ['S1'],
      run: async (t) => {
        // q4: календарь мастера — окно дня по адресу ?date= («Работаю / Не работаю», рабочее время, «Занятое время: С / До»)
        await t.go('master', `/biz/schedule/calendar?date=${t.state.date}`, 'desktop');
        const card = t.page.locator('[role="dialog"]').filter({ hasText: 'Занятое время' }).last();
        await card.waitFor({ timeout: 15000 }).catch(() => {
          throw new Fail(`окно дня ${t.state.date} не открылось в «Мой календарь»`);
        });
        const pickers = card.locator('button[aria-haspopup="listbox"]');
        const n = await pickers.count();
        if (n < 2) throw new Fail(`у дня нет полей «С / До» для отметки (${n})`);
        const [h, m] = t.state.time.split(':').map(Number);
        const to = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        t.state.to = to;
        await pickers.nth(n - 2).click();
        await t.page.getByRole('option', { name: t.state.time, exact: true }).first().click();
        await t.settle(200);
        await pickers.nth(n - 1).click();
        await t.page.getByRole('option', { name: to, exact: true }).first().click();
        await t.settle(200);
        await card.getByRole('button', { name: /^Отметить занят/ }).click();
        await t.settle(500);
        const save = card.getByRole('button', { name: 'Сохранить' });
        if (await save.count()) await save.click().catch(() => {});
        await t.settle(700);
        const db = await t.db();
        const mark = db.core.calendarMarks.find((mk) => mk.staffId === ANI && mk.date === t.state.date && mk.kind === 'busy' && mk.from === t.state.time);
        t.assert(mark, `отметка «занято» ${t.state.time}–${to} на ${t.state.date} не сохранилась`);
      },
    },
    {
      id: 'S3',
      title: 'У клиента это окно пропало',
      persona: 'client',
      area: 'client',
      fids: ['F-00-001'],
      expect: 'В записи к Ани на день D нет отмеченного времени',
      needs: ['S2'],
      run: async (t) => {
        const times = await freeTimes(t, ANI, t.state.date, 'Маникюр классический');
        t.assert(!times.includes(t.state.time), `окно ${t.state.time} по-прежнему предлагается клиенту`);
      },
    },
    {
      id: 'S4',
      title: 'В журнале салона отметка мастера видна как занятое время',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-051', 'F-00-001'],
      expect: 'Админ видит, что мастер закрыл это время (серый блок «занято»), и не ставит туда запись',
      needs: ['S2'],
      run: async (t) => {
        await t.go('admin', `/biz/journal?date=${t.state.date}`, 'desktop');
        const txt = await t.mainText();
        t.assert(/[Зз]анято/.test(txt), 'отметки мастера «занято» в журнале не видно — админ может записать клиента на закрытое время');
      },
    },
  ],
};
