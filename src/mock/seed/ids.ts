/** Постоянные id сида — удобно ссылаться из срезов разделов и из тестов. */

export const NET = { manana: 'net_manana' } as const;

export const BIZ = {
  nuri: 'biz_nuri',
  kaytsak: 'biz_kaytsak',
  atam: 'biz_atam',
  mananaNN: 'biz_manana_nn',
  mananaSH: 'biz_manana_sh',
  lusine: 'biz_lusine',
  arman: 'biz_arman',
  mariam: 'biz_mariam',
  davit: 'biz_davit',
  vard: 'biz_vard',
  hayk: 'biz_hayk',
  meline: 'biz_meline',
  shushan: 'biz_shushan',
  // Пустые бизнесы для проверки пустых состояний (демо «Новый салон — пусто» / «Новый мастер — пусто»):
  // только владелец и один филиал — ни услуг, ни мастеров, ни клиентов, ни записей, ни графиков
  empty: 'biz_empty',
  emptySolo: 'biz_empty_solo',
} as const;

export type BizKey = keyof typeof BIZ;

export const LOC: Record<BizKey, string> = {
  nuri: 'loc_nuri',
  kaytsak: 'loc_kaytsak',
  atam: 'loc_atam',
  mananaNN: 'loc_manana_nn',
  mananaSH: 'loc_manana_sh',
  lusine: 'loc_lusine',
  arman: 'loc_arman',
  mariam: 'loc_mariam',
  davit: 'loc_davit',
  vard: 'loc_vard',
  hayk: 'loc_hayk',
  meline: 'loc_meline',
  shushan: 'loc_shushan',
  empty: 'loc_empty',
  emptySolo: 'loc_empty_solo',
};

/** Бизнесы, которые демо-контекст выбирает только по флагу «пусто» (src/demo/context.ts) */
export const EMPTY_BIZ_IDS: readonly string[] = [BIZ.empty, BIZ.emptySolo];

export const ST = {
  nuriOwner: 'st_nuri_owner',
  nuriAdmin: 'st_nuri_admin',
  nuriAdmin2: 'st_nuri_admin2',
  nuriAni: 'st_nuri_ani',
  nuriMariam: 'st_nuri_mariam',
  nuriSona: 'st_nuri_sona',
  nuriGayane: 'st_nuri_gayane',
  nuriEva: 'st_nuri_eva',
  kaytsakOwner: 'st_kaytsak_aram',
  kaytsakAdmin: 'st_kaytsak_admin',
  kaytsakDavid: 'st_kaytsak_david',
  kaytsakNarek: 'st_kaytsak_narek',
  kaytsakErik: 'st_kaytsak_erik',
  atamOwner: 'st_atam_armen',
  atamAdmin: 'st_atam_admin',
  atamKaren: 'st_atam_karen',
  atamSeda: 'st_atam_seda',
  atamAshot: 'st_atam_ashot',
  mananaOwner: 'st_manana_owner',
  mananaNNAdmin: 'st_manana_nn_admin',
  mananaSHAdmin: 'st_manana_sh_admin',
  mananaArpi: 'st_manana_arpi',
  mananaNane: 'st_manana_nane',
  mananaAnna: 'st_manana_anna',
  mananaGor: 'st_manana_gor',
  mananaTamara: 'st_manana_tamara',
  mananaAstghik: 'st_manana_astghik',
  lusine: 'st_lusine',
  arman: 'st_arman',
  mariam: 'st_mariam',
  davit: 'st_davit',
  vardOwner: 'st_vard_owner',
  vardAdmin: 'st_vard_admin',
  vardLiana: 'st_vard_liana',
  vardInessa: 'st_vard_inessa',
  vardKarine: 'st_vard_karine',
  vardEdgar: 'st_vard_edgar',
  vardZara: 'st_vard_zara',
  hayk: 'st_hayk',
  meline: 'st_meline',
  shushan: 'st_shushan',
  // Условные блоки графика (schedule b03): уволенная с открытым графиком и ассистент без колонки в журнале
  nuriFired: 'st_nuri_lala',
  nuriAssistant: 'st_nuri_mane',
  // Ещё три барбера Kaytsak (28.09.2026)
  kaytsakVahe: 'st_kaytsak_vahe',
  kaytsakSamvel: 'st_kaytsak_samvel',
  kaytsakGevorg: 'st_kaytsak_gevorg',
  // И ещё восемь (28.09.2026): 15 мастеров в журнале — посмотреть, как выглядит большой салон
  kaytsakLevon: 'st_kaytsak_levon',
  kaytsakArtur: 'st_kaytsak_artur',
  kaytsakGarik: 'st_kaytsak_garik',
  kaytsakRuben: 'st_kaytsak_ruben',
  kaytsakGor: 'st_kaytsak_gor',
  kaytsakSuren: 'st_kaytsak_suren',
  kaytsakAndranik: 'st_kaytsak_andranik',
  kaytsakMher: 'st_kaytsak_mher',
  emptyOwner: 'st_empty_owner',
  emptySolo: 'st_empty_solo',
} as const;
