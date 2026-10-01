// C21 · Абонемент (F-00-197): клиент покупает в приложении → салон видит продажу у себя (лояльность, карточка
// клиента) → визит списывает занятие. Хозяин абонементов — раздел loyalty (AREAS «Хозяева сущностей»).
import { Fail, extFileIsStub } from '../lib.mjs';
import { crmClientByPhone } from '../helpers.mjs';

const NURI = 'biz_nuri';

export default {
  id: 'C21',
  title: 'Абонемент: купил в приложении → виден салону → визит списывает занятие',
  personas: ['client', 'admin', 'owner'],
  fids: ['F-00-197', 'F-00-196', 'F-00-127'],
  steps: [
    {
      id: 'S1',
      title: 'На странице места видны абонементы и сертификаты с понятными названиями',
      persona: 'client',
      area: 'client',
      fids: ['F-00-197', 'F-00-196'],
      expect: '/places/biz_nuri → «Покупки»: у каждой позиции название и цена («Абонемент на 10 визитов · 45 000 ֏», «Сертификат · 20 000 ֏»)',
      run: async (t) => {
        await t.go('client', `/places/${NURI}`);
        const txt = await t.mainText();
        const block = txt.slice(txt.indexOf('Покупки'), txt.indexOf('Покупки') + 300);
        t.assert(txt.includes('Покупки'), 'на странице места нет «Покупок»');
        const lines = block.split('\n').map((x) => x.trim()).filter(Boolean);
        const nameless = lines.filter((l, i) => /֏$/.test(l) && (i === 0 || /֏$|Купить|Покупки/.test(lines[i - 1])));
        t.assert(!nameless.length, `в «Покупках» позиция без названия — только цена: «${nameless.join(' / ')}»`);
      },
    },
    {
      id: 'S2',
      title: 'Клиент покупает абонемент',
      persona: 'client',
      area: 'client',
      fids: ['F-00-197'],
      expect: '«Купить» → подтверждение (как оплачивается) → абонемент в «Мои абонементы»',
      run: async (t) => {
        await t.go('client', `/places/${NURI}`);
        const before = await t.db();
        t.state.before = JSON.stringify(before.areas.client?.memberships ?? before.areas.client ?? {}).length;
        const buy = t.page.getByRole('button', { name: 'Купить' }).first();
        if (!(await buy.count())) t.fail('кнопки «Купить» нет');
        await buy.click();
        await t.settle(500);
        const dlg = t.page.locator('[role="dialog"], [role="alertdialog"]');
        if (await dlg.count()) {
          t.note(`окно покупки: «${(await dlg.last().innerText()).replace(/\n+/g, ' · ').slice(0, 160)}»`);
          await dlg.last().getByRole('button').last().click();
          await t.settle(700);
        }
        const toasts = await t.toasts();
        t.note(`тост «${toasts.join(' / ') || '—'}»`);
        const db = await t.db();
        const where = Object.entries(db.areas).filter(([, v]) => /membership|абонемент/i.test(JSON.stringify(v ?? {}).slice(0, 200000))).map(([k]) => k);
        const mine = (db.areas.client?.memberships ?? []).filter((m) => m.appUserId === 'au_01' && m.businessId === NURI);
        t.state.membership = mine[mine.length - 1];
        t.note(`абонементы клиента в Nuri: ${mine.length}; срезы, где встречаются абонементы: ${where.join(', ')}`);
        t.assert(mine.length, 'покупка абонемента не сохранилась');
        await t.go('client', '/memberships');
        await t.expectText('Абонемент на 10 визитов', 'купленного абонемента нет в «Мои абонементы»');
      },
    },
    {
      id: 'S3',
      title: 'Салон видит проданный абонемент в «Лояльности»',
      persona: 'owner',
      area: 'loyalty',
      fids: ['F-00-197'],
      expect: '/biz/loyalty/memberships — продажа клиенту Ани Мелкумян, остаток 10',
      needs: ['S2'],
      run: async (t) => {
        await t.openOrWait('owner', '/biz/loyalty/memberships', 'loyalty', 'абонементы салона — заглушка; проданный в приложении абонемент лежит в срезе client, а хозяин абонементов — loyalty');
        // q4: loyalty построен — сверяем данными: у карточки Ани в Nuri (по номеру) появился абонемент в loyalty.memberships;
        // в списке кабинета клиент показан номером, поэтому на экране ищем имя ИЛИ номер
        const db = await t.db();
        const crm = crmClientByPhone(db, NURI, '+37400160001');
        const mem = (db.areas.loyalty?.memberships ?? []).filter((m) => m.clientId === crm?.id);
        const recent = mem.filter((m) => String(m.soldAt ?? '') >= (t.state.membership?.purchasedAt ?? '9999'));
        t.note(`абонементов Ани в loyalty (Nuri): ${mem.length}, проданных после покупки в приложении: ${recent.length}; в приложении куплен ${t.state.membership?.id ?? '—'} «${t.state.membership?.title?.ru ?? ''}»`);
        t.assert(recent.length, `проданного в приложении абонемента («${t.state.membership?.title?.ru ?? ''}») нет в кабинете: покупка легла в client.memberships, а /biz/loyalty/memberships читает loyalty.memberships (у Ани там ${mem.length} старых)`);
      },
    },
    {
      id: 'S4',
      title: 'Абонемент виден в карточке клиента CRM',
      persona: 'admin',
      area: 'clients',
      fids: ['F-00-197', 'F-00-128'],
      expect: '/biz/clients/<Ани Мелкумян> → абонемент «на 10 визитов», осталось 10',
      needs: ['S2'],
      run: async (t) => {
        const db = await t.db();
        const crm = crmClientByPhone(db, NURI, '+37400160001');
        if (!crm) throw new Fail('нет карточки клиента в CRM Nuri');
        await t.openOrWait('admin', `/biz/clients/${crm.id}`, 'clients', 'карточка клиента — заглушка');
        const txt = await t.mainText();
        if (/10 визитов|Абонемент/i.test(txt)) return;
        if ((await t.isExtStub(undefined, 'loyalty')) || extFileIsStub('loyalty', 'ClientCard')) t.wait('loyalty', 'вклад loyalty в карточку клиента — заглушка (карточка её прячет); абонемент из приложения лежит в срезе client');
        t.fail('в карточке клиента нет купленного в приложении абонемента');
      },
    },
    {
      id: 'S5',
      title: 'Визит по абонементу: в окне записи — «оплатить абонементом», остаток −1',
      persona: 'admin',
      area: 'finance',
      fids: ['F-00-197', 'F-00-127', 'F-00-194'],
      expect: 'Окно записи клиента → «Оплата» → «Абонемент (осталось 10)» → после «Пришёл» осталось 9 — и в приложении тоже 9',
      needs: ['S2'],
      pending: 'loyalty',
      pendingWhy: 'оплата визита абонементом — вклад loyalty/finance в окно записи (заглушки)',
    },
  ],
};
