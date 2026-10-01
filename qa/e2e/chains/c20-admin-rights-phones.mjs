// C20 · Права галочками (F-00-039, F-00-041): без права «телефоны клиентов» номер скрыт ВЕЗДЕ — в журнале,
// окне записи, «Клиентах», карточке клиента. Мастер салона этого права не имеет по умолчанию; администратору
// владелец снимает его (экрана прав ещё нет — ставим данными, access.staffPermissions).
import { Fail } from '../lib.mjs';
import { bookingById, clientsSearch, journalBlockText, openInJournal } from '../helpers.mjs';

const SRC = 'bk_0081'; // Ани Мелкумян +374 00 160 001 → Ани Саргсян
const FULL = /160[\s-]?001|00160001/;

async function leaks(t, where) {
  const txt = await t.text();
  const m = txt.match(/\+374[\s\d]{6,14}/g) ?? [];
  const full = m.filter((x) => FULL.test(x));
  return { where, full, sample: m.slice(0, 3) };
}

export default {
  id: 'C20',
  title: 'Без права «телефоны клиентов» номер скрыт везде: журнал, окно записи, клиенты',
  personas: ['master', 'owner', 'admin'],
  fids: ['F-00-039', 'F-00-041', 'F-00-010', 'F-00-130'],
  steps: [
    {
      id: 'S1',
      title: 'Мастер салона (без права на телефоны) не видит номер клиента в журнале',
      persona: 'master',
      area: 'journal',
      fids: ['F-00-039', 'F-00-010'],
      expect: 'Блок записи и окно записи у Ани: «+374 •• ••• 001» или без номера',
      run: async (t) => {
        await t.go('master', '/biz/journal', 'desktop');
        const b = bookingById(await t.db(), SRC);
        if (!b) throw new Fail(`в сиде нет записи ${SRC}`);
        t.state.b = b;
        await t.go('master', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const block = (await journalBlockText(t, b)).join(' ');
        await openInJournal(t, 'master', b);
        const win = await leaks(t, 'окно записи');
        const bad = [];
        if (FULL.test(block)) bad.push('блок в сетке');
        if (win.full.length) bad.push(`окно записи (${win.full[0]})`);
        t.assert(!bad.length, `мастер без права «телефоны клиентов» видит полный номер: ${bad.join(', ')}`);
      },
    },
    {
      id: 'S2',
      title: 'Мастер в «Клиентах» не видит номеров',
      persona: 'master',
      area: 'clients',
      fids: ['F-00-039'],
      expect: 'Список клиентов — номера замаскированы (или нет доступа к списку)',
      run: async (t) => {
        await t.go('master', '/biz/clients', 'desktop');
        const r = await leaks(t, 'клиенты');
        const shown = (await t.text()).match(/\+374 \d{2} \d{3} \d{3}/g) ?? [];
        t.assert(!shown.length, `мастер видит полные номера в «Клиентах»: ${shown.slice(0, 2).join(', ')} (всего ${shown.length})`);
        void r;
      },
    },
    {
      id: 'S3',
      title: 'Владелец снимает у администратора галочку «телефоны клиентов»',
      persona: 'owner',
      area: 'staff',
      fids: ['F-00-039'],
      expect: '/biz/staff/roles (или карточка администратора) → права галочками → снять «телефоны клиентов» → сохранить',
      run: async (t) => {
        await t.openOrWait('owner', '/biz/staff/roles', 'staff', 'экрана прав администратора нет — дальше ставим право данными (access.staffPermissions)');
        t.fail('экран прав построен — дописать снятие галочки через интерфейс');
      },
    },
    {
      id: 'S4',
      title: 'Администратор без права видит номер скрытым в журнале и окне записи',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-039', 'F-00-041'],
      expect: 'После снятия права: блок и окно записи без полного номера',
      run: async (t) => {
        await t.go('admin', '/biz/journal', 'desktop');
        const db = await t.db();
        const adm = db.core.staff.find((s) => s.businessId === 'biz_nuri' && s.role === 'admin');
        if (!adm) throw new Fail('в Nuri нет администратора');
        const perms = ['journal.view', 'journal.edit', 'journal.create', 'journal.reschedule', 'journal.others', 'clients.view', 'clients.edit', 'schedule.edit', 'services.view', 'staff.view', 'stock.view', 'resources.manage'];
        await t.patchDb('db.access = db.access || { staffPermissions: {} }; db.access.staffPermissions[arg.id] = arg.perms;', { id: adm.id, perms });
        t.note(`права администратора ${adm.name} (${adm.id}) без clients.phones выставлены данными`);
        const b = t.state.b ?? bookingById(db, SRC);
        t.state.b = b;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const block = (await journalBlockText(t, b)).join(' ');
        await openInJournal(t, 'admin', b);
        const win = await leaks(t, 'окно записи');
        const bad = [];
        if (FULL.test(block)) bad.push('блок в сетке');
        if (win.full.length) bad.push(`окно записи (${win.full[0]})`);
        t.assert(!bad.length, `право снято, а администратор видит полный номер: ${bad.join(', ')}`);
      },
    },
    {
      id: 'S5',
      title: 'Администратор без права — номера скрыты и в «Клиентах»',
      persona: 'admin',
      area: 'clients',
      fids: ['F-00-039'],
      expect: 'Поиск «Ани Мелкумян» в «Клиентах» — номер замаскирован',
      needs: ['S4'],
      run: async (t) => {
        const txt = await clientsSearch(t, 'admin', 'Мелкумян');
        t.assert(!FULL.test(txt), 'право снято, а в «Клиентах» у администратора полный номер');
      },
    },
  ],
};
