// C26 · Мастер-индивидуал закрыл день (F-00-001, F-00-051, F-02-*): у клиента есть окна на этот день → мастер в
// «Графике работы» ставит «Нерабочий день» → у клиента окон на этот день нет ни в записи, ни в каталоге →
// в журнале мастера день нерабочий. График — раздел schedule, запись и каталог — client, журнал — journal.
import { Fail, addDays, today, weekdayIndex } from '../lib.mjs';
import { freeTimes } from '../helpers.mjs';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const label = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/** q4: клетки графика больше не подписаны датой («10–18» в колонке дня недели) — клетка = N-я кнопка строки мастера.
 *  Открывает /biz/schedule на нужной неделе и возвращает локатор клетки дня. */
async function dayCell(t, d) {
  await t.go('individual', '/biz/schedule', 'desktop');
  const sunday = addDays(today(), 6 - weekdayIndex(today()));
  if (d > sunday) await t.click('role=button[name="Следующий период"]', { after: 600 });
  const row = t.page.locator('table tbody tr', { has: t.page.locator('a[href^="/biz/staff/"]') }).first();
  return row.locator('button:not([aria-label])').nth(weekdayIndex(d));
}

export default {
  id: 'C26',
  title: 'Мастер-индивидуал закрыл день в графике → у клиента нет окон в этот день → журнал показывает выходной',
  personas: ['individual', 'client'],
  fids: ['F-00-001', 'F-00-051', 'F-02-014', 'F-02-032'],
  steps: [
    {
      id: 'S1',
      title: 'У клиента есть окна мастера на ближайший рабочий день этой недели',
      persona: 'client',
      area: 'client',
      fids: ['F-00-001', 'F-00-092'],
      expect: 'Запись к индивидуалу (персона individual) — в ближайший рабочий день после сегодня есть окна',
      run: async (t) => {
        await t.go('individual', '/biz/schedule', 'desktop');
        const db = await t.db();
        // персона individual = владелец бизнеса-индивидуала; мастер — владелец
        const cells = await t.page.locator('table tbody tr button:not([aria-label])').allInnerTexts();
        const staffLink = await t.page.locator('table a[href^="/biz/staff/"]').first().getAttribute('href').catch(() => null);
        const staffId = staffLink?.split('/').pop();
        if (!staffId) throw new Fail('в графике индивидуала нет строки мастера');
        t.state.staffId = staffId;
        t.state.staffName = db.core.staff.find((s) => s.id === staffId)?.name;
        for (let i = 1; i < 7 && !t.state.date; i++) {
          const d = addDays(today(), i);
          const cell = (await (await dayCell(t, d)).innerText().catch(() => '')).trim();
          if (!cell || !/\d/.test(cell)) continue;
          const times = await freeTimes(t, staffId, d);
          if (times.length) {
            t.state.date = d;
            t.state.timesBefore = times;
          }
          await t.go('individual', '/biz/schedule', 'desktop');
        }
        if (!t.state.date) throw new Fail(`у ${t.state.staffName} на этой неделе нет рабочего дня с окнами (${cells.join(' | ').slice(0, 200)})`);
        t.note(`${t.state.staffName} (${staffId}), ${t.state.date}: окна ${t.state.timesBefore.slice(0, 6).join(', ')}…`);
      },
    },
    {
      id: 'S2',
      title: 'Мастер ставит этот день «Нерабочим» в графике',
      persona: 'individual',
      area: 'schedule',
      fids: ['F-02-014', 'F-02-032'],
      expect: '/biz/schedule → клетка дня → окно дня: «Не работаю» → «Сохранить»; в клетке графика «—»',
      needs: ['S1'],
      run: async (t) => {
        // q4: клетка графика ведёт в «Мой календарь» — окно дня с «Работаю / Не работаю»
        await t.go('individual', `/biz/schedule/calendar?date=${t.state.date}`, 'desktop');
        const dlg = t.page.locator('[role="dialog"]').filter({ has: t.page.getByRole('radio', { name: 'Не работаю' }) }).last();
        await dlg.waitFor({ timeout: 15000 }).catch(() => {
          throw new Fail('окно дня («Работаю / Не работаю») не открылось');
        });
        const sheetTxt = await dlg.innerText();
        const recs = sheetTxt.match(/\d+ запис\S*/);
        if (recs) t.note(`в окне дня: «${recs[0]}»`);
        const off = dlg.getByRole('radio', { name: 'Не работаю' });
        await off.click({ timeout: 8000 }).catch(async () => {
          t.note('«Не работаю» не принимает обычный клик (перекрыт слоем) — нажата программно');
          await off.dispatchEvent('click');
        });
        await t.settle(300);
        const warn = (await dlg.innerText()).match(/В эти дни есть[^\n]*/);
        if (warn) t.note(`предупреждение: «${warn[0]}»`);
        // есть записи — главная кнопка «Сохранить всё равно» (записи не трогаются)
        const saveBtn = dlg.getByRole('button', { name: /^(Сохранить всё равно|Сохранить|Удалить)$/ }).last();
        await saveBtn.click({ timeout: 8000 }).catch(async () => {
          t.note('кнопка сохранения окна дня перекрыта слоем — нажата программно');
          await saveBtn.dispatchEvent('click');
        });
        await t.settle(900);
        // есть записи на этот день — окно показывает их («не будут удалены или перенесены») и ждёт второго нажатия
        const again = dlg.getByRole('button', { name: /^(Сохранить всё равно|Сохранить|Удалить)$/ });
        if ((await dlg.isVisible().catch(() => false)) && (await again.count())) {
          await again.last().click({ timeout: 8000 }).catch(() => again.last().dispatchEvent('click'));
          await t.settle(900);
        }
        await t.page.getByText(/изменено: \d|Добавлено дней|Сохранено/).first().waitFor({ timeout: 8000 }).catch(() => {});
        await t.settle(600);
        const confirm = t.page.locator('[role="alertdialog"]');
        if (await confirm.count()) {
          t.note(`подтверждение: «${(await confirm.last().innerText()).replace(/\n+/g, ' · ').slice(0, 140)}»`);
          await confirm.last().getByRole('button').last().click();
          await t.settle(800);
        }
        const cell = (await (await dayCell(t, t.state.date)).innerText()).replace(/\s+/g, ' ');
        t.note(`клетка после сохранения: «${cell}»; тост «${(await t.toasts()).join(' / ')}»`);
        t.assert(!/\d/.test(cell), `день остался рабочим: «${cell}»`);
      },
    },
    {
      id: 'S3',
      title: 'У клиента в записи на этот день окон нет',
      persona: 'client',
      area: 'client',
      fids: ['F-00-001'],
      expect: '/book к мастеру: день не предлагается или в нём нет окон',
      needs: ['S2'],
      run: async (t) => {
        const times = await freeTimes(t, t.state.staffId, t.state.date);
        t.assert(!times.length, `в нерабочий день клиенту всё ещё предлагаются окна: ${times.slice(0, 6).join(', ')}`);
      },
    },
    {
      id: 'S4',
      title: 'В карточке мастера и в каталоге окон на этот день нет',
      persona: 'client',
      area: 'client',
      fids: ['F-00-001', 'F-00-108'],
      expect: '/masters/<id>: ссылки-окна на этот день пропали',
      needs: ['S2'],
      run: async (t) => {
        await t.go('client', `/masters/${t.state.staffId}`, 'phone');
        const n = await t.page.locator(`a[href*="slot=${t.state.date}"]`).count();
        t.assert(n === 0, `в карточке мастера ещё ${n} окон на закрытый день`);
      },
    },
    {
      id: 'S5',
      title: 'В журнале мастера этот день — нерабочий',
      persona: 'individual',
      area: 'journal',
      fids: ['F-01-001'],
      expect: '/biz/journal?date=<день>: колонка мастера без рабочих часов (серое / «не работает»)',
      needs: ['S2'],
      run: async (t) => {
        await t.go('individual', `/biz/journal?date=${t.state.date}`, 'desktop');
        const txt = await t.mainText();
        t.note(`журнал: «${txt.replace(/\n+/g, ' · ').slice(0, 160)}»`);
        t.assert(/не работает|выходн|нерабоч|нет графика|Расписание не установлено/i.test(txt), 'журнал не показывает, что день нерабочий — можно записать клиента на закрытый день без предупреждения');
      },
    },
    {
      id: 'S6',
      title: 'Записи, которые уже были на этот день, не пропали из журнала',
      persona: 'individual',
      area: 'journal',
      fids: ['F-01-001', 'F-02-032'],
      expect: 'Окно правки предупредило «уже есть N записей — они не будут удалены»; в журнале эти записи видны (с пометкой «вне графика»), чтобы мастер их перенёс или предупредил клиентов',
      needs: ['S2'],
      run: async (t) => {
        const db = await t.db();
        const left = db.core.bookings.filter(
          (b) => b.staffId === t.state.staffId && b.start.startsWith(t.state.date) && !b.deletedAt && !/cancel|no_show/.test(b.status),
        );
        await t.go('individual', `/biz/journal?date=${t.state.date}`, 'desktop');
        const blocks = await t.page.locator('[data-testid="booking-block"]').count();
        t.note(`активных записей на закрытый день в базе: ${left.length} (${left.map((b) => b.start.slice(11)).join(', ')}); блоков в журнале: ${blocks}`);
        t.assert(
          !left.length || blocks >= left.length,
          `на закрытый день осталось ${left.length} записей клиентов, а журнал показывает «Расписание не установлено» и ни одной из них — клиенты придут, а мастер их не видит`,
        );
      },
    },
  ],
};
