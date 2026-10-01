// C01 · «Свободно сегодня рядом» → запись с оттенком → журнал → подтверждение → «пришёл» → оплата →
// склад → зарплата → отчёты → звёздочка. Главная цепочка продукта (F-00-001).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib.mjs';
import { extFileIsStub as _extStub } from '../lib.mjs';
import { clientBook, crmClientByPhone, bookingById, journalBlockText, openInJournal, setStatusInJournal } from '../helpers.mjs';

const ANI = 'st_nuri_ani';

export default {
  id: 'C01',
  title: '«Свободно сегодня рядом» → запись → журнал → пришёл → деньги → звёздочка',
  personas: ['client', 'admin', 'master'],
  fids: ['F-00-001', 'F-00-108', 'F-00-109', 'F-00-092', 'F-00-093', 'F-00-094', 'F-00-067', 'F-00-127', 'F-00-194', 'F-00-136', 'F-00-193', 'F-00-131', 'F-00-116', 'F-00-118'],
  steps: [
    {
      id: 'S1',
      title: 'Главная: блок «Свободно рядом» с окнами на сегодня',
      persona: 'client',
      area: 'client',
      fids: ['F-00-001', 'F-00-108'],
      expect: 'Без поиска видно мастеров с ближайшими окнами «Сегодня, ЧЧ:ММ»',
      run: async (t) => {
        await t.go('client', '/');
        await t.expectText('Свободно рядом');
        await t.expectText(/Сегодня, \d{2}:\d{2}/, 'в «Свободно рядом» нет ни одного окна на сегодня');
      },
    },
    {
      id: 'S2',
      title: 'Поиск → «Рядом со мной» (геолокация разрешена) сортирует по расстоянию',
      persona: 'client',
      area: 'client',
      fids: ['F-00-109'],
      expect: 'Кнопка спрашивает геолокацию по нажатию; список сортируется, ближе всех — мастера Кентрона',
      run: async (t) => {
        await t.go('client', '/search');
        await t.click('role=button[name=/Рядом со мной/]', { after: 900 });
        await t.expectText('Сортировка по расстоянию', 'после нажатия нет пометки «Сортировка по расстоянию»');
        // q3: первая ссылка карточки — аватар без текста; берём первую с подписью
        const first = await t.page.locator('main a[href^="/masters/"]').filter({ hasText: /\S/ }).first().innerText();
        t.assert(/Кентрон/.test(first), `первым в списке «рядом» стоит не Кентрон: «${first.replace(/\n/g, ' · ').slice(0, 90)}»`);
      },
    },
    {
      id: 'S3',
      title: 'Нажатие на окно в карточке мастера ведёт сразу в запись в это окно',
      persona: 'client',
      area: 'client',
      fids: ['F-00-108', 'F-00-031'],
      expect: 'Окно «Сегодня, ЧЧ:ММ» у Ани Саргсян → /book с этим окном, шаг «Время» пропущен',
      run: async (t) => {
        await t.go('client', `/masters/${ANI}`);
        const link = t.page.locator(`a[href*="/book?staff=${ANI}"][href*="slot="]`).first();
        t.assert(await link.count(), 'в карточке мастера нет ссылок-окон');
        const href = await link.getAttribute('href');
        await link.click();
        await t.settle(500);
        t.assert(t.page.url().includes('slot='), `после нажатия на окно адрес без окна: ${t.page.url()}`);
        await t.expectNoText('Выберите время', 'окно уже выбрано, а поток снова просит «Выберите время»');
        t.state.slotHref = href;
      },
    },
    {
      id: 'S4',
      title: 'Запись: услуга «гель-лак» → оттенок из палитры → «Подтвердить запись»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092', 'F-00-094'],
      expect: 'Запись создана одним потоком, выбранный оттенок сохранён на записи',
      run: async (t) => {
        const { booking, db } = await clientBook(t, { staffId: ANI, service: 'Маникюр с покрытием гель-лаком', shade: 'гель-лак' });
        t.state.booking = booking;
        t.state.dbAfterBook = db;
        const shade = db.areas.client?.bookingShade?.[booking.id];
        t.assert(shade, 'оттенок не сохранён на записи');
        t.note(`запись ${booking.id} на ${booking.start}, статус ${booking.status}, источник ${booking.source}, оттенок ${JSON.stringify(shade)}`);
      },
    },
    {
      id: 'S5',
      title: 'Оттенки — из склада салона (что в наличии), а не из списка материалов услуги',
      persona: 'client',
      area: 'stock',
      fids: ['F-00-094', 'F-00-143', 'F-00-096'],
      expect: 'Палитра берётся из склада; оттенок с нулевым остатком не предлагается',
      run: async (t) => {
        await t.openOrWait('admin', '/biz/stock', 'stock', 'склада нет — палитра сейчас из Service.materials, «под заказ» каждый 3-й материал (заглушка client)');
        // q4: склад построен — в Nuri гель-лаки «Розовый нюд», «Красный классик» (просрочен), «Бордо». Что предлагает запись?
        const db = await t.db();
        const goods = (db.areas.stock?.goods ?? []).filter((g) => g.locationId === 'loc_nuri' && /гель-лак/i.test(g.name) && !g.archived);
        await t.go('client', `/book?staff=${ANI}`, 'phone');
        if (await t.page.getByRole('radio').count()) {
          await t.click('text=Маникюр с покрытием гель-лаком');
          await t.click('role=button[name="Продолжить"]');
        }
        await t.page.locator('button.min-h-11').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        await t.page.locator('button.min-h-11').first().click();
        await t.settle(500);
        const txt = await t.mainText();
        const i = txt.indexOf('Оттенок или вариант');
        const block = i >= 0 ? txt.slice(i, i + 400).replace(/\n+/g, ' · ') : '';
        t.note(`склад Nuri (гель-лаки): ${goods.map((g) => g.name).join(', ') || '—'}; шаг «Оттенок»: «${block.slice(0, 200) || 'нет шага'}»`);
        const shown = goods.filter((g) => block.includes(g.name.replace(/^Гель-лак\s*/i, '').replace(/[«»]/g, '')) || block.includes(g.name));
        t.assert(
          goods.length && shown.length,
          `палитра записи не из склада: клиент выбирает из «${block.slice(0, 120) || '—'}» (Service.materials), а на складе салона ${goods.map((g) => `«${g.name}»`).join(', ')} — оттенки из склада (F-00-143) клиент не видит`,
        );
      },
    },
    {
      id: 'S6',
      title: 'Мастер «сразу»: запись создаётся подтверждённой, окно закрыто',
      persona: 'client',
      area: 'client',
      fids: ['F-00-067'],
      expect: 'У Ани confirmMode = instant → статус «Подтверждена» (scheduled), а не «Ждёт подтверждения»',
      needs: ['S4'],
      run: async (t) => {
        const b = t.state.booking;
        t.assert(b.status === 'scheduled', `статус новой записи «${b.status}» при confirmMode мастера = instant (онлайн-запись /b/… ставит scheduled)`);
      },
    },
    {
      id: 'S7',
      title: 'Запись попала в «Мои записи» с меткой источника',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092', 'F-00-093'],
      expect: '/bookings → «Предстоящие» содержит новую запись; источник — «через приложение»',
      needs: ['S4'],
      run: async (t) => {
        await t.go('client', '/bookings');
        await t.expectText('Маникюр с покрытием гель-лаком');
        t.assert(t.state.booking.source === 'app', `источник записи ${t.state.booking.source}, ждали app`);
      },
    },
    {
      id: 'S8',
      title: 'Клиент приложения связан с карточкой CRM салона по номеру',
      persona: 'client',
      area: 'client',
      fids: ['F-00-128', 'F-00-001'],
      expect: 'booking.clientId = карточка Nuri с номером клиента (+37400160001); вторая карточка не создаётся',
      needs: ['S4'],
      run: async (t) => {
        const db = t.state.dbAfterBook;
        const user = db.core.appUsers.find((u) => u.id === 'au_01');
        const crm = crmClientByPhone(db, 'biz_nuri', user.phone);
        t.assert(crm, 'в CRM Nuri нет карточки с номером клиента');
        t.assert(t.state.booking.clientId === crm.id, `запись из приложения без clientId (${t.state.booking.clientId ?? 'пусто'}) — CRM-карточка ${crm.id} «${crm.name}» к ней не привязана`);
      },
    },
    {
      id: 'S9',
      title: 'Администратор видит запись в журнале с именем клиента',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-001', 'F-01-026'],
      expect: 'Блок в колонке Ани на это время; имя «Ани М.», а не «Без клиента»',
      needs: ['S4'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const blocks = (await journalBlockText(t, b)).filter((x) => x.includes('гель-лаком'));
        t.assert(blocks.length, 'записи клиента нет в журнале администратора');
        t.state.blockText = blocks[0];
        t.assert(!blocks[0].includes('Без клиента'), `в журнале запись показана «Без клиента»: «${blocks[0].replace(/\n/g, ' · ')}»`);
      },
    },
    {
      id: 'S10',
      title: 'В окне записи видны источник «через приложение» и выбранный оттенок',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-093', 'F-00-094'],
      expect: 'Окно записи показывает «Записался через приложение» и оттенок «гель-лак»',
      needs: ['S4'],
      run: async (t) => {
        const dlg = await openInJournal(t, 'admin', t.state.booking);
        const txt = await dlg.innerText();
        const miss = [];
        if (!/приложени/i.test(txt)) miss.push('источник «через приложение»');
        if (!/гель-лак/i.test(txt.replace(/Маникюр с покрытием гель-лаком/g, ''))) miss.push('оттенок');
        t.assert(!miss.length, `в окне записи нет: ${miss.join(', ')}`);
      },
    },
    {
      id: 'S11',
      title: 'Мастер подтверждает запись из журнала',
      persona: 'master',
      area: 'journal',
      fids: ['F-00-067'],
      expect: 'Ани (персона master) открывает запись и ставит «Подтверждена»; статус сохраняется',
      needs: ['S4'],
      run: async (t) => {
        const updated = await setStatusInJournal(t, 'master', t.state.booking, 'scheduled');
        t.assert(updated.status === 'scheduled', `статус после сохранения «${updated.status}»`);
        t.note('подтверждение = открыть запись → выбрать статус → «Сохранить» (3 действия; ТЗ: «одним нажатием из уведомления» — ждёт notify)');
      },
    },
    {
      id: 'S12',
      title: 'Клиент видит решение мастера',
      persona: 'client',
      area: 'client',
      fids: ['F-00-067'],
      expect: '/bookings → запись «Подтверждена»',
      needs: ['S11'],
      run: async (t) => {
        await t.go('client', '/bookings');
        const card = t.page.locator('main a', { hasText: 'гель-лаком' }).first();
        const txt = await card.innerText();
        t.assert(/Подтверждена/.test(txt), `у клиента статус: «${txt.replace(/\n/g, ' · ')}»`);
      },
    },
    {
      id: 'S13',
      title: 'Администратор отмечает «Пришёл»',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-127', 'F-00-068'],
      expect: 'Статус «Пришёл» сохраняется; в истории записи видна смена статуса',
      needs: ['S4'],
      run: async (t) => {
        const updated = await setStatusInJournal(t, 'admin', t.state.booking, 'arrived');
        if (updated.__ui.confirm.length) t.note(`по пути: ${updated.__ui.confirm.join(' / ')}`);
        t.assert(updated.status === 'arrived', `статус после сохранения «${updated.status}»${updated.__ui.confirm.length ? `; диалог: «${updated.__ui.confirm.join(' / ')}»` : ''}${updated.__ui.toasts.length ? `; тост: «${updated.__ui.toasts.join(' / ')}»` : ''}`);
        t.state.arrived = updated;
      },
    },
    {
      id: 'S14',
      title: 'Оплата визита: сумма и способ (наличные / карта / перевод)',
      persona: 'admin',
      area: 'finance',
      fids: ['F-00-127', 'F-00-194'],
      expect: 'В окне записи вкладка «Оплата» (вклад finance) — сумма 9 000 ֏, способ',
      needs: ['S13'],
      run: async (t) => {
        const dlg = await openInJournal(t, 'admin', t.state.booking);
        const tab = dlg.getByRole('tab', { name: 'Оплата' });
        if (!(await tab.count())) {
          // окно прячет вкладки вкладов-заглушек: если вклад finance ещё ExtensionStub — это «ждёт», а не разрыв
          const src = fs.readFileSync(path.join(ROOT, 'src/areas/finance/extensions/BookingWindow.tsx'), 'utf8');
          if (/ExtensionStub/.test(src)) t.wait('finance', 'вклад finance в окно записи — заглушка (вкладки «Оплата» нет); «Оплатить» окна журнала проводит оплату без способа и пишет её только в journal.extras.paidAmount (см. C28)');
          t.fail('вклад finance построен, а вкладки «Оплата» в окне записи нет');
        }
        await tab.click();
        await t.settle(400);
        const txt = await dlg.innerText();
        if ((await t.isExtStub(dlg, 'finance')) || txt.includes('Здесь будет вклад раздела')) t.wait('finance', 'вкладка «Оплата» в окне записи — заглушка finance (в самом окне журнала есть «К оплате · Оплатить», но способ оплаты и сумма визита нигде не сохраняются)');
        t.assert(/Наличн|Карт|Перевод/i.test(txt), 'во вкладке «Оплата» нет способа оплаты');
      },
    },
    {
      id: 'S15',
      title: '«Пришёл» списывает расходники услуги по норме',
      persona: 'admin',
      area: 'stock',
      fids: ['F-00-136', 'F-00-135'],
      expect: 'Остаток гель-лака на складе уменьшился на норму техкарты; операция в истории',
      needs: ['S13'],
      run: async (t) => {
        await t.openOrWait('admin', '/biz/stock/operations', 'stock', '/biz/stock — заглушка, техкарт и остатков нет');
        // q4: склад построен (операции, есть тип «Списание расходников» с bookingId), техкарт — ещё нет
        const db = await t.db();
        const ops = (db.areas.stock?.operations ?? []).filter((o) => o.bookingId === t.state.booking.id);
        t.note(`складских операций по записи ${t.state.booking.id}: ${ops.map((o) => o.type).join(', ') || 'нет'}`);
        if (!ops.some((o) => o.type === 'writeoffService')) {
          await t.go('admin', '/biz/stock/tech-cards', 'desktop');
          if ((await t.isPlaceholder()) || _extStub('stock', 'BookingWindow')) t.wait('stock', 'техкарт ещё нет (/biz/stock/tech-cards — заглушка, вклад stock в окно записи — заглушка): «Пришёл» нечего списывать по норме');
          t.fail('техкарты есть, а «Пришёл» не списал расходники услуги (нет операции «Списание расходников» с bookingId визита)');
        }
      },
    },
    {
      id: 'S16',
      title: 'Зарплата мастера начислена процентом от визита',
      persona: 'owner',
      area: 'payroll',
      fids: ['F-00-193'],
      expect: 'Расчёт за день у Ани включает 9 000 ֏ × %',
      needs: ['S13'],
      run: async (t) => {
        await t.openOrWait('owner', `/biz/payroll/daily?date=${t.state.booking.start.slice(0, 10)}`, 'payroll', '/biz/payroll — заглушка');
        await t.expectText('Ани Саргсян', 'в расчёте за день нет мастера визита');
      },
    },
    {
      id: 'S17',
      title: 'Отчёт: выручка = сумма отмеченных визитов',
      persona: 'owner',
      area: 'reports',
      fids: ['F-00-131'],
      expect: 'Основные показатели за день выросли на 9 000 ֏',
      needs: ['S13'],
      run: async (t) => {
        await t.openOrWait('owner', '/biz/reports', 'reports', '/biz/reports — заглушка');
        t.fail('отчёты построены — дописать сверку выручки с отмеченным визитом');
      },
    },
    {
      id: 'S18',
      title: 'Клиент после «пришёл» ставит звёздочку — число на карточке мастера выросло',
      persona: 'client',
      area: 'client',
      fids: ['F-00-116', 'F-00-127', 'F-00-117'],
      expect: 'В записи «Понравилось? · Оценить мастера» → «Вы поставили звёздочку»; на карточке Ани «Понравилось N+1», без имён',
      needs: ['S13'],
      run: async (t) => {
        const count = async () => {
          await t.go('client', `/masters/${ANI}`);
          const m = (await t.mainText()).match(/Понравилось\s*(\d+)/);
          return m ? Number(m[1]) : 0;
        };
        const before = await count();
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.page.getByText('Понравилось?').first().waitFor({ timeout: 12000 }).catch(() => {});
        const btn = t.page.getByRole('button', { name: 'Оценить мастера' });
        if (!(await btn.count())) {
          const txt = await t.mainText();
          if (!/звёздочк|★|Понравилось/i.test(txt)) t.wait('client', 'звёздочки (F-00-116) нет в записи после «пришёл»');
          t.fail(`в записи после «пришёл» нет кнопки «Оценить мастера»: «${txt.slice(-200).replace(/\n+/g, ' · ')}»`);
        }
        await btn.click();
        await t.settle(600);
        if (!(await t.has('Вы поставили звёздочку'))) {
          t.note(`после первого нажатия звёздочка не встала (тост «${(await t.toasts()).join(' / ') || '—'}») — жмём ещё раз`);
          await t.page.getByRole('button', { name: 'Оценить мастера' }).click().catch(() => {});
          await t.settle(900);
        }
        await t.expectText('Вы поставили звёздочку', `звёздочка не ставится: после «Оценить мастера» экран без изменений (тост «${(await t.toasts()).join(' / ') || '—'}»)`);
        const after = await count();
        t.assert(after === before + 1, `на карточке мастера «Понравилось» было ${before}, стало ${after}`);
      },
    },
  ],
};
