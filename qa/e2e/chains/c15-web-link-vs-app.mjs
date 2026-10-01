// C15 · Запись по ссылке салона (/b/<slug>, F-00-006/F-00-007) — второй путь записи. Сверяем, что он и
// запись из приложения дают в журнал и CRM одно и то же (сейчас это два разных кода).
import { Fail } from '../lib.mjs';
import { journalBlockText } from '../helpers.mjs';

const SLUG = 'nuri-nail-studio';
const PHONE_LOCAL = '99123456';
const PHONE = '+37499123456';
const NAME = 'Веб Клиентова';

export default {
  id: 'C15',
  title: 'Запись по ссылке салона → журнал и CRM; сверка с записью из приложения',
  personas: ['guest', 'admin', 'client'],
  fids: ['F-00-006', 'F-00-007', 'F-00-093', 'F-00-128', 'F-00-067'],
  steps: [
    {
      id: 'S1',
      title: 'Публичная страница салона открывается без входа',
      persona: 'guest',
      area: 'online',
      fids: ['F-00-006', 'F-00-007'],
      expect: '/b/nuri-nail-studio — название, услуги',
      run: async (t) => {
        await t.go('guest', `/b/${SLUG}`);
        await t.expectText('Nuri');
      },
    },
    {
      id: 'S2',
      title: 'Запись по ссылке: услуга → мастер → время → имя и телефон → «Записаться»',
      persona: 'guest',
      area: 'online',
      fids: ['F-00-007', 'F-00-092'],
      expect: 'Мастер → услуга → время → имя, телефон, код → «Записаться» → запись создана',
      run: async (t) => {
        const before = await t.db();
        const known = new Set(before.core.bookings.map((b) => b.id));
        await t.go('guest', `/b/${SLUG}/book`);
        // q3: первый шаг ссылки — «Что вы хотите записать?» (индивидуальная / групповое занятие)
        const solo = t.page.getByRole('button', { name: 'Индивидуальная запись' });
        if (await solo.count()) await t.click('role=button[name="Индивидуальная запись"]', { after: 600 });
        // q4: поток ссылки стал Услуги → Мастер → Время → Детали (было: Мастер → Услуги); поддерживаем оба порядка
        const pickService = async () => {
          await t.click('text="Маникюр классический"', { after: 300 }); // точное совпадение: не пакет «Комплекс: Маникюр классический + …»
          await t.click('role=button[name=/Продолжить/]', { after: 700 });
        };
        const pickMaster = async () => {
          await t.click('button:has-text("Ани Саргсян")', { after: 500 });
          // «Кого принимает мастер» (F-00-069): модалка у мастера «только женщин»
          const acc = t.page.locator('[role="dialog"]', { hasText: 'Кого принимает' });
          if (await acc.count()) {
            t.state.acceptsModal = (await acc.innerText()).replace(/\n+/g, ' ').slice(0, 120);
            await acc.getByRole('button', { name: 'Понятно' }).click();
            await t.settle(300);
          }
          await t.click('role=button[name=/Продолжить/]', { after: 700 });
        };
        const serviceFirst = !(await t.page.locator('button:has-text("Ани Саргсян")').count());
        if (serviceFirst) {
          await pickService();
          await pickMaster();
        } else {
          await pickMaster();
          await pickService();
        }
        const slot = t.page.getByRole('button', { name: /^\d\d:\d\d$/ }).first();
        await slot.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {
          throw new Fail('в шаге «Время» нет ни одного окна');
        });
        await slot.click();
        await t.settle(300);
        await t.click('role=button[name=/Продолжить/]', { after: 700 });
        await t.fill('input[placeholder="Введите имя"]', NAME);
        await t.fill('input[type=tel]', PHONE_LOCAL);
        await t.click('role=button[name="Получить код"]', { after: 500 });
        // демо-код ссылки — случайный, показан тостом (в приложении клиента код всегда 0000)
        const code = ((await t.toasts()).join(' ').match(/\b(\d{4})\b/) ?? [])[1] ?? '0000';
        t.state.code = code;
        await t.fill('input[placeholder="0000"]', code);
        await t.click('role=button[name="Подтвердить"]', { after: 500 });
        const consent = t.page.locator('input[type=checkbox]').last();
        if (!(await consent.isChecked())) {
          await t.page.getByText('Согласен на обработку персональных данных').first().click();
          await t.settle(200);
        }
        await t.click('role=button[name="Записаться"]', { after: 1500 });
        const after = await t.db();
        const created = after.core.bookings.filter((b) => !known.has(b.id));
        if (!created.length) throw new Fail(`запись по ссылке не создана (тосты: ${(await t.toasts()).join(' / ') || '—'})`);
        t.state.booking = created[created.length - 1];
        t.state.db = after;
        const staff = after.core.staff.find((s) => s.id === t.state.booking.staffId);
        t.state.staff = staff;
        if (t.state.acceptsModal) t.note(`модалка при выборе мастера: «${t.state.acceptsModal}»`);
        t.note(`запись ${t.state.booking.id} ${t.state.booking.start} к ${staff.name} (confirmMode ${staff.confirmMode}), статус ${t.state.booking.status}, источник ${t.state.booking.source}`);
      },
    },
    {
      id: 'S3',
      title: 'Карточка клиента в CRM по номеру создана и связана с записью',
      persona: 'admin',
      area: 'online',
      fids: ['F-00-128'],
      expect: 'Клиент +37499123456 в Nuri, booking.clientId на него',
      needs: ['S2'],
      run: async (t) => {
        const crm = t.state.db.core.clients.find((c) => c.businessId === 'biz_nuri' && c.phone === PHONE);
        t.assert(crm && t.state.booking.clientId === crm.id, 'карточка не создана или не связана');
      },
    },
    {
      id: 'S4',
      title: 'Администратор видит запись с именем и меткой онлайн-записи',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-093', 'F-01-026'],
      expect: 'Блок с «Веб К.»; шапка блока — цвет онлайн-записи',
      needs: ['S2'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const blocks = await journalBlockText(t, b);
        t.assert(blocks.some((x) => x.includes('Веб К.')), `в журнале: «${blocks.join(' || ').replace(/\n/g, ' · ')}»`);
      },
    },
    {
      id: 'S5',
      title: 'Два пути записи дают одинаковый статус по правилу мастера',
      persona: 'client',
      area: 'client',
      fids: ['F-00-067'],
      expect: 'К тому же мастеру через приложение — тот же статус, что по ссылке',
      needs: ['S2'],
      run: async (t) => {
        const { clientBook } = await import('../helpers.mjs');
        const { booking } = await clientBook(t, { staffId: t.state.staff.id });
        t.assert(booking.status === t.state.booking.status, `по ссылке: «${t.state.booking.status}», через приложение: «${booking.status}» — один мастер, два разных правила`);
        t.assert(Boolean(booking.clientId) === Boolean(t.state.booking.clientId), `по ссылке запись связана с CRM (clientId ${t.state.booking.clientId}), через приложение — нет (${booking.clientId ?? 'пусто'})`);
      },
    },
    {
      id: 'S6',
      title: '«Кого принимает мастер» — одинаково в приложении и по ссылке',
      persona: 'client',
      area: 'client',
      fids: ['F-00-069', 'F-00-070'],
      expect: 'Запись к Ани («только женщин») в приложении открывает ту же модалку «Кого принимает мастер», что и страница по ссылке',
      run: async (t) => {
        await t.go('client', '/book?staff=st_nuri_ani');
        const radios = t.page.getByRole('radio');
        if (await radios.count()) {
          await radios.first().click();
          await t.click('role=button[name="Продолжить"]');
        }
        const txt = await t.text();
        t.assert(/принимает только/i.test(txt), 'в записи через приложение модалки «принимает только женщин» нет (по ссылке /b/… она есть) — правило видно только бейджем на карточке');
      },
    },
  ],
};
