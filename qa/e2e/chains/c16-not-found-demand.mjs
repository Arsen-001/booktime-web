// C16 · «Не нашли? Кого ищете» (F-00-112) → отчёт «спрос без предложения» в нашей панели (F-00-180) →
// куда идти с визитами. Клиент пишет в одно место, панель читает из другого — сверяем, что спрос доходит.
import { Fail } from '../lib.mjs';

const QUERY = 'татуаж бровей';
const WISH = 'Мастер татуажа бровей в Кентроне';

export default {
  id: 'C16',
  title: '«Никого не нашли» → «Сообщить, когда появится» → спрос в нашей панели',
  personas: ['client', 'platform'],
  fids: ['F-00-112', 'F-00-180', 'F-00-202'],
  steps: [
    {
      id: 'S1',
      title: 'Пустой поиск предлагает «Сообщить, когда появится»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-112'],
      expect: '/search «татуаж бровей» → «Никого не нашли» + поле «Кого ищете» + кнопка «Сообщить, когда появится»',
      run: async (t) => {
        await t.go('client', '/search');
        await t.fill('input[placeholder="Что ищете?"]', QUERY);
        await t.settle(1200);
        await t.expectText('Никого не нашли');
        await t.expectText('Сообщить, когда появится');
      },
    },
    {
      id: 'S2',
      title: 'Клиент оставляет просьбу с номером',
      persona: 'client',
      area: 'client',
      fids: ['F-00-112'],
      expect: 'Текст «кого ищете» + номер → «Сообщить, когда появится» → тост; просьба сохранена с районом и сферой',
      needs: ['S1'],
      run: async (t) => {
        const before = await t.db();
        const n0 = (before.areas.client?.demandLeads ?? []).length;
        const p0 = (before.areas.platform?.demandEntries ?? []).length;
        await t.fill('input[placeholder^="Например"]', WISH);
        await t.fill('main input[type="tel"]', '00177702');
        await t.click('role=button[name="Сообщить, когда появится"]', { after: 900 });
        const toasts = await t.toasts();
        const db = await t.db();
        const leads = db.areas.client?.demandLeads ?? [];
        const entries = db.areas.platform?.demandEntries ?? [];
        t.state.lead = leads[leads.length - 1];
        t.state.toPlatform = entries.length > p0;
        t.note(`тост «${toasts.join(' / ') || '—'}»; client.demandLeads ${n0}→${leads.length}; platform.demandEntries ${p0}→${entries.length}; просьба ${JSON.stringify(t.state.lead ?? {})}`);
        t.assert(leads.length > n0 || entries.length > p0, 'просьба не сохранилась ни у клиента, ни в панели');
      },
    },
    {
      id: 'S3',
      title: 'Наша панель «Спрос» показывает этот запрос',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-180'],
      expect: '/platform/demand → строка «татуаж» (район, 1 человек за неделю)',
      needs: ['S2'],
      run: async (t) => {
        await t.go('platform', '/platform/demand', 'desktop');
        const txt = await t.mainText();
        t.assert(/татуаж/i.test(txt), `просьбы клиента нет в отчёте спроса: приложение пишет в client.demandLeads, панель читает platform.demandEntries (reportSearchDemand никто не зовёт)${t.state.toPlatform ? '' : ' — в panel.demandEntries запись не появилась'}`);
      },
    },
    {
      id: 'S4',
      title: 'В спросе считается район и разные люди, а не поиски',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-180', 'F-00-112'],
      expect: 'У запроса есть район (по геолокации/профилю) и счёт «людей», повторная просьба того же человека не удваивает число',
      needs: ['S3'],
      run: async (t) => {
        const db = await t.db();
        const e = (db.areas.platform?.demandEntries ?? []).filter((x) => /татуаж/i.test(x.query));
        t.assert(e.length && e.every((x) => x.district && x.appUserId), `у записи спроса нет района или человека: ${JSON.stringify(e[0] ?? {})}`);
      },
    },
    {
      id: 'S5',
      title: 'Когда такой мастер появился в районе — клиенту пуш',
      persona: 'client',
      area: 'platform',
      fids: ['F-00-112'],
      expect: 'Подключили мастера сферы/района → клиенту «Появился мастер, которого вы искали»',
      pending: 'platform',
      pendingWhy: 'связи «подключили салон ↔ спрос» нет ни в панели, ни в уведомлениях клиента (F-00-112 «Готово, когда» п.2)',
    },
  ],
};
