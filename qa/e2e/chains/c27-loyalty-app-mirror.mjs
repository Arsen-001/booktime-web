// C27 · Абонементы, сертификаты и карты клиента — одни и те же в кабинете и в приложении (F-00-196, F-00-197,
// F-06-147). q4: раздел loyalty построен (типы, проданные абонементы, сертификаты, карты), а приложение клиента
// (client) держит СВОИ копии: memberships / certificates / cashbackCards / membershipTemplates в срезе client.
// Цепочка идёт в обратную сторону от C21: что салон ведёт у себя → то же видит клиент; что салон выставил на
// продажу онлайн → это клиент и может купить; и то же видит администратор в окне записи.
// Хозяин абонементов и сертификатов — loyalty (AREAS «Хозяева сущностей»).
import { Fail, extFileIsStub } from '../lib.mjs';
import { clientBook, openInJournal } from '../helpers.mjs';

const NURI = 'biz_nuri';
const ANI_PHONE = '+37400160001'; // персона client (au_01) — Ани Мелкумян
const TYPE_ID = 'lmt_biz_nuri_0'; // «Маникюр × 5» — активный тип абонемента Nuri в сиде loyalty
const ONLINE_TITLE = 'E2E Абонемент онлайн';

/** Карточки клиента Ани во всех бизнесах (ключ — телефон, F-00-128) */
function aniCards(db) {
  return db.core.clients.filter((c) => c.phone === ANI_PHONE).map((c) => ({ id: c.id, businessId: c.businessId }));
}
function bizName(db, id) {
  return db.core.businesses.find((b) => b.id === id)?.name ?? id;
}
function title(x) {
  if (!x) return '';
  return typeof x === 'string' ? x : (x.ru ?? Object.values(x)[0] ?? '');
}

export default {
  id: 'C27',
  title: 'Абонементы, сертификаты, карты: что ведёт салон (loyalty) — то же видит и покупает клиент (client) и админ в окне записи',
  personas: ['owner', 'client', 'admin'],
  fids: ['F-00-196', 'F-00-197', 'F-06-147', 'F-00-010'],
  steps: [
    {
      id: 'S1',
      title: 'Салон видит проданные абонементы с клиентом',
      persona: 'owner',
      area: 'loyalty',
      fids: ['F-00-197'],
      expect: '/biz/loyalty/memberships — строки «тип · статус · остаток · до · клиент»; у Ани Мелкумян (+374 00 160 001) свой абонемент',
      run: async (t) => {
        await t.openOrWait('owner', '/biz/loyalty/memberships', 'loyalty');
        const db = await t.db();
        const ids = aniCards(db).map((c) => c.id);
        const L = db.areas.loyalty ?? {};
        const typeName = (id) => (L.membershipTypes ?? []).find((x) => x.id === id)?.name ?? id;
        t.state.loyaltyMem = (L.memberships ?? [])
          .filter((m) => ids.includes(m.clientId))
          .map((m) => ({ businessId: m.businessId, name: typeName(m.membershipTypeId), left: m.balanceVisits, total: m.totalVisits, status: m.status }));
        t.note(`у Ани в loyalty: ${t.state.loyaltyMem.map((m) => `${bizName(db, m.businessId)} «${m.name}» ${m.left}/${m.total}`).join('; ') || 'нет'}`);
        const txt = await t.mainText();
        const flat = txt.replace(/[\s\u00a0\u202f]/g, '');
        t.assert(flat.includes(ANI_PHONE) || /Ани Мелкумян/.test(txt), 'в списке абонементов салона нет Ани Мелкумян (ни имени, ни номера +374 00 160 001)');
        if (!/Ани Мелкумян/.test(txt)) t.note('клиент в списке абонементов показан только номером, без имени (minor, loyalty)');
      },
    },
    {
      id: 'S2',
      title: 'Клиент видит в приложении тот же абонемент, что ведёт салон',
      persona: 'client',
      area: 'client',
      fids: ['F-00-197', 'F-00-010'],
      expect: '/memberships — абонемент Nuri Nail Studio с тем же названием и остатком, что в кабинете (loyalty); ничего сверх него',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', '/memberships');
        const db = await t.db();
        const txt = await t.mainText();
        const app = (db.areas.client?.memberships ?? [])
          .filter((m) => m.appUserId === 'au_01' && m.active)
          .map((m) => ({ businessId: m.businessId, name: title(m.title), left: m.visitsLeft, total: m.visitsTotal }));
        t.note(`в приложении: ${app.map((m) => `${bizName(db, m.businessId)} «${m.name}» ${m.left}/${m.total}`).join('; ') || 'нет'}`);
        const nuriSalon = t.state.loyaltyMem.filter((m) => m.businessId === NURI && m.status !== 'expired');
        const nuriApp = app.filter((m) => m.businessId === NURI);
        const miss = nuriSalon.filter((s) => !txt.includes(s.name));
        const extra = nuriApp.filter((a) => !nuriSalon.some((s) => s.name === a.name));
        t.assert(
          !miss.length && !extra.length,
          `приложение и кабинет расходятся по абонементам Ани в Nuri: салон ведёт ${nuriSalon.map((s) => `«${s.name}» ${s.left}/${s.total}`).join(', ') || 'ничего'}, клиент видит ${nuriApp.map((a) => `«${a.name}» ${a.left}/${a.total}`).join(', ') || 'ничего'} — приложение читает свой срез client.memberships, а не loyalty.memberships`,
        );
      },
    },
    {
      id: 'S3',
      title: 'Сертификаты: у клиента — те же, что у салона, с тем же остатком',
      persona: 'client',
      area: 'client',
      fids: ['F-00-196'],
      expect: '/certificates — активные сертификаты Ани = сертификаты loyalty на её карточки (остаток тот же); погашенный в салоне у клиента не «активен»',
      run: async (t) => {
        await t.go('client', '/certificates');
        const db = await t.db();
        const ids = aniCards(db).map((c) => c.id);
        const salon = (db.areas.loyalty?.certificates ?? []).filter((c) => ids.includes(c.clientId)).map((c) => ({ businessId: c.businessId, balance: c.balance, status: c.status }));
        const app = (db.areas.client?.certificates ?? []).filter((c) => c.appUserId === 'au_01' && c.active).map((c) => ({ businessId: c.businessId, balance: c.balance, name: title(c.title) }));
        t.note(`салон (loyalty): ${salon.map((c) => `${bizName(db, c.businessId)} ${c.balance} ֏ ${c.status}`).join('; ') || 'нет'}; приложение: ${app.map((c) => `${bizName(db, c.businessId)} ${c.balance} ֏`).join('; ') || 'нет'}`);
        const orphan = app.filter((a) => !salon.some((s) => s.businessId === a.businessId && s.balance === a.balance && s.status !== 'used'));
        t.assert(
          !orphan.length,
          `клиент видит действующий сертификат, которого салон не знает (или уже погасил): ${orphan.map((a) => `${bizName(db, a.businessId)} остаток ${a.balance} ֏`).join(', ')} — у салона по этим карточкам ${salon.map((c) => `${c.balance} ֏ «${c.status}»`).join(', ') || 'сертификатов нет'}; приложение читает client.certificates`,
        );
      },
    },
    {
      id: 'S4',
      title: 'Карты лояльности: у клиента — те же, что выдал салон',
      persona: 'client',
      area: 'client',
      fids: ['F-06-001', 'F-00-010'],
      expect: '/loyalty-cards — карты Ани = карты loyalty на её карточки (тип, скидка/кэшбэк)',
      run: async (t) => {
        await t.go('client', '/loyalty-cards');
        const db = await t.db();
        const ids = aniCards(db).map((c) => c.id);
        const L = db.areas.loyalty ?? {};
        const typeName = (id) => (L.cardTypes ?? []).find((x) => x.id === id)?.name ?? id;
        const salon = (L.cards ?? []).filter((c) => ids.includes(c.clientId)).map((c) => ({ businessId: c.businessId, name: `${typeName(c.cardTypeId)} №${c.number}, бонусов ${c.balance} ֏` }));
        const appCards = db.areas.client?.cashbackCards ?? [];
        const app = (Array.isArray(appCards) ? appCards : Object.values(appCards)).filter((c) => c.appUserId === 'au_01').map((c) => ({ businessId: c.businessId, name: `№${c.cardNumber}, бонусов ${c.balance} ֏` }));
        t.note(`салон (loyalty.cards): ${salon.map((c) => `${bizName(db, c.businessId)} «${c.name}»`).join('; ') || 'нет'}; приложение (client.cashbackCards): ${app.map((c) => `${bizName(db, c.businessId)} «${c.name}»`).join('; ') || 'нет'}`);
        const onlyApp = app.filter((a) => !salon.some((s) => s.businessId === a.businessId));
        const onlySalon = salon.filter((s) => !app.some((a) => a.businessId === s.businessId));
        t.assert(
          !onlyApp.length && !onlySalon.length,
          `карты расходятся: только в приложении — ${onlyApp.map((a) => bizName(db, a.businessId)).join(', ') || 'нет'}; только у салона — ${onlySalon.map((s) => `${bizName(db, s.businessId)} «${s.name}»`).join(', ') || 'нет'}`,
        );
      },
    },
    {
      id: 'S5',
      title: 'Владелец выставляет тип абонемента на продажу онлайн',
      persona: 'owner',
      area: 'loyalty',
      fids: ['F-06-147'],
      expect: `Тип «Маникюр × 5» → «Доступно для продажи онлайн» + название «${ONLINE_TITLE}» → «Сохранить настройки» → тост, onlineSale.enabled`,
      run: async (t) => {
        await t.openOrWait('owner', `/biz/loyalty/memberships/types/${TYPE_ID}`, 'loyalty');
        const sw = t.page.getByRole('switch').last();
        if (!(await sw.count())) t.fail('на карточке типа абонемента нет переключателя «Доступно для продажи онлайн»');
        if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
        await t.settle(300);
        const ttl = t.page.locator('input[placeholder="Как покажем клиенту в виджете"]').first();
        if (await ttl.count()) await ttl.fill(ONLINE_TITLE);
        await t.click('role=button[name="Сохранить настройки"]', { after: 900 });
        const db = await t.db();
        const type = (db.areas.loyalty?.membershipTypes ?? []).find((x) => x.id === TYPE_ID);
        t.state.type = type;
        t.note(`тост «${(await t.toasts()).join(' / ') || '—'}»; onlineSale ${JSON.stringify(type?.onlineSale ?? {}).slice(0, 120)}`);
        t.assert(type?.onlineSale?.enabled, 'после сохранения тип не отмечен «продаётся онлайн»');
      },
    },
    {
      id: 'S6',
      title: 'Клиент видит на странице салона именно этот абонемент и его цену',
      persona: 'client',
      area: 'client',
      fids: ['F-06-147', 'F-00-197'],
      expect: `/places/biz_nuri → «Покупки»: «${ONLINE_TITLE}» (или «Маникюр × 5») · 32 000 ֏; абонементов, которых салон не продаёт, нет`,
      needs: ['S5'],
      run: async (t) => {
        await t.go('client', `/places/${NURI}`);
        const txt = await t.mainText();
        const i = txt.indexOf('Покупки');
        const block = i >= 0 ? txt.slice(i, i + 400).replace(/\n+/g, ' · ') : '';
        t.note(`«Покупки»: «${block.slice(0, 200)}»`);
        const price = t.state.type?.price;
        const shown = txt.includes(ONLINE_TITLE) || txt.includes('Маникюр × 5');
        t.assert(
          shown,
          `выставленного салоном абонемента на странице нет${block ? ` — там «${block.slice(0, 140)}»` : ''}; приложение показывает свои шаблоны client.membershipTemplates («Абонемент на 10 визитов» у всех бизнесов одинаковый), а не типы loyalty с onlineSale${price ? ` (цена типа ${price} ֏)` : ''}`,
        );
      },
    },
    {
      id: 'S7',
      title: 'Администратор в окне записи видит абонемент клиента, которым можно оплатить визит',
      persona: 'admin',
      area: 'loyalty',
      fids: ['F-00-197', 'F-06-100'],
      expect: 'Клиент записался в Nuri → окно записи → блок «Лояльность» называет абонемент Ани (как в /biz/loyalty/memberships) и остаток визитов',
      needs: ['S1'],
      run: async (t) => {
        const r = await clientBook(t, { staffId: 'st_nuri_ani', service: 'Маникюр классический' });
        t.state.booking = r.booking;
        const dlg = await openInJournal(t, 'admin', r.booking);
        const txt = await dlg.innerText();
        const i = txt.indexOf('Лояльность');
        const block = i >= 0 ? txt.slice(i, i + 200).replace(/\n+/g, ' · ') : '';
        t.note(`запись ${r.booking.id}; блок «Лояльность»: «${block.slice(0, 160)}»`);
        const nuri = t.state.loyaltyMem.filter((m) => m.businessId === NURI && m.status !== 'expired');
        if (!nuri.length) throw new Fail('у Ани в Nuri нет абонемента в loyalty — проверять нечего (сид сдвинулся)');
        const hit = nuri.some((m) => txt.includes(m.name));
        if (!hit && extFileIsStub('loyalty', 'BookingWindow')) t.wait('loyalty', `вклад loyalty в окно записи — заглушка; блок «Лояльность» окна (${block.slice(0, 80) || 'пусто'}) абонемент «${nuri[0].name}» не называет`);
        t.assert(hit, `в окне записи нет абонемента клиента «${nuri.map((m) => m.name).join(', ')}» — блок «Лояльность»: «${block.slice(0, 120)}»`);
      },
    },
  ],
};
