// C04 · Отмена клиентом до срока → окно освободилось → лист ожидания получил уведомление;
// и то же самое, когда отменяет салон (журнал) — данные листа живут в срезе client.
import { Fail, addDays, today } from '../lib.mjs';
import { bookingById, clientBook, freeTimes, journalBlockText, setStatusInJournal, hm } from '../helpers.mjs';

const GAYANE = 'st_nuri_gayane';
const CLASSIC = 'Маникюр классический';

async function joinWaitlist(t, serviceName) {
  await t.go('client', `/masters/${GAYANE}`);
  await t.click('role=button[name="Сообщить, если освободится"]', { after: 500 });
  const dlg = t.page.locator('[role="dialog"]').last();
  const sel = dlg.locator('select').first();
  if (await sel.count()) await sel.selectOption({ label: serviceName }).catch(() => {});
  else if (await dlg.locator(`text=${serviceName}`).count()) await dlg.locator(`text=${serviceName}`).first().click();
  await dlg.locator('text=Любой день').first().click().catch(() => {});
  await dlg.getByRole('button', { name: 'Встать в очередь' }).click();
  await t.settle(600);
}

export default {
  id: 'C04',
  title: 'Отмена клиентом → окно свободно → лист ожидания; отмена салоном → лист ожидания',
  personas: ['client', 'admin'],
  fids: ['F-00-098', 'F-00-101', 'F-00-102', 'F-00-068'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент записывается к Гаяне через 2+ дня',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092'],
      expect: 'Запись создана',
      run: async (t) => {
        // q4: первый день ≥ +2 с окнами; «Это окно уже заняли» (окно предложено поверх занятого) — пишем и берём следующий день
        let r;
        const tried = [];
        for (let d = 2; d <= 9 && !r; d++) {
          r = await clientBook(t, { staffId: GAYANE, service: CLASSIC, date: addDays(today(), d) }).catch((e) => {
            tried.push(`${addDays(today(), d)}: ${e.message}`);
            return undefined;
          });
        }
        if (!r) throw new Fail(`не удалось записаться к Гаяне ни на один день +2…+9: ${tried.slice(0, 3).join('; ')}`);
        const taken = tried.filter((x) => x.includes('уже заняли'));
        if (taken.length) t.note(`⚠ приложение предложило окно, которое уже занято: ${taken.join('; ')}`);
        else if (tried.length) t.note(`пропущено: ${tried.join('; ')}`);
        const { booking } = r;
        t.state.booking = booking;
        t.note(`запись ${booking.id} ${booking.start}`);
      },
    },
    {
      id: 'S2',
      title: 'Клиент встаёт в лист ожидания к Гаяне (любой день)',
      persona: 'client',
      area: 'client',
      fids: ['F-00-102'],
      expect: 'Модалка «Лист ожидания» → «Встать в очередь»; запись видна в «Мой лист ожидания»',
      run: async (t) => {
        await joinWaitlist(t, CLASSIC);
        await t.go('client', '/bookings');
        await t.expectText('Мой лист ожидания');
        const db = await t.db();
        // Один лист ожидания (01.10.2026): заявка приложения лежит в resources.waitlist с appUserId
        const wl = db.areas.resources.waitlist.filter((w) => w.appUserId);
        t.assert(wl.length >= 1, `в листе ожидания ${wl.length} заявок из приложения`);
        t.state.wl1 = wl[0];
      },
    },
    {
      id: 'S3',
      title: 'Отмена раньше срока — без последствий',
      persona: 'client',
      area: 'client',
      fids: ['F-00-098'],
      expect: '«Отменить запись» → «Срок бесплатной отмены ещё не прошёл» → «Отменить запись» (в окне подтверждения) → «Запись отменена»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/bookings/${t.state.booking.id}`);
        await t.click('role=button[name="Отменить запись"]', { after: 400 });
        await t.expectText('Срок бесплатной отмены ещё не прошёл');
        await t.clickInDialog(/^(Да, отменить|Отменить запись)$/, { after: 900 });
        const db = await t.db();
        const b = bookingById(db, t.state.booking.id);
        t.assert(b.status === 'cancelled_by_client', `статус после отмены ${b.status}`);
      },
    },
    {
      id: 'S4',
      title: 'Освободившееся окно снова предлагается клиентам',
      persona: 'client',
      area: 'client',
      fids: ['F-00-101'],
      expect: 'В записи к Гаяне на тот день снова есть это время',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        const times = await freeTimes(t, GAYANE, b.start.slice(0, 10), CLASSIC);
        t.assert(times.includes(hm(b.start)), `окна ${hm(b.start)} нет среди свободных (${times.join(', ')})`);
      },
    },
    {
      id: 'S5',
      title: 'Лист ожидания: «Окно освободилось!»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-101', 'F-00-102'],
      expect: 'В «Мой лист ожидания» у записи к Гаяне пометка «Окно освободилось!»',
      needs: ['S2', 'S3'],
      run: async (t) => {
        await t.go('client', '/bookings');
        await t.expectText('Окно освободилось!');
      },
    },
    {
      id: 'S6',
      title: 'В журнале отменённая клиентом запись не занимает время',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-068', 'F-00-101'],
      expect: 'Блока на это время нет или он явно помечен «Отменена клиентом»',
      needs: ['S3'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const blocks = (await journalBlockText(t, b)).filter((x) => x.includes(CLASSIC));
        t.assert(!blocks.length || blocks.some((x) => /Отмен/.test(x)), `отменённая запись стоит в сетке как активная: «${blocks[0]?.replace(/\n/g, ' · ')}»`);
      },
    },
    {
      id: 'S7',
      title: 'Салон отменяет запись в журнале → клиенты из листа ожидания получают уведомление',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-101', 'F-00-102', 'F-00-100'],
      expect: 'Админ ставит «Отменена мастером» записи Гаяне → у клиента в листе ожидания «Окно освободилось!»',
      run: async (t) => {
        // новая запись в лист ожидания (прошлая уже уведомлена) — на услугу отменяемой записи
        const db0 = await t.db();
        const victim = db0.core.bookings
          .filter((b) => b.staffId === GAYANE && !b.deletedAt && ['scheduled', 'client_confirmed'].includes(b.status) && b.start > `${addDays(today(), 1)}T00:00`)
          .sort((a, b) => a.start.localeCompare(b.start))[0];
        if (!victim) throw new Fail('в сиде нет будущей записи Гаяне для отмены');
        const svc = db0.core.services.find((s) => s.id === victim.services[0]?.serviceId);
        await joinWaitlist(t, svc.name.ru);
        const dbW = await t.db();
        const notifiedOf = (d, id) => d.areas.resources.waitlistNotified?.[id]?.length ?? 0;
        const fresh = dbW.areas.resources.waitlist.filter((w) => w.appUserId && !notifiedOf(dbW, w.id));
        t.assert(fresh.length, 'не удалось встать в лист ожидания второй раз');
        const upd = await setStatusInJournal(t, 'admin', victim, 'cancelled_by_master');
        t.assert(upd.status === 'cancelled_by_master', `статус после отмены в журнале ${upd.status}`);
        const db = await t.db();
        const notified = db.areas.resources.waitlist.filter((w) => fresh.some((f) => f.id === w.id) && notifiedOf(db, w.id));
        t.assert(notified.length, `журнал отменил ${victim.start} (${svc.name.ru}), но лист ожидания об этом не узнал — «Окно освободилось!» не появилось`);
      },
    },
    {
      id: 'S8',
      title: 'Салон видит лист ожидания в кабинете',
      persona: 'admin',
      area: 'resources',
      fids: ['F-00-102', 'F-16'],
      expect: '/biz/waitlist — очередь клиента к Гаяне (из приложения)',
      run: async (t) => {
        await t.go('admin', '/biz/waitlist', 'desktop');
        const txt = await t.mainText();
        t.assert(txt.includes('Гаяне'), '/biz/waitlist не показывает заявку клиента из приложения (лист ожидания один, 01.10.2026)');
      },
    },
  ],
};
