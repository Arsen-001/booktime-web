// C28 · Оплата визита из журнала доходит до финансов (F-00-127, F-00-194, F-01-083, F-01-011, F-07-045).
// q4: раздел finance построен (операции, кассы, статьи; в сиде — «Оплата услуг · Визит» по прошлым визитам),
// а кнопка «Оплатить» окна записи (journal) пишет только journal.extras.paidAmount. Цепочка: визит «пришёл» →
// «Оплатить» в окне → окно показывает «оплачено» → операция «Оплата услуг» с клиентом и суммой в /biz/finance →
// сводка дня журнала и финансы называют одну и ту же выручку дня.
import { Fail, today } from '../lib.mjs';
import { openInJournal, setStatusInJournal } from '../helpers.mjs';

const NURI = 'biz_nuri';

function moneyNum(s) {
  const m = String(s ?? '').match(/-?\d[\d\s  ]*/);
  return m ? Number(m[0].replace(/[^\d-]/g, '')) : undefined;
}

/** Приход finance за день по операциям бизнеса (то же, что getDayCashSummary) */
function financeIncome(db, date) {
  const F = db.areas.finance ?? {};
  const accs = new Set((F.accounts ?? []).filter((a) => a.businessId === NURI).map((a) => a.id));
  return (F.operations ?? [])
    .filter((o) => accs.has(o.accountId) && !o.cancelled && o.kind === 'income' && String(o.date).slice(0, 10) === date)
    .reduce((s, o) => s + o.amount, 0);
}

export default {
  id: 'C28',
  title: 'Оплата визита в окне записи → «оплачено» в окне → операция в финансах → сводка дня журнала = финансы',
  personas: ['admin', 'owner'],
  fids: ['F-00-127', 'F-00-194', 'F-01-083', 'F-01-011', 'F-07-045'],
  steps: [
    {
      id: 'S1',
      title: 'Администратор отмечает «Пришёл» у сегодняшней неоплаченной записи',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-127'],
      expect: 'Сегодняшняя запись Nuri «Записан / Клиент подтвердил» с услугой → «Пришёл» → «Сохранить»; статус arrived',
      run: async (t) => {
        const db = await t.db();
        const d = today();
        const cands = db.core.bookings.filter(
          (b) => b.businessId === NURI && b.start.startsWith(d) && !b.deletedAt && /^(scheduled|client_confirmed)$/.test(b.status) && b.total > 0 && b.clientId,
        );
        if (!cands.length) throw new Fail('в сиде нет сегодняшней записи Nuri «Записан» с услугой');
        const b = cands[0];
        t.state.booking = b;
        t.state.client = db.core.clients.find((c) => c.id === b.clientId);
        t.state.incomeBefore = financeIncome(db, d);
        t.state.opsBefore = (db.areas.finance?.operations ?? []).length;
        const upd = await setStatusInJournal(t, 'admin', b, 'arrived');
        t.note(`запись ${b.id} ${b.start.slice(11, 16)}, ${b.total} ֏, клиент «${t.state.client?.name}»; приход finance за день до оплаты ${t.state.incomeBefore} ֏`);
        t.assert(upd.status === 'arrived', `статус не «пришёл»: ${upd.status} (${upd.__ui.toasts.join(' / ')})`);
      },
    },
    {
      id: 'S2',
      title: '«Оплатить» в окне записи: способ оплаты и сумма',
      persona: 'admin',
      area: 'finance',
      fids: ['F-00-194', 'F-01-083'],
      expect: '«Оплатить» → выбор «Наличные / Карта / Перевод», сумма визита → провести; тост',
      needs: ['S1'],
      run: async (t) => {
        const dlg = await openInJournal(t, 'admin', t.state.booking);
        const pay = dlg.getByRole('button', { name: /^Оплатить/ }).first();
        if (!(await pay.count())) t.fail('в окне записи после «Пришёл» нет кнопки «Оплатить»');
        await pay.click();
        await t.settle(800);
        const top = t.page.locator('[role="dialog"], [role="alertdialog"]').last();
        const txt = (await top.innerText().catch(() => '')).replace(/\n+/g, ' · ');
        const cash = top.getByRole('button', { name: /Наличн/ }).first();
        t.state.askedMethod = (await cash.count()) > 0;
        if (t.state.askedMethod) {
          await cash.click();
          await t.settle(300);
          const confirm = top.getByRole('button', { name: /^(Оплатить|Провести|Принять|Сохранить)/ }).last();
          if (await confirm.count()) await confirm.click();
          await t.settle(900);
        }
        t.state.toasts = await t.toasts();
        const db = await t.db();
        t.state.extras = db.areas.journal?.extras?.[t.state.booking.id] ?? db.areas.journal?.bookingExtras?.[t.state.booking.id];
        t.note(`тост «${t.state.toasts.join(' / ') || '—'}»; journal.extras.paidAmount = ${t.state.extras?.paidAmount ?? '—'}`);
        if (!t.state.askedMethod) t.fail(`«Оплатить» проводит оплату одним нажатием, не спросив способ (наличные / карта / перевод — F-00-194); после нажатия окно: «${txt.slice(0, 120)}»`);
      },
    },
    {
      id: 'S3',
      title: 'Окно записи после оплаты говорит «оплачено»',
      persona: 'admin',
      area: 'journal',
      fids: ['F-01-083', 'F-07-045'],
      expect: 'Повторно открытое окно: «К оплате 0 ֏» (или «Оплачено N ֏»), «Статус визита: оплачено», кнопки «Оплатить» нет',
      needs: ['S1'],
      run: async (t) => {
        const dlg = await openInJournal(t, 'admin', t.state.booking);
        const txt = (await dlg.innerText()).replace(/\n+/g, ' · ');
        const i = txt.indexOf('К оплате');
        if (i < 0 && !/Статус визита/.test(txt)) throw new Fail(`окно записи не отрисовалось: «${txt.slice(0, 120)}»`);
        const due = i >= 0 ? moneyNum(txt.slice(i + 8, i + 40)) : undefined;
        const unpaid = /Посещение не оплачено/.test(txt);
        t.note(`окно: «К оплате» ${due ?? '—'} ֏; «${(txt.match(/Статус визита:[^·]*/) ?? [''])[0].trim()}»`);
        t.assert(
          !unpaid && (due === undefined || due === 0),
          `после «Оплатить» (тост «${(t.state.toasts ?? []).join(' / ') || '—'}») окно по-прежнему: «К оплате ${due} ֏ · Оплатить», «Статус визита: Посещение не оплачено» — не видно, что оплата прошла; можно нажать «Оплатить» второй раз`,
        );
      },
    },
    {
      id: 'S4',
      title: 'Оплата визита появилась в финансовых операциях',
      persona: 'owner',
      area: 'finance',
      fids: ['F-00-194', 'F-07-001', 'F-07-045'],
      expect: '/biz/finance: новая строка сегодня «Оплата услуг · Визит · Основная касса · Наличные · <клиент> · +сумма визита» (операция с refId записи)',
      needs: ['S1'],
      run: async (t) => {
        await t.openOrWait('owner', '/biz/finance', 'finance');
        const db = await t.db();
        const b = t.state.booking;
        const ops = (db.areas.finance?.operations ?? []).filter((o) => o.refId === b.id && !o.cancelled);
        const txt = await t.mainText();
        const name = t.state.client?.name ?? '';
        t.note(`операций finance с refId ${b.id}: ${ops.length}; всего операций было ${t.state.opsBefore}, стало ${(db.areas.finance?.operations ?? []).length}; «${name}» на экране: ${txt.includes(name) ? 'да' : 'нет'}`);
        t.assert(
          ops.length && ops.some((o) => o.amount === b.total),
          `оплаты визита ${b.id} (${b.total} ֏, «${name}») в финансах нет — «Оплатить» журнала пишет только journal.extras.paidAmount (${t.state.extras?.paidAmount ?? '—'}), операцию finance (recordOperation, статья «Оплата услуг», refId записи) никто не создаёт; касса и отчёты этих денег не увидят`,
        );
      },
    },
    {
      id: 'S5',
      title: 'Сводка дня в журнале и финансы называют одну выручку',
      persona: 'admin',
      area: 'journal',
      fids: ['F-01-011', 'F-07-045'],
      expect: 'Кнопка сводки дня журнала («N ֏ ▾») = приход finance за сегодня (getDayCashSummary)',
      needs: ['S1'],
      run: async (t) => {
        await t.go('admin', '/biz/journal', 'desktop');
        const btn = t.page.locator('[data-f~="F-01-011"]').filter({ visible: true }).first();
        if (!(await btn.count())) t.fail('в шапке журнала нет сводки дня (F-01-011)');
        const shown = moneyNum(await btn.innerText());
        const db = await t.db();
        const fin = financeIncome(db, today());
        t.note(`журнал: ${shown} ֏; finance за сегодня: ${fin} ֏ (до оплаты было ${t.state.incomeBefore} ֏)`);
        t.assert(
          shown === fin,
          `выручка дня в двух местах разная: сводка журнала ${shown} ֏ (считает journal.extras.paidAmount), финансы за тот же день ${fin} ֏ (операции касс) — два источника правды для «сколько в кассе»`,
        );
      },
    },
  ],
};
