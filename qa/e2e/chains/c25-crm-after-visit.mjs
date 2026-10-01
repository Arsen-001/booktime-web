// C25 · Визит клиента приложения в карточке CRM (F-00-127, F-00-128, F-04-*): клиент записался → «пришёл» в
// журнале → карточка клиента: «Продано» выросло на сумму визита, визит в «Истории визитов» с услугой и мастером →
// оплата в окне записи → «Оплачено» и баланс в карточке → то же «оплачено» видит клиент в приложении.
// Карточка — раздел clients, окно записи — journal, деньги — finance, приложение — client.
import { Fail, addDays, today } from '../lib.mjs';
import { clientBook, freeTimes, openInJournal, setStatusInJournal } from '../helpers.mjs';

const SONA = 'st_nuri_sona';

function moneyAfter(txt, label) {
  const i = txt.indexOf(label);
  if (i < 0) return undefined;
  const m = txt.slice(i + label.length, i + label.length + 40).match(/-?\s*−?\s*\d[\d\s  ]*/);
  return m ? Number(m[0].replace(/[^\d-−]/g, '').replace('−', '-')) : undefined;
}

async function card(t, clientId) {
  await t.go('admin', `/biz/clients/${clientId}`, 'desktop');
  await t.page.getByText('Продано').first().waitFor({ timeout: 20000 }).catch(() => {});
  const txt = await t.mainText();
  return { txt, sold: moneyAfter(txt, 'Продано'), paid: moneyAfter(txt, 'Оплачено'), balance: moneyAfter(txt, 'Баланс') };
}

export default {
  id: 'C25',
  title: 'Визит из приложения → «пришёл» → карточка CRM: продано, история визитов, оплачено → то же у клиента',
  personas: ['client', 'admin'],
  fids: ['F-00-127', 'F-00-128', 'F-04-001'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент записывается к Соне через приложение (сегодня или завтра)',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092'],
      expect: 'Запись создана и привязана к карточке клиента салона',
      run: async (t) => {
        // окна, которые приложение предлагает клиенту, сверяем с занятостью журнала (правило ядра occupiesTime)
        const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
        const db = await t.db();
        const INACTIVE = /cancel|no_show/;
        let pick;
        t.state.clashes = [];
        for (const date of [today(), addDays(today(), 1), addDays(today(), 2)]) {
          const times = await freeTimes(t, SONA, date);
          const busy = db.core.bookings.filter((b) => b.staffId === SONA && b.start.startsWith(date) && !b.deletedAt && !INACTIVE.test(b.status));
          for (const tm of times) {
            const a = toMin(tm);
            const hit = busy.find((b) => a < toMin(b.start.slice(11, 16)) + b.durationMin && toMin(b.start.slice(11, 16)) < a + 45);
            if (hit) t.state.clashes.push(`${date} ${tm} ↔ ${hit.id} ${hit.start.slice(11, 16)} ${hit.durationMin} мин «${hit.status}»`);
            else if (!pick) pick = { date, time: tm };
          }
          if (pick) break;
        }
        if (!pick) throw new Fail('у Сони нет окна, не пересекающегося с журналом');
        const r = await clientBook(t, { staffId: SONA, date: pick.date, time: pick.time });
        t.state.booking = r.booking;
        t.assert(r.booking.clientId, 'запись из приложения без карточки клиента салона');
        t.note(`запись ${r.booking.id} ${r.booking.start}, ${r.booking.total} ֏, карточка ${r.booking.clientId}`);
      },
    },
    {
      id: 'S1b',
      title: 'Окна, которые приложение предлагает клиенту, свободны и в журнале',
      persona: 'client',
      area: 'schedule',
      fids: ['F-00-001', 'F-02-071'],
      expect: 'Ни одно предложенное окно не пересекается с записью, которую журнал считает занимающей время',
      needs: ['S1'],
      run: async (t) => {
        t.assert(
          !t.state.clashes.length,
          `приложение предлагает окна поверх записей журнала: ${t.state.clashes.slice(0, 3).join('; ')} — окна (api/schedule computeFreeSlots) считают «Ждёт предоплату» старше 15 мин снятой (своя проверка isPrepaymentExpired), а запись никто не снял: журнал держит время занятым, «Пришёл» на новую запись падает «Это время у мастера уже занято другой записью»`,
        );
      },
    },
    {
      id: 'S2',
      title: 'Карточка клиента до визита: «Продано», «Оплачено», «Баланс»',
      persona: 'admin',
      area: 'clients',
      fids: ['F-04-001'],
      expect: '/biz/clients/<id> — видны суммы «Продано / Оплачено / Баланс»',
      needs: ['S1'],
      run: async (t) => {
        t.state.before = await card(t, t.state.booking.clientId);
        const b = t.state.before;
        t.note(`до визита: продано ${b.sold}, оплачено ${b.paid}, баланс ${b.balance}`);
        t.assert(b.sold !== undefined, 'в карточке нет «Продано»');
      },
    },
    {
      id: 'S3',
      title: 'Администратор отмечает «Пришёл»',
      persona: 'admin',
      area: 'journal',
      fids: ['F-01-054'],
      expect: 'Окно записи → «Пришёл» → «Сохранить»; статус arrived',
      needs: ['S1'],
      run: async (t) => {
        const upd = await setStatusInJournal(t, 'admin', t.state.booking, 'arrived');
        t.assert(upd.status === 'arrived', `статус не «пришёл»: ${upd.status} (${upd.__ui.toasts.join(' / ')})`);
      },
    },
    {
      id: 'S4',
      title: 'В карточке «Продано» выросло на сумму визита, визит — в «Истории визитов»',
      persona: 'admin',
      area: 'clients',
      fids: ['F-04-001', 'F-00-127'],
      expect: '«Продано» + сумма записи; вкладка «История визитов» — дата, услуга, «Сона Григорян»',
      needs: ['S2', 'S3'],
      run: async (t) => {
        const after = await card(t, t.state.booking.clientId);
        t.state.after = after;
        const b = t.state.booking;
        t.note(`после «пришёл»: продано ${after.sold} (было ${t.state.before.sold}, визит ${b.total}), оплачено ${after.paid}, баланс ${after.balance}`);
        t.assert(after.sold === t.state.before.sold + b.total, `«Продано» ${after.sold}, ждали ${t.state.before.sold + b.total}`);
        const tab = t.page.getByRole('tab', { name: 'История визитов' }).filter({ visible: true }).first();
        if (!(await tab.count())) throw new Fail('в карточке нет вкладки «История визитов»');
        await tab.click();
        const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const when = `${Number(b.start.slice(8, 10))} ${MONTHS[Number(b.start.slice(5, 7)) - 1]}, ${b.start.slice(11, 16)}`;
        await t.page.getByText(when).first().waitFor({ timeout: 15000 }).catch(() => {});
        await t.settle(500);
        const txt = await t.mainText();
        const i = txt.indexOf(when);
        const row = i >= 0 ? txt.slice(i, i + 160).replace(/\n+/g, ' · ') : '';
        t.state.historyRow = row;
        t.note(`строка истории: «${row}»`);
        t.assert(i >= 0, `в «Истории визитов» нет визита «${when}»`);
        if (!row.includes('Сона')) t.note('в строке истории не указан мастер');
      },
    },
    {
      id: 'S4b',
      title: 'Оплата визита в «Истории визитов» и в суммах карточки — одна и та же',
      persona: 'admin',
      area: 'clients',
      fids: ['F-04-001', 'F-00-127'],
      expect: 'Визит никто не оплачивал: в истории «Оплачено 0 из N» (или «не оплачено»), в карточке «Оплачено» не выросло, баланс в минусе — одинаково в обоих местах',
      needs: ['S4'],
      run: async (t) => {
        const m = t.state.historyRow.match(/Оплачено\s*([\d\s  ]+)\s*֏?\s*из/);
        const paidHist = m ? Number(m[1].replace(/\D/g, '')) : undefined;
        const paidCard = (t.state.after.paid ?? 0) - (t.state.before.paid ?? 0);
        t.note(`история: оплачено ${paidHist ?? '—'}; карточка: оплачено за визит ${paidCard}, баланс ${t.state.after.balance}`);
        t.assert(
          paidHist === undefined || paidHist === paidCard,
          `карточка противоречит сама себе: в «Истории визитов» «Оплачено ${paidHist} из ${t.state.booking.total}», а в суммах «Оплачено» +${paidCard} и пометка «Должник» — оплаты в журнале не было (ни одного платежа finance)`,
        );
      },
    },
    {
      id: 'S5',
      title: 'Оплата визита в окне записи → «Оплачено» в карточке, долг закрыт',
      persona: 'admin',
      area: 'finance',
      fids: ['F-07-001', 'F-00-127'],
      expect: 'Окно записи → «Оплатить» → наличные, сумма визита → в карточке «Оплачено» + сумма, «Баланс» не в минусе',
      needs: ['S3'],
      run: async (t) => {
        t.state.after ??= await card(t, t.state.booking.clientId);
        const dlg = await openInJournal(t, 'admin', t.state.booking);
        const pay = dlg.getByRole('button', { name: /^Оплатить/ }).first();
        if (!(await pay.count())) t.wait('finance', 'в окне записи нет «Оплатить»');
        await pay.click();
        await t.settle(700);
        const top = t.page.locator('[role="dialog"], [role="alertdialog"]').last();
        const txt = (await top.innerText().catch(() => '')).replace(/\n+/g, ' · ');
        t.note(`после «Оплатить»: «${txt.slice(0, 200)}»`);
        const cash = top.getByRole('button', { name: /Наличн/ }).first();
        if (!(await cash.count())) t.wait('finance', '«Оплатить» не спрашивает способ оплаты — вклад finance в окно записи ещё заглушка');
        await cash.click();
        await t.settle(300);
        const confirm = top.getByRole('button', { name: /^(Оплатить|Провести|Принять|Сохранить)/ }).last();
        if (await confirm.count()) await confirm.click();
        await t.settle(900);
        const after = await card(t, t.state.booking.clientId);
        t.assert(after.paid === (t.state.after.paid ?? 0) + t.state.booking.total, `«Оплачено» в карточке ${after.paid}, ждали ${(t.state.after.paid ?? 0) + t.state.booking.total}`);
      },
    },
    {
      id: 'S6',
      title: 'Клиент в приложении видит ту же оплату, что и салон',
      persona: 'client',
      area: 'client',
      fids: ['F-00-127'],
      expect: '/bookings/<id>: «Итого» = сумма визита; «Оплачено» — только если салон провёл оплату, и та же сумма; никаких списаний с сертификата, которых не было',
      needs: ['S3'],
      run: async (t) => {
        const now = await card(t, t.state.booking.clientId);
        await t.go('client', `/bookings/${t.state.booking.id}`, 'phone');
        const txt = await t.mainText();
        const paidApp = moneyAfter(txt, 'Оплачено');
        const cert = /Списано с сертификата/.test(txt);
        const paidDelta = (now.paid ?? 0) - (t.state.before?.paid ?? now.paid ?? 0);
        t.note(`приложение: оплачено ${paidApp ?? '—'}, «Списано с сертификата»: ${cert ? 'да' : 'нет'}; CRM: оплачено за визит ${paidDelta}`);
        t.assert(!cert && (paidApp === undefined ? paidDelta === 0 : paidApp === paidDelta), `клиент видит оплату, которой в салоне не было: «${txt.slice(txt.indexOf('Оплата'), txt.indexOf('Оплата') + 160).replace(/\n+/g, ' · ')}» — суммы приложения выдуманы (getBookingPaymentBreakdown), а в CRM визит не оплачен`);
      },
    },
  ],
};
