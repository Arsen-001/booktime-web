// C09 · Владелец сети с филиалами (F-00-049, F-00-050): сводка по всем и каждый салон отдельно.
import { clientsSearch } from '../helpers.mjs';

export default {
  id: 'C09',
  title: 'Владелец сети: все филиалы вместе и по отдельности; раздельные склад и клиенты',
  personas: ['network', 'client'],
  fids: ['F-00-049', 'F-00-050'],
  steps: [
    {
      id: 'S1',
      title: 'Переключатель филиалов в верхней полосе: «Все филиалы» + оба салона',
      persona: 'network',
      area: 'foundation',
      fids: ['F-00-049'],
      expect: 'Список «Все филиалы / Manana Beauty · Нор-Норк / Manana Beauty · Шенгавит»',
      run: async (t) => {
        await t.go('network', '/biz/journal', 'desktop');
        await t.page.locator('header [role="combobox"]').filter({ visible: true }).first().click();
        await t.settle(200);
        const opts = (await t.page.getByRole('option').allInnerTexts()).map((x) => x.trim());
        await t.page.keyboard.press('Escape');
        t.assert(opts.includes('Все филиалы') && opts.length >= 3, `в переключателе: ${opts.join(' | ')}`);
      },
    },
    {
      id: 'S2',
      title: 'Журнал «Все филиалы» показывает мастеров обоих салонов',
      persona: 'network',
      area: 'journal',
      fids: ['F-00-049'],
      expect: 'В сетке есть и Арпи Азарян (Нор-Норк), и Гор Мартиросян (Шенгавит)',
      run: async (t) => {
        await t.go('network', '/biz/journal', 'desktop');
        const txt = await t.mainText();
        const nn = txt.includes('Арпи Азарян');
        const sh = txt.includes('Гор Мартиросян') || txt.includes('Астхик');
        t.assert(nn && sh, `в режиме «Все филиалы» видно: Нор-Норк ${nn ? 'да' : 'нет'}, Шенгавит ${sh ? 'да' : 'нет'} — журнал берёт только первый филиал`);
      },
    },
    {
      id: 'S3',
      title: 'Выбран Шенгавит — в журнале только его мастера',
      persona: 'network',
      area: 'journal',
      fids: ['F-00-049'],
      expect: 'Гор Мартиросян есть, Арпи Азарян нет',
      run: async (t) => {
        await t.go('network', '/biz/journal', 'desktop');
        await t.pick('header [role="combobox"] >> visible=true', 'Manana Beauty · Шенгавит');
        await t.settle(800);
        const txt = await t.mainText();
        t.assert(txt.includes('Гор Мартиросян') && !txt.includes('Арпи Азарян'), `после выбора Шенгавита: Гор ${txt.includes('Гор Мартиросян') ? 'есть' : 'нет'}, Арпи ${txt.includes('Арпи Азарян') ? 'есть' : 'нет'}`);
      },
    },
    {
      id: 'S4',
      title: 'Клиенты салонов не смешиваются',
      persona: 'network',
      area: 'clients',
      fids: ['F-00-050'],
      expect: 'Шенгавит → «Клиенты» показывает только клиентов Шенгавита; «Все филиалы» — оба с пометкой салона',
      run: async (t) => {
        await t.go('network', '/biz/clients', 'desktop');
        const db = await t.db();
        const nnOnly = db.core.clients.find((c) => c.businessId === 'biz_manana_nn' && !db.core.clients.some((x) => x.businessId === 'biz_manana_sh' && x.phone === c.phone));
        await t.pick('header [role="combobox"] >> visible=true', 'Manana Beauty · Шенгавит');
        await t.settle(800);
        const input = t.page.locator('main input[placeholder^="Имя, телефон"], main input[placeholder^="Поиск (по имени"], main input[type="search"]').filter({ visible: true }).first();
        await input.fill(nnOnly.phone.slice(-6));
        await input.press('Enter');
        await t.settle(600);
        const txt = await t.mainText();
        t.assert(nnOnly && !txt.includes(nnOnly.name), `при выбранном Шенгавите в «Клиентах» видна клиентка только Нор-Норка «${nnOnly?.name}»`);
      },
    },
    {
      id: 'S5',
      title: 'Сводка сети: выручка и загрузка по филиалам',
      persona: 'network',
      area: 'network',
      fids: ['F-00-049'],
      expect: '/biz/network — оба филиала с цифрами и итог по сети',
      run: async (t) => {
        await t.openOrWait('network', '/biz/network', 'network');
        await t.expectText('Шенгавит');
        await t.expectText('Нор-Норк');
      },
    },
    {
      id: 'S6',
      title: 'Склад одного салона не виден в другом',
      persona: 'network',
      area: 'stock',
      fids: ['F-00-050'],
      expect: 'Товар Нор-Норка не показывается при выбранном Шенгавите',
      run: async (t) => {
        await t.openOrWait('network', '/biz/stock', 'stock');
        // q4: у филиалов одинаковые названия товаров из сида — кладём данными уникальный товар Нор-Норка
        await t.patchDb(
          `const src = db.areas.stock.goods.find((g) => g.locationId === 'loc_manana_nn');
           if (src && !db.areas.stock.goods.some((g) => g.id === 'gd_e2e_nn')) db.areas.stock.goods.push({ ...src, id: 'gd_e2e_nn', name: 'E2E товар Нор-Норка' });`,
        );
        t.note('подготовка данными: товар «E2E товар Нор-Норка» (копия товара сида Нор-Норка)');
        const seen = {};
        for (const branch of ['Manana Beauty · Шенгавит', 'Manana Beauty · Нор-Норк']) {
          await t.go('network', '/biz/stock', 'desktop');
          await t.pick('header [role="combobox"] >> visible=true', branch).catch((e) => t.note(`переключатель филиала: ${e.message}`));
          await t.settle(800);
          seen[branch] = (await t.mainText()).includes('E2E товар Нор-Норка');
        }
        t.note(`товар Нор-Норка виден: при Шенгавите — ${seen['Manana Beauty · Шенгавит'] ? 'да' : 'нет'}, при Нор-Норке — ${seen['Manana Beauty · Нор-Норк'] ? 'да' : 'нет'}`);
        t.assert(!seen['Manana Beauty · Шенгавит'], 'товар Нор-Норка виден при выбранном Шенгавите — склады филиалов смешаны');
        t.assert(seen['Manana Beauty · Нор-Норк'], 'товара Нор-Норка нет при выбранном Нор-Норке — склад не слушает переключатель филиала');
      },
    },
    {
      id: 'S7',
      title: 'В каталоге клиента филиалы названы без повторов',
      persona: 'client',
      area: 'client',
      fids: ['F-00-049', 'F-00-108'],
      expect: 'Карточка мастера: «Manana Beauty · Шенгавит», а не «Manana Beauty · Шенгавит · Шенгавит»',
      run: async (t) => {
        await t.go('client', '/search');
        const txt = await t.mainText();
        const dup = txt.match(/([А-ЯA-Z][\wА-Яа-яё-]+(?:-[\wА-Яа-яё]+)?) · \1/);
        t.assert(!dup, `повтор района в подписи: «${dup?.[0]}» — имя филиала уже содержит район, а каталог добавляет район ещё раз`);
      },
    },
  ],
};
