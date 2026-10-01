// C02 · Гость без входа находит мастера → запись → вход по коду в WhatsApp → «Мои записи» → журнал.
import { Fail } from '../lib.mjs';
import { bookingById, clientsSearch, crmClientByPhone, journalBlockText } from '../helpers.mjs';

const GAYANE = 'st_nuri_gayane';
const PHONE_LOCAL = '00177701';
const PHONE = '+37400177701';
const NAME = 'Гоар Проверкина';

export default {
  id: 'C02',
  title: 'Гость → запись с входом по коду → «Мои записи» → CRM → журнал',
  personas: ['guest', 'client', 'admin'],
  fids: ['F-00-031', 'F-00-032', 'F-00-092', 'F-00-128', 'F-00-001'],
  steps: [
    {
      id: 'S1',
      title: 'Гость видит карточку мастера и окна без регистрации',
      persona: 'guest',
      area: 'client',
      fids: ['F-00-031'],
      expect: 'Карточка Гаяне, «Ближайшие свободные окна», кнопка записи — без входа',
      run: async (t) => {
        await t.go('guest', `/masters/${GAYANE}`);
        await t.expectText('Гаяне Оганесян');
        await t.expectText('Ближайшие свободные окна');
      },
    },
    {
      id: 'S2',
      title: 'Запись: услуга → время → имя, телефон, согласие → код 0000 → «Подтвердить запись»',
      persona: 'guest',
      area: 'client',
      fids: ['F-00-032', 'F-00-092', 'F-14-008'],
      expect: 'Вход и запись в одном потоке, без перехода на отдельный экран входа; запись создана',
      run: async (t) => {
        const before = await t.db();
        const known = new Set(before.core.bookings.map((b) => b.id));
        await t.go('guest', `/book?staff=${GAYANE}`);
        if (await t.has('Шаг')) {
          if (await t.has('Маникюр классический')) {
            await t.click('text=Маникюр классический');
            await t.click('role=button[name="Продолжить"]');
          }
        }
        const firstDay = t.page.locator('button.min-w-16').first();
        if (await firstDay.count()) await firstDay.click();
        await t.click('button.min-h-11');
        if (await t.has('Оттенок или вариант')) await t.click('role=button[name="Продолжить"]');
        await t.fill('input[placeholder="Как к вам обращаться"]', NAME);
        await t.fill('input[type="tel"]', PHONE_LOCAL);
        await t.click('text=Согласен');
        await t.click('role=button[name="Получить код"]', { after: 600 });
        await t.fill('input[inputmode="numeric"]', '0000');
        await t.click('role=button[name="Подтвердить запись"]', { after: 1500 });
        const after = await t.db();
        const created = after.core.bookings.filter((b) => !known.has(b.id));
        if (!created.length) throw new Fail(`запись не создалась (тосты: ${(await t.toasts()).join(' / ') || '—'})`);
        const user = after.core.appUsers.find((u) => u.phone === PHONE);
        t.assert(user, 'пользователь приложения с этим номером не заведён');
        t.state.booking = created[created.length - 1];
        t.state.user = user;
        t.state.db = after;
        t.note(`запись ${t.state.booking.id} ${t.state.booking.start}, appUserId ${t.state.booking.appUserId}, новый пользователь ${user.id}`);
      },
    },
    {
      id: 'S3',
      title: 'Запись привязана к только что вошедшему клиенту',
      persona: 'client',
      area: 'client',
      fids: ['F-00-032'],
      expect: 'booking.appUserId = id нового пользователя с номером +374 00 177 701',
      needs: ['S2'],
      run: async (t) => {
        t.assert(t.state.booking.appUserId === t.state.user.id, `запись записана на ${t.state.booking.appUserId}, а вошёл ${t.state.user.id}`);
      },
    },
    {
      id: 'S4',
      title: 'После входа «Мои записи» показывают записи этого клиента',
      persona: 'client',
      area: 'client',
      fids: ['F-00-032', 'F-14-011'],
      expect: '/bookings — новая запись к Гаяне; чужих записей (демо-клиента «Ани Мелкумян») нет',
      needs: ['S2'],
      run: async (t) => {
        await t.go('client', '/bookings');
        const txt = await t.mainText();
        const hasMine = txt.includes('Гаяне Оганесян');
        const foreign = t.state.db.core.bookings.filter((b) => b.appUserId === 'au_01' && !b.deletedAt && b.start > t.state.booking.start.slice(0, 10)).length;
        t.assert(hasMine, 'в «Мои записи» нет только что созданной записи к Гаяне');
        t.assert(!/Лусине Погосян|Карен Мелконян|Арпи Азарян/.test(txt), `после входа новым номером видны записи другого клиента (au_01, ${foreign} шт.) — персона client всегда = первый пользователь приложения`);
      },
    },
    {
      id: 'S5',
      title: 'Карточка клиента в CRM салона заведена по номеру',
      persona: 'admin',
      area: 'client',
      fids: ['F-00-128', 'F-00-129'],
      expect: 'В клиентах Nuri есть «Гоар Проверкина» +37400177701, booking.clientId на неё',
      needs: ['S2'],
      run: async (t) => {
        const db = await t.db();
        const crm = crmClientByPhone(db, 'biz_nuri', PHONE);
        const b = bookingById(db, t.state.booking.id);
        t.assert(crm, 'карточка клиента в CRM Nuri не создана — запись из приложения не доходит до «Клиентов»');
        t.assert(b.clientId === crm.id, 'запись не связана с карточкой клиента');
      },
    },
    {
      id: 'S6',
      title: 'Клиент виден в списке «Клиенты» салона',
      persona: 'admin',
      area: 'clients',
      fids: ['F-00-128'],
      expect: '/biz/clients — строка «Гоар Проверкина»',
      needs: ['S2'],
      run: async (t) => {
        const txt = await clientsSearch(t, 'admin', PHONE_LOCAL);
        t.assert(txt.includes(NAME), `поиск по номеру ${PHONE_LOCAL} в «Клиентах» не находит «${NAME}» — CRM не знает о записи из приложения`);
      },
    },
    {
      id: 'S7',
      title: 'Администратор видит запись в журнале с именем',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-001', 'F-01-026'],
      expect: 'Блок в колонке Гаяне: «Гоар П.»',
      needs: ['S2'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const blocks = await journalBlockText(t, b);
        t.assert(blocks.length, 'записи нет в журнале');
        t.assert(blocks.some((x) => x.includes('Гоар П.')), `в журнале без имени: «${blocks.map((x) => x.replace(/\n/g, ' · ')).join(' || ')}»`);
      },
    },
  ],
};
