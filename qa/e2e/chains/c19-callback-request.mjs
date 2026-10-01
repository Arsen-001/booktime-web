// C19 · «Попросить перезвонить» (F-00-106), когда звонок у мастера закрыт (F-00-105) → мастер видит просьбу
// с номером; плюс колокольчик кабинета о новой записи клиента.
import { Fail, today } from '../lib.mjs';

const ANI = 'st_nuri_ani';
const PHONE_LOCAL = '00177703';

export default {
  id: 'C19',
  title: '«Попросить перезвонить» → мастер видит просьбу с номером',
  personas: ['client', 'master', 'admin'],
  fids: ['F-00-106', 'F-00-105', 'F-00-104'],
  steps: [
    {
      id: 'S1',
      title: 'Вне часов звонка на карточке мастера — «Попросить перезвонить»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-105', 'F-00-106'],
      expect: '21:30 (часы звонка 10:00–19:00): «Позвонить» закрыто, есть «Попросить перезвонить»',
      run: async (t) => {
        // часы звонка Ани 10:00–19:00 — закрепляем часы браузера на 21:30, чтобы звонок был закрыт
        await t.page.clock.setFixedTime(new Date(`${today()}T21:30:00`));
        await t.go('client', `/masters/${ANI}`);
        await t.page.getByText('Связаться').first().waitFor({ timeout: 12000 }).catch(() => {});
        if (!(await t.page.getByRole('button', { name: 'Попросить перезвонить' }).count())) {
          t.wait('client', 'сейчас часы звонка открыты — кнопка «Попросить перезвонить» не показана (повторить в другое время)');
        }
      },
    },
    {
      id: 'S2',
      title: 'Клиент отправляет просьбу перезвонить',
      persona: 'client',
      area: 'client',
      fids: ['F-00-106'],
      expect: 'Окно «Попросить перезвонить» → номер → «Отправить просьбу» → тост; просьба сохранена',
      needs: ['S1'],
      run: async (t) => {
        await t.click('role=button[name="Попросить перезвонить"]', { after: 400 });
        const dlg = t.page.locator('[role="dialog"]').last();
        const tel = dlg.locator('input[type="tel"]').first();
        const pre = await tel.inputValue();
        t.state.prefilled = Boolean(pre.replace(/\D/g, ''));
        if (!t.state.prefilled) await tel.fill(PHONE_LOCAL);
        await dlg.getByRole('button', { name: 'Отправить просьбу' }).click();
        await t.settle(700);
        const db = await t.db();
        const req = (db.areas.client?.callbackRequests ?? []).slice(-1)[0];
        t.state.req = req;
        t.note(`просьба ${JSON.stringify(req ?? {})}; номер подставлен: ${t.state.prefilled ? 'да' : 'нет'}`);
        t.assert(req, 'просьба не сохранилась');
      },
    },
    {
      id: 'S2b',
      title: 'Номер вошедшего клиента подставлен сам',
      persona: 'client',
      area: 'client',
      fids: ['F-00-106', 'F-00-004'],
      expect: 'Клиент вошёл по номеру — в окне «Попросить перезвонить» номер уже вписан (одно нажатие вместо ввода)',
      needs: ['S2'],
      run: async (t) => {
        t.assert(t.state.prefilled, 'клиент вошёл в приложение, а номер в просьбе перезвонить нужно вводить заново');
      },
    },
    {
      id: 'S3',
      title: 'Мастер видит просьбу с номером клиента',
      persona: 'master',
      area: 'notify',
      fids: ['F-00-106'],
      expect: 'Колокольчик кабинета мастера (или «Уведомления»): «Перезвоните · <имя> · +374 …»',
      needs: ['S2'],
      run: async (t) => {
        await t.go('master', '/biz/journal', 'desktop');
        await t.click('header button[aria-label="Уведомления"]', { after: 500 });
        const bell = await t.page.locator('[role="dialog"]').last().innerText().catch(() => '');
        t.assert(/перезвон/i.test(bell), `просьба перезвонить не дошла до мастера: колокольчик «${bell.replace(/\n+/g, ' · ').slice(0, 100)}»; просьбы лежат в срезе client.callbackRequests, кабинет их не читает`);
      },
    },
    {
      id: 'S4',
      title: 'Администратор салона тоже видит просьбу (он ведёт звонки, F-00-041)',
      persona: 'admin',
      area: 'notify',
      fids: ['F-00-106', 'F-00-041'],
      expect: 'Колокольчик администратора: просьба перезвонить мастеру Ани',
      needs: ['S2'],
      run: async (t) => {
        await t.go('admin', '/biz/journal', 'desktop');
        await t.click('header button[aria-label="Уведомления"]', { after: 500 });
        const bell = await t.page.locator('[role="dialog"]').last().innerText().catch(() => '');
        t.assert(/перезвон/i.test(bell), `у администратора просьбы нет: «${bell.replace(/\n+/g, ' · ').slice(0, 100)}»`);
      },
    },
  ],
};
