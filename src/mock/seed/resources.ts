import type { Resource } from '@/domain/core';
import { BIZ, LOC } from '@/mock/seed/ids';
import { lt } from '@/mock/seed/helpers';

/** Ресурсы (F-00-149): запись занимает не только мастера, но и кресло/кабинет/аппарат. */
export function buildResources(): Resource[] {
  const inst = (prefix: string, label: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}_${i + 1}`, name: `${label} ${i + 1}` }));

  return [
    {
      id: 'res_nuri_pedi',
      businessId: BIZ.nuri,
      locationId: LOC.nuri,
      name: lt('Кресло педикюра', 'Ոտնահարդարման բազկաթոռ', 'Pedicure chair'),
      kind: 'chair',
      instances: inst('res_nuri_pedi', 'Кресло', 2),
      serviceIds: ['sv_nuri_pedi', 'sv_nuri_pedi_gel', 'sv_nuri_pedi_spa'],
      active: true,
    },
    {
      id: 'res_kaytsak_chair',
      businessId: BIZ.kaytsak,
      locationId: LOC.kaytsak,
      name: lt('Барберское кресло', 'Բարբերի բազկաթոռ', 'Barber chair'),
      kind: 'chair',
      instances: inst('res_kaytsak_chair', 'Кресло', 15),
      serviceIds: ['sv_kay_cut', 'sv_kay_clipper', 'sv_kay_kids', 'sv_kay_combo', 'sv_kay_beard', 'sv_kay_shave', 'sv_kay_grey', 'sv_kay_style'],
      active: true,
    },
    {
      id: 'res_atam_room',
      businessId: BIZ.atam,
      locationId: LOC.atam,
      name: lt('Стоматологический кабинет', 'Ատամնաբուժական կաբինետ', 'Dental room'),
      kind: 'room',
      instances: inst('res_atam_room', 'Кабинет', 3),
      serviceIds: [
        'sv_atam_consult',
        'sv_atam_kids',
        'sv_atam_clean',
        'sv_atam_whitening',
        'sv_atam_fluor',
        'sv_atam_filling',
        'sv_atam_canal',
        'sv_atam_extract',
        'sv_atam_crown',
        'sv_atam_zirconia',
      ],
      active: true,
    },
    {
      id: 'res_atam_xray',
      businessId: BIZ.atam,
      locationId: LOC.atam,
      name: lt('Рентген-аппарат', 'Ռենտգեն սարք', 'X-ray unit'),
      kind: 'device',
      instances: inst('res_atam_xray', 'Аппарат', 1),
      serviceIds: ['sv_atam_xray'],
      active: true,
    },
    {
      id: 'res_mnn_cabinet',
      businessId: BIZ.mananaNN,
      locationId: LOC.mananaNN,
      name: lt('Кабинет косметолога', 'Կոսմետոլոգի կաբինետ', 'Cosmetology room'),
      kind: 'room',
      instances: inst('res_mnn_cabinet', 'Кабинет', 1),
      serviceIds: ['sv_mnn_face', 'sv_mnn_peel'],
      active: true,
    },
    {
      id: 'res_msh_cabinet',
      businessId: BIZ.mananaSH,
      locationId: LOC.mananaSH,
      name: lt('Кабинет косметолога', 'Կոսմետոլոգի կաբինետ', 'Cosmetology room'),
      kind: 'room',
      instances: inst('res_msh_cabinet', 'Кабинет', 1),
      serviceIds: ['sv_msh_face', 'sv_msh_face_massage', 'sv_msh_brows'],
      active: true,
    },
    {
      id: 'res_vard_cabinet',
      businessId: BIZ.vard,
      locationId: LOC.vard,
      name: lt('Кабинет косметолога', 'Կոսմետոլոգի կաբինետ', 'Cosmetology room'),
      kind: 'room',
      instances: inst('res_vard_cabinet', 'Кабинет', 1),
      serviceIds: ['sv_vard_face', 'sv_vard_peel', 'sv_vard_biorev'],
      active: true,
    },
    {
      id: 'res_arman_hall',
      businessId: BIZ.arman,
      locationId: LOC.arman,
      name: lt('Зал для групповых', 'Խմբային պարապմունքների դահլիճ', 'Group studio'),
      kind: 'hall',
      instances: inst('res_arman_hall', 'Зал', 1),
      serviceIds: ['sv_arm_group_func', 'sv_arm_group_stretch'],
      active: true,
    },
  ];
}
