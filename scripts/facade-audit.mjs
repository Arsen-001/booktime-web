// Аудит фасадов (этап 21 «Сдача»): экспортируемые функции src/api/* (кроме *.server.ts), которые в режиме api
// читают/пишут моковую базу браузера (readCore/readArea/mutateArea/mutateCore — в теле или через локальный
// хелпер) без ветки isApiMode(), и сколько у них потребителей (импорт из того же модуля или барреля).
//   node scripts/facade-audit.mjs [out.json]
//   node scripts/facade-audit.mjs --show-allowed   печатает список выше плюс сами allowlist-строки с причиной
import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const ROOT='/Users/arsen/WebstormProjects/booking-platform';
const require=createRequire(ROOT+'/package.json'); const ts=require('typescript');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const apiFiles=walk(ROOT+'/src/api').filter(f=>/\.tsx?$/.test(f)&&!/\.server\.ts$/.test(f));
const consumers=[...walk(ROOT+'/src')].filter(f=>/\.tsx?$/.test(f)&&!f.includes('/src/mock/'));
const text=Object.fromEntries(consumers.map(f=>[f,fs.readFileSync(f,'utf8')]));
const MOCK=/\b(readCore|readArea|mutateArea|mutateCore)\s*\(/; const GATE=/isApiMode\(\)|dataMode\(\) === 'api'/;
// оба стиля кавычек: часть экранов отформатирована "…" — одинарные только теряли потребителей (стадия 21, попытка 4)
const imports=(t,m)=>t.includes("'"+m+"'")||t.includes('"'+m+'"');

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Allowlist «внутренних помощников» (этап 21, лейн «resources+helpers», 28.09.2026 — см. PROGRESS.md
// «Этап 21 — Сдача, попытка 4», раздел «Не дыры…», ~37 штук). Каждая строка — функция, которую скрипт находит
// текстовым разбором (self-use / локальный хелпер без isApiMode), но которая НЕ дыра перевода на сервер: либо
// чистое вычисление/чтение зеркала без сети, либо вызывается только изнутри уже переведённых на сервер
// функций того же файла, либо ложное совпадение самого текстового разбора (комментарий, строка перевода).
// Ключ — путь файла от корня репозитория (как печатает сам скрипт), значение — { имяФункции: причина }.
// Если функция из этого списка перестаёт встречаться в файле — скрипт предупреждает (см. checkStaleAllowlist
// ниже), чтобы список не копил мёртвые записи и не прятал будущую настоящую дыру под старым именем.
const ALLOW = {
  'src/api/area.ts': {
    readCore: 'читает уже зеркалируемое сервером ядро (mirror.ts в api-режиме держит его синхронным) — отдельного HTTP не требует',
  },
  'src/api/clients/loyalty.ts': {
    recalcClientLoyaltyImpl: 'документировано в файле: «на сервере то же одной командой» — зовётся только из уже переведённых на сервер функций пересчёта лояльности клиента',
    recalcAllClientsLoyalty: 'массовый пересчёт поверх recalcClientLoyaltyImpl — тот же случай',
  },
  'src/api/clients/shared.ts': {
    toRow: 'чистое преобразование Client → строка CRM, без сети',
    businessIdsFor: 'чтение зеркала (бизнесы уже зеркалируются сервером)',
    rowsFor: 'чистая фильтрация/сортировка уже полученных строк',
    filterContext: 'собирает контекст фильтра из зеркала, без сети',
    logChange: 'пишет журнал ТОЛЬКО внутри mock-веток уже переведённых на сервер CRM-мутаций (сервер там сам пишет audit.record) — второй вызов задвоил бы запись',
    deleteClientTx: 'tx-обёртка мока, вызывается только из уже гейтнутого deleteClient',
    bizSettings: 'чтение зеркала настроек бизнеса',
    patchBizSettings: 'локальный tx-хелпер, вызывается только из уже гейтнутых сеттеров того же файла',
    staffName: 'чтение зеркала сотрудников (уже зеркалируется сервером)',
  },
  'src/api/core.ts': {
    moderationHiddenIds: 'читает локальный core вне зеркала, но вызывается только внутри уже гейтнутых функций модерации того же файла',
  },
  'src/api/journal.ts': {
    computeOverlap: 'чистая функция пересечения интервалов, без сети — вызывается только внутри уже гейтнутых hasOverlap/hasResourceOverlap',
    computeResourceFree: 'то же самое, для ресурсов',
  },
  'src/api/payroll.ts': {
    staffSalaryForSheetSync: 'синхронная функция без сети; оба вызывающих места — внутри !isApiMode()-веток finance.ts (тот же класс, что computeOverlap)',
  },
  'src/api/platform/demand.ts': {
    reportSearchDemand: 'вызывается только из mock-ветки клиентских фасадов — в api-режиме до неё не доходит (перепроверено лейном rest, попытка 1)',
  },
  'src/api/platform/promo.ts': {
    redeemPromo: 'решение владельца (06 §4.2): промокод клиента остаётся на моке в этом объёме — не строить параллельную инфраструктуру ради одной функции',
  },
  'src/api/schedule/shared.ts': {
    effectiveTypeId: 'ложное совпадение (этап 21, сдача 28.09): SchedulePanel.tsx держит СВОЮ локальную переменную с тем же именем и импортирует барель @/api/schedule ради других функций; сама функция зовётся только из mock-ветки getCalendarWeek (calendar.ts, после isApiMode) и из txSnapshotCells',
    historyActor: 'чтение зеркала (актёр записи), без сети',
    pushHistory: 'tx-хелпер журнала правок расписания, вызывается только из уже гейтнутых мутаторов того же файла',
    txSetCells: 'tx-хелпер, тот же случай',
    txSnapshotCells: 'чистое чтение снимка ячеек, без сети',
    txRestoreCells: 'tx-хелпер восстановления, вызывается только из уже гейтнутого restore',
    txApplyPlan: 'tx-хелпер применения плана, вызывается только из уже гейтнутого applyPlan',
    staffNameOf: 'чтение зеркала сотрудников',
    txMarks: 'чтение зеркала отметок расписания (уже зеркалируется сервером)',
    txScheduleEnd: 'чистое вычисление конца расписания, без сети',
  },
  'src/api/schedule/slots.ts': {
    busyForSlots: 'чистое вычисление занятости из уже полученных данных, без сети',
    computeFreeSlots: 'чистое вычисление свободных окон, вызывается только внутри уже гейтнутых функций окон',
    computeAnySpecialistSlots: 'то же самое, для «любого специалиста»',
    effectiveBufferMin: 'чистое вычисление буфера, без сети',
  },
  'src/api/schedule/staff.ts': {
    snapshotBeforeRemoveFromSchedule: 'мёртвый код — единственное совпадение текстового разбора это упоминание имени в соседнем докстринге ("… из snapshotBeforeRemoveFromSchedule (реализация …)"), не вызов; реальных вызывающих нет ни в src/api, ни в src/areas',
  },
  'src/api/staff.ts': {
    resendInvite: 'ложное совпадение: регэксп текстового разбора ловит ключ перевода "row.resendInvite" в t(...) — реальный экран зовёт resendInviteForStaff, у неё isApiMode() уже есть',
    ownerCountOf: 'чтение зеркала сотрудников (владелец бизнеса уже зеркалируется сервером)',
  },
  'src/api/notify.ts': {
    hasActiveChatPartner: 'синхронная проверка по уже полученным данным, без сети — вызывается только внутри уже гейтнутых функций чата партнёра',
  },
};

function checkStaleAllowlist(seenByFile) {
  const stale = [];
  for (const [file, entries] of Object.entries(ALLOW)) {
    for (const name of Object.keys(entries)) {
      if (!seenByFile[file]?.has(name)) stale.push(file + '::' + name);
    }
  }
  if (stale.length) {
    console.error('WARN allowlist stale (функция больше не найдена текстовым разбором — проверьте, не уехала ли она сама на сервер или не переименована ли):');
    for (const s of stale) console.error('  ' + s);
  }
}

const out=[]; const allowedOut=[]; const seenByFile={};
for(const f of apiFiles){
  const src=fs.readFileSync(f,'utf8'); const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true);
  const relFile=path.relative(ROOT,f);
  // local non-exported helpers that touch mock w/o gate
  const locals={};
  const fnText=n=>n.getText(sf);
  const items=[];
  for(const st of sf.statements){
    const exp=st.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword);
    if(ts.isFunctionDeclaration(st)&&st.name){ (exp?items:[]).push([st.name.text,fnText(st)]); if(!exp) locals[st.name.text]=fnText(st);}
    if(ts.isVariableStatement(st)) for(const d of st.declarationList.declarations){ if(d.initializer&&(ts.isArrowFunction(d.initializer)||ts.isFunctionExpression(d.initializer))&&ts.isIdentifier(d.name)){ if(exp) items.push([d.name.text,fnText(st)]); else locals[d.name.text]=fnText(st);} }
  }
  for(const [name,body] of items){
    if(GATE.test(body)) continue;
    let touches=MOCK.test(body);
    if(!touches){ for(const [ln,lb] of Object.entries(locals)){ if(new RegExp('\\b'+ln+'\\s*\\(').test(body)&&MOCK.test(lb)&&!GATE.test(lb)){touches=true;break;} } }
    if(!touches) continue;
    (seenByFile[relFile]??=new Set()).add(name);
    const allowReason = ALLOW[relFile]?.[name];
    if(allowReason){ allowedOut.push({file:relFile,name,reason:allowReason}); continue; }
    // mutation-only local (both read & write area without gate) — flag separately
    const re=new RegExp('\\b'+name+'\\b');
    const mod='@/api/'+path.relative(ROOT+'/src/api',f).replace(/\.tsx?$/,'');
    const barrel=mod.replace(/\/[^/]+$/,'');
    const selfUse=new RegExp('[^.\\w]'+name+'\\s*\\(').test(src.replace(body,''));
    const users=consumers.filter(c=>c!==f&&!/\.server\.ts$/.test(c)&&re.test(text[c])&&(imports(text[c],mod)||(barrel!=='@/api'&&imports(text[c],barrel))));
    if(selfUse&&!users.length) users.push('(self)');
    const areaUsers=users.filter(c=>c.includes('/src/areas/')||c.includes('/src/app/')||c.includes('/src/components/'));
    // Вид дыры (попытка 4): area — состояние раздела только в браузере (readArea/mutateArea/mutateCore);
    // core — читает ядро браузера за пределами зеркала сервера; mirror — читает только зеркалируемые сервером
    // сущности (mirror.ts: бизнесы/филиалы/сети/сотрудники/категории/услуги/ресурсы) — данные уже серверные.
    const whole=body+Object.entries(locals).filter(([ln])=>new RegExp('\\b'+ln+'\\s*\\(').test(body)).map(([,lb])=>lb).join('\n');
    const MIRRORED=new Set(['businesses','locations','staff','networks','serviceCategories','services','resources']);
    const coreFields=[...whole.matchAll(/\bcore\.(\w+)/g)].map(m=>m[1]);
    const kind=/readArea|mutateArea|mutateCore/.test(whole)?'area':coreFields.some(x=>!MIRRORED.has(x))?'core':'mirror';
    out.push({file:relFile,name,users:users.length,areaUsers:areaUsers.length,writes:/mutateArea|mutateCore/.test(body),kind});
  }
}
checkStaleAllowlist(seenByFile);
const byFile={};
for(const o of out){(byFile[o.file]??=[]).push(o);}
let tot=0,live=0;
const K={area:0,core:0,mirror:0};
for(const [f,l] of Object.entries(byFile).sort()){ const lv=l.filter(o=>o.users>0); tot+=l.length; live+=lv.length; for(const o of lv)K[o.kind]++; console.log(f, l.length, 'used:',lv.length, lv.map(o=>o.name+(o.writes?'*':'')+(o.kind==='area'?'':'['+o.kind+']')).join(' '));}
console.log('KIND (used): area',K.area,'core',K.core,'mirror',K.mirror);
console.log('TOTAL',tot,'used',live,'(allowlisted helpers excluded:',allowedOut.length,')');
if(process.argv.includes('--show-allowed')){
  console.log('--- allowlisted (не считаются дырами) ---');
  const byFileA={}; for(const a of allowedOut)(byFileA[a.file]??=[]).push(a);
  for(const [f,l] of Object.entries(byFileA).sort()) for(const a of l) console.log(f, a.name, '—', a.reason);
}
fs.writeFileSync(process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'/dev/null',JSON.stringify(out,null,1));
