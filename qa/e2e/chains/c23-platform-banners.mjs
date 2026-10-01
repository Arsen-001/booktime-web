// C23 · Баннеры (F-00-163): ставит только наша панель → клиент видит на главной и над результатами поиска →
// показы считаются в панели; у бизнеса кнопки «купить баннер» нет. Панель — раздел platform (/platform/ads),
// показ — раздел client (главная, поиск).
import { Fail } from '../lib.mjs';
import { solidPng } from '../helpers.mjs';

const HOME_TITLE = 'E2E Осенняя неделя красоты';
const SEARCH_TITLE = 'E2E Новые мастера рядом';

async function createBanner(t, title, placement) {
  await t.go('platform', '/platform/ads', 'desktop');
  const db0 = await t.db();
  const known = new Set(((db0.areas?.platform ?? db0.platform)?.ads ?? []).map((a) => a.id));
  await t.click('role=button[name="Новый баннер"]', { after: 600 });
  const dlg = t.page.locator('[role="dialog"]').last();
  await dlg.locator('input:not([type]), input[type="text"]').first().fill(title);
  await dlg.locator('input[type="file"]').first().setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: solidPng(900, 300, [40, 90, 200]) });
  await t.settle(800);
  await dlg.getByRole('radio', { name: placement }).first().click();
  await t.settle(200);
  await dlg.getByRole('button', { name: 'Сохранить' }).last().click();
  await t.settle(900);
  const db = await t.db();
  const ad = ((db.areas?.platform ?? db.platform)?.ads ?? []).find((a) => !known.has(a.id) && a.title === title);
  if (!ad) throw new Fail(`баннер «${title}» не сохранён (тост «${(await t.toasts()).join(' / ') || '—'}»)`);
  return ad;
}

export default {
  id: 'C23',
  title: 'Баннер из нашей панели → у клиента на главной и в поиске → показы в панели; у бизнеса покупки баннера нет',
  personas: ['platform', 'client', 'owner'],
  fids: ['F-00-163'],
  steps: [
    {
      id: 'S1',
      title: 'Наша панель ставит баннер на главную приложения',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-163'],
      expect: '/platform/ads → «Новый баннер» → заголовок, картинка, «Главная приложения, вверху» → «Сохранить»; баннер «Идёт»',
      run: async (t) => {
        t.state.home = await createBanner(t, HOME_TITLE, /Главная приложения/);
        const db = await t.db();
        const others = ((db.areas?.platform ?? db.platform)?.ads ?? []).filter((a) => a.placementId === t.state.home.placementId && a.id !== t.state.home.id && !a.paused);
        t.state.othersOnHome = others.map((a) => a.title);
        t.note(`баннер ${t.state.home.id} · ${t.state.home.startDate}–${t.state.home.endDate}; на этом месте уже идут: ${t.state.othersOnHome.join(' | ') || '—'}`);
      },
    },
    {
      id: 'S2',
      title: 'Клиент видит новый баннер на главной с пометкой «Реклама»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-163'],
      expect: 'Главная: карточка «E2E Осенняя неделя красоты» с меткой «Реклама»; если на месте несколько баннеров — они чередуются, новый не прячется навсегда',
      needs: ['S1'],
      run: async (t) => {
        let seen = false;
        const shown = [];
        for (let i = 0; i < 3 && !seen; i++) {
          await t.go('client', '/', 'phone');
          const txt = await t.mainText();
          seen = txt.includes(HOME_TITLE);
          const other = t.state.othersOnHome.find((x) => txt.includes(x));
          shown.push(seen ? HOME_TITLE : other ?? '—');
        }
        t.note(`на главной за 3 открытия: ${shown.join(' / ')}`);
        t.assert(seen, `новый баннер не показан ни разу: главная берёт только первый баннер места (getActiveAds(...)[0]) — «${shown[0]}»; купленный период нового баннера проходит впустую`);
      },
    },
    {
      id: 'S3',
      title: 'Показ у клиента засчитан в нашей панели',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-163'],
      expect: 'Строка баннера в /platform/ads: «Показы» ≥ 1 после того, как клиент открыл главную',
      needs: ['S2'],
      run: async (t) => {
        const db = await t.db();
        const ad = ((db.areas?.platform ?? db.platform)?.ads ?? []).find((a) => a.id === t.state.home.id);
        const views = Object.values(ad?.stats ?? {}).reduce((s, d) => s + (d.views ?? 0), 0);
        await t.go('platform', '/platform/ads', 'desktop');
        const row = (await t.page.locator('tr', { hasText: HOME_TITLE }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
        t.note(`показов в базе ${views}; строка в панели «${row.slice(0, 120)}»`);
        t.assert(views >= 1, 'показ у клиента не засчитан');
      },
    },
    {
      id: 'S4',
      title: 'Наша панель ставит баннер над результатами поиска',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-163'],
      expect: '«Новый баннер» → «Поиск, над результатами» → сохранён',
      run: async (t) => {
        t.state.search = await createBanner(t, SEARCH_TITLE, /Поиск, над результатами/);
      },
    },
    {
      id: 'S5',
      title: 'Клиент видит баннер над результатами поиска',
      persona: 'client',
      area: 'client',
      fids: ['F-00-163'],
      expect: '/search: над списком мастеров — «E2E Новые мастера рядом» с меткой «Реклама»',
      needs: ['S4'],
      run: async (t) => {
        await t.go('client', '/search', 'phone');
        const txt = await t.mainText();
        t.assert(
          txt.includes(SEARCH_TITLE),
          'баннер места «Поиск, над результатами» клиенту не показан: панель продаёт это место (4 000 ֏ в день), а поиск объявления места pl_banner_search не читает',
        );
      },
    },
    {
      id: 'S6',
      title: 'У бизнеса нет кнопки «купить баннер» — только сторис за монеты',
      persona: 'owner',
      area: 'client',
      fids: ['F-00-163'],
      expect: '/biz/apps и продвижение: сторис и продвижение есть, «баннер» купить нельзя',
      run: async (t) => {
        await t.go('owner', '/biz/apps', 'desktop');
        const txt = await t.mainText();
        const btn = await t.page.getByRole('button', { name: /баннер/i }).count();
        t.assert(!btn && !/купить баннер/i.test(txt), 'в кабинете есть покупка баннера');
      },
    },
  ],
};
