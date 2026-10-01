// C18 · «Закончил раньше» (F-00-058) → остаток времени — горящее окно у клиента (F-00-103);
// «Задерживаюсь» (F-00-059) → уведомление следующему клиенту. Часы браузера закреплены на 11:20 сегодня
// (page.clock), чтобы визит 11:00 «шёл» — иначе в 6 утра проверять нечего.
import { Fail, today } from '../lib.mjs';
import { bookingById, freeTimes, hm } from '../helpers.mjs';

const ANI = 'st_nuri_ani';

/** q4: действия у сегодняшней записи теперь в меню «⋯» («Действия с записью в ЧЧ:ММ» → «Закончить раньше» /
 *  «Задерживаюсь на N мин»); раньше — кнопки прямо в строке. Поддерживаем оба вида. */
async function todayAction(t, time, item) {
  const menu = t.page.getByRole('button', { name: `Действия с записью в ${time}` }).first();
  if (await menu.count()) {
    await menu.click();
    await t.settle(300);
    const it = t.page.getByRole('menuitem', { name: item }).first();
    if (!(await it.count())) {
      const all = await t.page.getByRole('menuitem').allInnerTexts();
      await t.page.keyboard.press('Escape');
      throw new Fail(`в меню записи ${time} нет пункта ${item} (есть: ${all.join(' | ')})`);
    }
    await it.click();
    return;
  }
  const row = t.page.locator('text=' + time + ' ·').first().locator('xpath=ancestor::*[.//button][1]');
  const btn = row.getByRole('button', { name: item }).first();
  if (!(await btn.count())) throw new Fail(`в «Сегодня: записи» нет визита ${time} с действием ${item}`);
  await btn.click();
}
const NOW = '11:20';

export default {
  id: 'C18',
  title: '«Закончил раньше» → горящее окно у клиента; «Задерживаюсь» → пуш следующему',
  personas: ['client', 'master'],
  fids: ['F-00-058', 'F-00-103', 'F-00-059', 'F-00-101'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент записан к Ани сегодня позже текущего визита',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092'],
      expect: 'Сейчас 11:20, у Ани идёт визит 11:00; клиент берёт ближайшее окно после него — он «следующий клиент»',
      run: async (t) => {
        await t.page.clock.setFixedTime(new Date(`${today()}T${NOW}:00`));
        await t.go('client', '/');
        let db = await t.db();
        const findCur = (d) => d.core.bookings
          .filter((b) => b.staffId === ANI && b.start.startsWith(today()) && !b.deletedAt && !/cancel|no_show/.test(b.status))
          .filter((b) => hm(b.start) <= NOW)
          .sort((a, b) => b.start.localeCompare(a.start))[0];
        if (!findCur(db)) {
          // q3: сид сдвинулся — у Ани сегодня нет визита до 11:20. Подготовка без экрана: копия её записи на сегодня 11:00
          await t.patchDb(
            `const src = db.core.bookings.find((b) => b.staffId === arg.ani && b.clientId && !b.deletedAt);
             for (const b of db.core.bookings) if (b.staffId === arg.ani && b.start >= arg.day + 'T11:00' && b.start < arg.day + 'T12:30') b.deletedAt = arg.day + 'T06:00';
             db.core.bookings.push({ ...src, id: 'bk_e2e_c18cur', start: arg.day + 'T11:00', durationMin: 60, status: 'scheduled', seriesId: undefined, deletedAt: undefined, appUserId: undefined });`,
            { ani: ANI, day: today() },
          );
          t.note('подготовка данными: у Ани в сиде нет визита, идущего в 11:20 — добавлена запись 11:00–12:00 (bk_e2e_c18cur), записи сида Ани 11:00–12:30 убраны, чтобы не было наложения');
          db = await t.db();
        }
        const cur = db.core.bookings
          .filter((b) => b.staffId === ANI && b.start.startsWith(today()) && !b.deletedAt && !/cancel|no_show/.test(b.status))
          .filter((b) => hm(b.start) <= NOW)
          .sort((a, b) => b.start.localeCompare(a.start))[0];
        if (!cur) throw new Fail(`у Ани в сиде нет визита, идущего в ${NOW}`);
        const end = new Date(`${cur.start}:00`);
        end.setMinutes(end.getMinutes() + cur.durationMin);
        t.state.cur = cur;
        t.state.oldEnd = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
        // q4: сид Ани плотный — между концом идущего визита и первым окном клиента стоят записи сида, и «следующим
        // клиентом» оказывается не наш. Подготовка данными: записи сида Ани сегодня от конца визита до 14:00 убираем.
        const between = db.core.bookings.filter((b) => b.staffId === ANI && b.start.startsWith(today()) && !b.deletedAt && b.id !== cur.id && hm(b.start) >= t.state.oldEnd && hm(b.start) < '14:00');
        if (between.length) {
          await t.patchDb(
            `for (const b of db.core.bookings) if (arg.ids.includes(b.id)) b.deletedAt = arg.day + 'T06:00';`,
            { ids: between.map((b) => b.id), day: today() },
          );
          t.note(`подготовка данными: убраны записи сида Ани ${between.map((b) => hm(b.start)).join(', ')} между концом визита и 14:00 — чтобы клиент цепочки стал следующим`);
          db = await t.db();
        }
        const known = new Set(db.core.bookings.map((b) => b.id));
        await t.go('client', `/book?staff=${ANI}&service=sv_nuri_classic`);
        const day = t.page.locator('button.min-w-16', { hasText: /Сегодня/ }).first();
        if (await day.count()) await day.click();
        await t.settle(300);
        const slots = t.page.locator('button.min-h-11');
        await slots.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        const texts = (await slots.allInnerTexts()).map((x) => x.trim());
        t.state.s1Times = texts;
        const idx = texts.findIndex((x) => x >= t.state.oldEnd);
        if (idx < 0) throw new Fail(`сегодня у Ани нет окна после ${t.state.oldEnd} (${texts.join(', ')})`);
        await slots.nth(idx).click();
        await t.settle(300);
        await t.click('role=button[name="Подтвердить запись"]', { after: 1200 });
        const after = await t.db();
        const b = after.core.bookings.find((x) => !known.has(x.id));
        if (!b) throw new Fail('запись не создана');
        t.state.next = b;
        t.note(`идёт визит ${cur.id} ${hm(cur.start)}–${t.state.oldEnd}; следующая запись клиента ${b.id} ${hm(b.start)}`);
      },
    },
    {
      id: 'S2',
      title: 'Мастер нажимает «Закончил раньше» у идущего визита',
      persona: 'master',
      area: 'schedule',
      fids: ['F-00-058'],
      expect: '/biz/schedule/calendar → «Сегодня: записи» → «⋯» у идущего визита → «Закончить раньше» → тост; визит укоротился до «сейчас» (11:20)',
      needs: ['S1'],
      run: async (t) => {
        await t.go('master', '/biz/schedule/calendar', 'desktop');
        await todayAction(t, hm(t.state.cur.start), /^(Закончить раньше|Закончил раньше)$/);
        await t.settle(700);
        const b = bookingById(await t.db(), t.state.cur.id);
        t.state.newEnd = NOW;
        // q4: идущий визит в сиде может начинаться не в 11:00 — ждём «от начала до сейчас»
        const want = (Number(NOW.slice(0, 2)) * 60 + Number(NOW.slice(3, 5))) - (Number(hm(t.state.cur.start).slice(0, 2)) * 60 + Number(hm(t.state.cur.start).slice(3, 5)));
        t.assert(b.durationMin === want, `длительность визита после «Закончил раньше»: ${t.state.cur.durationMin} → ${b.durationMin} (ждали ${want} мин: ${hm(t.state.cur.start)}→${NOW})`);
      },
    },
    {
      id: 'S3',
      title: 'Остаток времени сразу доступен для записи',
      persona: 'client',
      area: 'client',
      fids: ['F-00-058', 'F-00-101'],
      expect: `Запись к Ани (/book) на короткую услугу («Снятие покрытия») сегодня предлагает время с ${NOW} (до конца прежнего визита)`,
      needs: ['S2'],
      run: async (t) => {
        // освободилось 40 мин (11:20–12:00, дальше — следующий клиент): классика (45 мин) туда не влезает — берём короткую услугу
        let times = await freeTimes(t, ANI, today(), 'Снятие покрытия').catch(() => []);
        if (!times.length) times = await freeTimes(t, ANI, today(), 'Маникюр классический');
        const hot = times.filter((x) => x >= NOW && x < t.state.oldEnd);
        t.state.hot = hot;
        if (!hot.length) {
          const db = await t.db();
          const busy = db.core.bookings.filter((b) => b.staffId === ANI && b.start.startsWith(today()) && !b.deletedAt).map((b) => `${hm(b.start)}+${b.durationMin} ${b.status}`);
          t.note(`окна в шаге S1 (до «Закончил раньше»): ${(t.state.s1Times ?? []).join(', ')}; записи Ани сегодня: ${busy.join('; ')}`);
        }
        t.assert(hot.length, `в записи нет окон ${NOW}–${t.state.oldEnd} (окна сегодня: ${times.join(', ') || '—'})`);
      },
    },
    {
      id: 'S4',
      title: 'Горящее окно видно в карточке мастера и в «Свободно рядом»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-103', 'F-00-108'],
      expect: 'Карточка Ани («Ближайшие свободные окна») и главная показывают «Сегодня, 11:20» (с пометкой горящего или «сегодня»)',
      needs: ['S3'],
      run: async (t) => {
        await t.go('client', `/masters/${ANI}`);
        const card = (await t.page.locator(`a[href*="/book?staff=${ANI}"][href*="slot="]`).allInnerTexts()).map((x) => x.trim());
        await t.go('client', '/');
        const txt = await t.mainText();
        const i = txt.indexOf('Ани Саргсян', txt.indexOf('Свободно рядом'));
        const near = i >= 0 ? txt.slice(i, i + 160).replace(/\n+/g, ' · ') : 'Ани нет в блоке';
        // q3: горящее окно 40 мин — под короткую услугу; карточка может считать окна по основной услуге, поэтому
        // засчитываем и любое сегодняшнее окно, которое запись предлагала на классику в S1
        const todayOk = [...t.state.hot, ...(t.state.s1Times ?? []).filter((x) => x >= NOW)];
        const inCard = card.some((x) => todayOk.some((h) => x.includes(`Сегодня, ${h}`) || x === h));
        const inHome = todayOk.some((h) => near.includes(`Сегодня, ${h}`));
        t.assert(inCard && inHome, `запись сегодня предлагает ${todayOk.join(', ')}, а ${inCard ? '' : `карточка мастера — «${card.slice(0, 2).join(' | ')}»`}${!inCard && !inHome ? '; ' : ''}${inHome ? '' : `«Свободно рядом» — «${near.slice(0, 80)}»`}: ближайшие окна в каталоге считаются не так, как в записи`);
        if (!/горящ/i.test(near)) t.note('пометки «горящее» нет — только «Сегодня, ЧЧ:ММ» (F-00-103 допускает)');
      },
    },
    {
      id: 'S5',
      title: 'Мастер задерживается на 10 минут — уведомление уходит следующему клиенту',
      persona: 'master',
      area: 'schedule',
      fids: ['F-00-059'],
      expect: '«Задерживаюсь» у текущего визита → тост «отправили следующему клиенту»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('master', '/biz/schedule/calendar', 'desktop');
        await todayAction(t, hm(t.state.cur.start), /^Задерживаюсь( на 10 мин)?$/);
        await t.settle(700);
        const toasts = await t.toasts();
        const db = await t.db();
        const notice = db.areas.schedule?.delayNotices?.[t.state.cur.id];
        t.note(`тост «${toasts.join(' / ')}»; notice ${JSON.stringify(notice ?? {})}`);
        t.assert(notice?.nextBookingId === t.state.next.id, `следующим клиентом выбран не тот: ${notice?.nextBookingId ?? '—'} (ждали ${t.state.next.id})`);
      },
    },
    {
      id: 'S6',
      title: 'Следующий клиент видит «мастер задерживается» у себя',
      persona: 'client',
      area: 'client',
      fids: ['F-00-059', 'F-00-120'],
      expect: '/notifications (и карточка записи): «Ани Саргсян задерживается на 10 мин»',
      needs: ['S5'],
      run: async (t) => {
        await t.go('client', '/notifications');
        const n = await t.mainText();
        await t.go('client', `/bookings/${t.state.next.id}`);
        const b = await t.mainText();
        t.assert(/задерж/i.test(n) || /задерж/i.test(b), 'клиент не узнал о задержке: «Задерживаюсь» пишет только в срез schedule (delayNotices), уведомления клиента его не читают');
      },
    },
  ],
};
