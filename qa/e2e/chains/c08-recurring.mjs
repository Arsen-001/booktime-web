// C08 · Повторяющиеся записи (F-00-064, F-01-100): администратор делает из записи клиента серию «еженедельно» →
// серия видна в журнале и у клиента в «Мои записи» → клиент снимает одну запись серии, остальные остаются;
// попадание на выходной — перенос и уведомление (ждёт).
import { Fail, today } from '../lib.mjs';
import { bookingById, openInJournal } from '../helpers.mjs';

const SOURCE = 'bk_0081'; // сид: Ани Мелкумян (au_01) → Ани Саргсян, гель-лак, будущая запись

export default {
  id: 'C08',
  title: 'Повторяющиеся записи: серия в журнале → у клиента → клиент снимает одну запись серии',
  personas: ['admin', 'client'],
  fids: ['F-00-064', 'F-01-100'],
  steps: [
    {
      id: 'S1',
      title: 'Администратор делает из записи клиента серию «еженедельно, 4 раза»',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-064', 'F-01-100'],
      expect: 'Окно записи → «Повторение записи» → «Еженедельно» → «Создать повторения»; в базе появились записи с общим seriesId, тот же мастер, время и клиент',
      run: async (t) => {
        await t.go('admin', '/biz/journal', 'desktop');
        const db0 = await t.db();
        const src = bookingById(db0, SOURCE);
        if (!src || src.start < `${today()}T00:00`) throw new Fail(`в сиде нет будущей записи ${SOURCE} клиента au_01`);
        t.state.src = src;
        const known = new Set(db0.core.bookings.map((b) => b.id));
        const dlg = await openInJournal(t, 'admin', src);
        await dlg.getByRole('button', { name: 'Повторение записи' }).click();
        await t.settle(400);
        const txt = await dlg.innerText();
        if (!/Создать повторения/.test(txt)) t.wait('journal', 'в окне записи нет «Создать повторения»');
        await dlg.getByRole('button', { name: 'Создать повторения' }).click();
        // q4: повторы создаются «в фоновом режиме» — даём им лечь в базу
        await t.settle(2500);
        const toasts = await t.toasts();
        const db = await t.db();
        const created = db.core.bookings.filter((b) => !known.has(b.id));
        t.note(`создано ${created.length}: ${created.map((b) => b.start).join(', ')}; тост «${toasts.join(' / ')}»`);
        t.assert(created.length >= 1, `повторения не созданы (новых записей ${created.length}; тост «${toasts.join(' / ') || '—'}»)`);
        const sid = created[0].seriesId;
        t.state.series = created;
        t.state.seriesId = sid;
        const bad = [];
        if (!sid || created.some((b) => b.seriesId !== sid)) bad.push('нет общего seriesId');
        if (created.some((b) => b.staffId !== src.staffId)) bad.push('другой мастер');
        if (created.some((b) => b.start.slice(11) !== src.start.slice(11))) bad.push('другое время');
        if (created.some((b) => b.clientId !== src.clientId)) bad.push(`без клиента (clientId ${created.map((b) => b.clientId ?? '—').join(',')})`);
        if (created.some((b) => !b.services?.length)) bad.push('без услуги');
        t.assert(!bad.length, `серия создана не как копия записи: ${bad.join('; ')}`);
      },
    },
    {
      id: 'S2',
      title: 'Запись серии в журнале помечена как часть серии',
      persona: 'admin',
      area: 'journal',
      fids: ['F-01-100'],
      expect: 'Окно записи серии говорит «повторяющаяся / часть серии», можно изменить или удалить всю серию',
      needs: ['S1'],
      run: async (t) => {
        const b = t.state.series[t.state.series.length - 1];
        const dlg = await openInJournal(t, 'admin', b);
        const txt = await dlg.innerText();
        t.assert(/сери|повтор/i.test(txt.replace(/Повторение записи/g, '')), 'в окне записи серии нет пометки «часть серии» — не отличить от обычной записи');
      },
    },
    {
      id: 'S3',
      title: 'Клиент видит записи серии в «Мои записи»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-064', 'F-00-092'],
      expect: 'Повторы, внесённые салоном на карточку клиента приложения, видны ему в «Предстоящих» (appUserId перенесён с исходной записи)',
      needs: ['S1'],
      run: async (t) => {
        const db = await t.db();
        const mine = t.state.series.filter((b) => bookingById(db, b.id)?.appUserId === 'au_01');
        await t.go('client', '/bookings');
        const links = await t.page.locator(`main a[href^="/bookings/"]`).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
        const shown = t.state.series.filter((b) => links.includes(`/bookings/${b.id}`));
        t.state.clientSeries = shown;
        t.assert(shown.length === t.state.series.length, `у клиента видно ${shown.length} из ${t.state.series.length} записей серии (appUserId у повторов: ${mine.length} из ${t.state.series.length}) — повторы потеряли связь с приложением`);
      },
    },
    {
      id: 'S4',
      title: 'Клиент «в этот раз не смогу» снимает одну запись серии, остальные остаются',
      persona: 'client',
      area: 'client',
      fids: ['F-00-064', 'F-00-098'],
      expect: 'Отмена одной записи серии не трогает остальные',
      needs: ['S3'],
      run: async (t) => {
        const target = t.state.clientSeries[0];
        const db = await t.db();
        await t.go('client', `/bookings/${target.id}`);
        await t.click('role=button[name="Отменить запись"]', { after: 400 });
        await t.clickInDialog(/^(Да, отменить|Отменить запись)$/, { after: 900 });
        const after = await t.db();
        t.assert(/cancel/.test(bookingById(after, target.id).status), `запись серии не отменилась: ${bookingById(after, target.id).status}`);
        const rest = t.state.series.filter((b) => b.id !== target.id);
        const changed = rest.filter((b) => bookingById(after, b.id).status !== bookingById(db, b.id).status);
        t.assert(!changed.length, `отмена одной записи серии изменила ещё ${changed.length}`);
      },
    },
    {
      id: 'S5',
      title: 'Запись серии, попавшая на выходной, переезжает на ближайшее свободное; оба получают уведомление',
      persona: 'admin',
      area: 'schedule',
      fids: ['F-00-064'],
      expect: 'Сделать день выходным в графике → запись серии переехала, уведомления мастеру и клиенту',
      pending: 'schedule',
      pendingWhy: 'перенос серии при выходном — schedule (выходной) + journal (серия) + notify (уведомление); правила «куда переезжает» нет ни в одном разделе',
    },
  ],
};
