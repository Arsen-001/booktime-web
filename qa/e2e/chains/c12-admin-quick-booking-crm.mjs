// C12 · Администратор записывает постоянного клиента по телефону (F-00-060, F-00-041) → карточка по номеру
// без дублей (F-00-128) → клиент в приложении НЕ получает мастера в «Мои мастера» из CRM (F-00-130, снято №3).
import { Fail, addDays, today } from '../lib.mjs';
import { clientsSearch } from '../helpers.mjs';

const PHONE = '+37400160001'; // номер демо-клиента приложения (au_01), он же карточка cl_… в CRM Nuri

export default {
  id: 'C12',
  title: 'Быстрая запись админом по номеру → одна карточка → клиенту из CRM ничего не утекает',
  personas: ['admin', 'client'],
  fids: ['F-00-060', 'F-00-041', 'F-00-128', 'F-00-130'],
  steps: [
    {
      id: 'S1',
      title: 'Админ создаёт запись: мастер, время, номер постоянного клиента — имя подставилось',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-060', 'F-00-041', 'F-00-128'],
      expect: 'Ввод номера +374 00 160 001 подставляет «Ани Мелкумян»; запись создаётся',
      run: async (t) => {
        await t.go('admin', '/biz/journal', 'desktop');
        const db = await t.db();
        const selfBooked = new Set(db.core.bookings.filter((b) => b.appUserId === 'au_01' && ['app', 'link', 'widget'].includes(b.source)).map((b) => b.staffId));
        const master = db.core.staff.find((s) => s.businessId === 'biz_nuri' && s.role === 'master' && s.status === 'active' && !selfBooked.has(s.id));
        if (!master) throw new Fail('нет мастера Nuri, к которому клиент ещё не записывался сам');
        t.state.master = master;
        const date = addDays(today(), 5);
        t.state.date = date;
        t.state.before = db.core.clients.filter((c) => c.businessId === 'biz_nuri' && c.phone === PHONE).length;
        t.state.count = db.core.bookings.length;
        await t.go('admin', `/biz/journal?new=1&staff=${master.id}&start=20:00&date=${date}`, 'desktop');
        const dlg = t.page.locator('[role="dialog"]').first();
        await dlg.locator('input[type="tel"]').first().fill('00160001');
        await t.settle(900);
        const nameInput = dlg.locator('input[placeholder="Имя"]').first();
        // q4: поиск по номеру асинхронный — под нагрузкой имя приходит через 1–3 с; ждём до 6 с
        let name = '';
        for (let i = 0; i < 12 && !name; i++) {
          name = await nameInput.inputValue().catch(() => '');
          if (!name) await t.page.waitForTimeout(500);
        }
        const before = await dlg.innerText();
        t.state.newClientLabel = /Новый клиент/.test(before);
        if (!name) {
          // подсказка «Ани Мелкумян · +374 00 160 001» под полем номера — выбрать её
          const sug = dlg.locator('button, [role="option"]', { hasText: 'Ани Мелкумян' }).first();
          if (await sug.count()) {
            await sug.click();
            await t.settle(400);
            t.state.pickedSuggestion = true;
            name = (await nameInput.inputValue().catch(() => '')) || ((await dlg.innerText()).includes('Ани Мелкумян') ? 'Ани Мелкумян' : '');
          }
        }
        t.note(`после ввода номера: имя «${name || '—'}»${t.state.pickedSuggestion ? ' (пришлось выбрать подсказку)' : ''}; до выбора окно писало «Новый клиент»: ${t.state.newClientLabel ? 'да' : 'нет'}`);
        if (!name) {
          t.note('имя постоянного клиента по номеру не подставилось — вводим вручную');
          await nameInput.fill('Ани Мелкумян');
        }
        t.state.autofill = Boolean(name);
        // услуга — чтобы запись была не «пустой»
        const svc = dlg.locator('button', { hasText: 'Маникюр классический' }).first();
        if (await svc.count()) await svc.click();
        await t.settle(300);
        await dlg.getByRole('button', { name: /^(Записать|Сохран|Созда)/ }).last().click();
        await t.settle(600);
        const dialogs = t.page.locator('[role="dialog"], [role="alertdialog"]');
        if ((await dialogs.count()) > 1) {
          t.note(`второе окно: «${(await dialogs.last().innerText()).replace(/\n+/g, ' · ').slice(0, 120)}»`);
          await dialogs.last().getByRole('button').last().click();
          await t.settle(500);
        }
        const after = await t.db();
        const created = after.core.bookings.slice(t.state.count);
        if (!created.length) throw new Fail('запись не создана');
        t.state.booking = created[created.length - 1];
        t.state.after = after;
      },
    },
    {
      id: 'S2',
      title: 'Постоянный клиент узнан по номеру (имя подставилось само)',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-060'],
      expect: 'Постоянный клиент — «3 нажатиями»: номер → имя из CRM; при полном совпадении номера не пишет «Новый клиент»',
      needs: ['S1'],
      run: async (t) => {
        t.assert(t.state.autofill, 'по номеру постоянного клиента имя не подставилось — приходится вводить заново');
        t.assert(!t.state.newClientLabel, 'при полном номере постоянного клиента окно пишет «Новый клиент — будет добавлен в базу», пока не нажмёшь подсказку: легко создать дубль');
      },
    },
    {
      id: 'S3',
      title: 'Вторая карточка с тем же номером не создана',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-128'],
      expect: 'В CRM Nuri одна карточка +37400160001; booking.clientId на неё',
      needs: ['S1'],
      run: async (t) => {
        const list = t.state.after.core.clients.filter((c) => c.businessId === 'biz_nuri' && c.phone === PHONE);
        t.assert(list.length === t.state.before, `карточек с номером было ${t.state.before}, стало ${list.length}`);
        t.assert(list.some((c) => c.id === t.state.booking.clientId), 'запись не привязана к существующей карточке');
      },
    },
    {
      id: 'S4',
      title: 'В «Клиентах» у карточки виден новый визит',
      persona: 'admin',
      area: 'clients',
      fids: ['F-00-128'],
      expect: '/biz/clients — «Ани Мелкумян» одной строкой; будущий визит учтён',
      needs: ['S1'],
      run: async (t) => {
        const txt = await clientsSearch(t, 'admin', '00160001');
        const n = (txt.match(/Ани Мелкумян/g) ?? []).length;
        t.assert(n === 1, `поиск по номеру в «Клиентах»: «Ани Мелкумян» найдена ${n} раз(а)`);
      },
    },
    {
      id: 'S5',
      title: 'Клиент в приложении не получает этого мастера в «Мои мастера» (запись внесена салоном)',
      persona: 'client',
      area: 'client',
      fids: ['F-00-130', 'F-00-118'],
      expect: 'Главная → «Мои мастера» без мастера, к которому записал только администратор',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', '/');
        const txt = await t.mainText();
        const block = txt.slice(txt.indexOf('Мои мастера'), txt.indexOf('Свободно рядом'));
        t.assert(!block.includes(t.state.master.name), `в «Мои мастера» появился ${t.state.master.name} только из-за записи в CRM`);
      },
    },
  ],
};
