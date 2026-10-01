/**
 * Готовые списки услуг по сфере (F-00-083, F-00-173) — «Добавить из шаблона». Тексты сразу на ru/hy/en,
 * своя справочная таблица (не сущность ядра). Принадлежит разделу services; используют также settings
 * (быстрый старт F-15-018) и platform («Подключить салон» F-00-176) через listTemplates().
 */
import type { SphereId } from '@/domain/core';
import type { ServiceTemplateItem } from '@/domain/services';

const t = (ru: string, hy: string, en: string) => ({ ru, hy, en });

const NAILS: ServiceTemplateItem[] = [
  {
    id: 'manicure',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Классический маникюр', 'Դասական մանիկյուր', 'Classic manicure'),
    durationMin: 60,
    priceMin: 6000,
  },
  {
    id: 'manicure-gel',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Маникюр с покрытием гель-лак', 'Մանիկյուր գել-լաքով', 'Manicure with gel polish'),
    durationMin: 90,
    priceMin: 9000,
  },
  {
    id: 'manicure-hardware',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Аппаратный маникюр', 'Ապարատային մանիկյուր', 'Hardware manicure'),
    durationMin: 60,
    priceMin: 6500,
  },
  {
    id: 'manicure-men',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Мужской маникюр', 'Տղամարդու մանիկյուր', "Men's manicure"),
    durationMin: 45,
    priceMin: 6000,
  },
  {
    id: 'manicure-kids',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Детский маникюр', 'Մանկական մանիկյուր', "Kids' manicure"),
    durationMin: 30,
    priceMin: 4000,
  },
  {
    id: 'gel-removal',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Снятие покрытия', 'Ծածկույթի հեռացում', 'Polish removal'),
    durationMin: 20,
    priceMin: 2000,
  },
  {
    id: 'nail-strengthening',
    categoryName: t('Маникюр', 'Մանիկյուր', 'Manicure'),
    name: t('Укрепление ногтей гелем', 'Եղունգների ամրացում գելով', 'Gel nail strengthening'),
    durationMin: 120,
    priceMin: 11000,
  },
  {
    id: 'pedicure',
    categoryName: t('Педикюр', 'Պեդիկյուր', 'Pedicure'),
    name: t('Классический педикюр', 'Դասական պեդիկյուր', 'Classic pedicure'),
    durationMin: 90,
    priceMin: 8000,
  },
  {
    id: 'pedicure-gel',
    categoryName: t('Педикюр', 'Պեդիկյուր', 'Pedicure'),
    name: t('Педикюр с гель-лаком', 'Պեդիկյուր գել-լաքով', 'Pedicure with gel polish'),
    durationMin: 90,
    priceMin: 12000,
  },
  {
    id: 'pedicure-spa',
    categoryName: t('Педикюр', 'Պեդիկյուր', 'Pedicure'),
    name: t('SPA-педикюр', 'SPA պեդիկյուր', 'SPA pedicure'),
    durationMin: 75,
    priceMin: 13000,
  },
  {
    id: 'nail-art',
    categoryName: t('Дизайн', 'Դիզայն', 'Design'),
    name: t('Дизайн ногтей', 'Եղունգների դիզայն', 'Nail art'),
    durationMin: 30,
    priceMin: 2000,
  },
  {
    id: 'nail-extension',
    categoryName: t('Дизайн', 'Դիզայն', 'Design'),
    name: t('Наращивание ногтей', 'Եղունգների երկարացում', 'Nail extensions'),
    durationMin: 150,
    priceMin: 15000,
  },
];
const BARBER: ServiceTemplateItem[] = [
  {
    id: 'haircut',
    categoryName: t('Стрижки', 'Սանրվածքներ', 'Haircuts'),
    name: t('Мужская стрижка', 'Տղամարդու սանրվածք', "Men's haircut"),
    durationMin: 30,
    priceMin: 4000,
  },
  {
    id: 'beard',
    categoryName: t('Борода', 'Մորուք', 'Beard'),
    name: t('Оформление бороды', 'Մորուքի ձևավորում', 'Beard trim'),
    durationMin: 30,
    priceMin: 3000,
  },
  {
    id: 'combo',
    categoryName: t('Стрижки', 'Սանրվածքներ', 'Haircuts'),
    name: t('Стрижка + борода', 'Սանրվածք + մորուք', 'Haircut + beard'),
    durationMin: 60,
    priceMin: 6000,
  },
];
const HAIR: ServiceTemplateItem[] = [
  {
    id: 'haircut-w',
    categoryName: t('Стрижки', 'Սանրվածքներ', 'Haircuts'),
    name: t('Женская стрижка', 'Կանացի սանրվածք', "Women's haircut"),
    durationMin: 60,
    priceMin: 5000,
  },
  {
    id: 'coloring',
    categoryName: t('Окрашивание', 'Ձևավորում', 'Coloring'),
    name: t('Окрашивание в один тон', 'Միագույն ձևավորում', 'Single-tone coloring'),
    durationMin: 120,
    priceMin: 15000,
  },
  {
    id: 'styling',
    categoryName: t('Укладка', 'Սանրում', 'Styling'),
    name: t('Укладка', 'Սանրում', 'Blowout'),
    durationMin: 45,
    priceMin: 4000,
  },
];
const COSMETOLOGY: ServiceTemplateItem[] = [
  {
    id: 'facial',
    categoryName: t('Уход за лицом', 'Դեմքի խնամք', 'Facial care'),
    name: t('Чистка лица', 'Դեմքի մաքրում', 'Facial cleansing'),
    durationMin: 60,
    priceMin: 12000,
  },
  {
    id: 'peeling',
    categoryName: t('Уход за лицом', 'Դեմքի խնամք', 'Facial care'),
    name: t('Пилинг', 'Պիլինգ', 'Peeling'),
    durationMin: 45,
    priceMin: 10000,
  },
];
const MASSAGE: ServiceTemplateItem[] = [
  {
    id: 'massage-back',
    categoryName: t('Массаж', 'Մասաժ', 'Massage'),
    name: t('Массаж спины', 'Մեջքի մասաժ', 'Back massage'),
    durationMin: 45,
    priceMin: 9000,
  },
  {
    id: 'massage-full',
    categoryName: t('Массаж', 'Մասաժ', 'Massage'),
    name: t('Общий массаж', 'Ընդհանուր մասաժ', 'Full-body massage'),
    durationMin: 60,
    priceMin: 14000,
  },
];
const DENTAL: ServiceTemplateItem[] = [
  {
    id: 'checkup',
    categoryName: t('Приём', 'Ընդունելություն', 'Visit'),
    name: t('Консультация', 'Խորհրդատվություն', 'Consultation'),
    durationMin: 30,
    priceMin: 5000,
  },
  {
    id: 'cleaning',
    categoryName: t('Гигиена', 'Հիգիենա', 'Hygiene'),
    name: t('Профессиональная чистка', 'Պրոֆեսիոնալ մաքրում', 'Professional cleaning'),
    durationMin: 60,
    priceMin: 15000,
  },
];
const FITNESS: ServiceTemplateItem[] = [
  {
    id: 'personal',
    categoryName: t('Тренировки', 'Մարզումներ', 'Training'),
    name: t('Персональная тренировка', 'Անհատական մարզում', 'Personal training'),
    durationMin: 60,
    priceMin: 8000,
  },
  {
    id: 'group',
    categoryName: t('Тренировки', 'Մարզումներ', 'Training'),
    name: t('Групповое занятие', 'Խմբակային պարապմունք', 'Group class'),
    durationMin: 60,
    priceMin: 3000,
    kind: 'group',
  },
];
const CARWASH: ServiceTemplateItem[] = [
  {
    id: 'wash-ext',
    categoryName: t('Мойка', 'Լվացում', 'Wash'),
    name: t('Мойка кузова', 'Թափքի լվացում', 'Exterior wash'),
    durationMin: 40,
    priceMin: 4000,
  },
  {
    id: 'wash-full',
    categoryName: t('Мойка', 'Լվացում', 'Wash'),
    name: t('Комплексная мойка', 'Համալիր լվացում', 'Full wash'),
    durationMin: 90,
    priceMin: 12000,
  },
];
const GENERAL: ServiceTemplateItem[] = [
  {
    id: 'service',
    categoryName: t('Услуги', 'Ծառայություններ', 'Services'),
    name: t('Основная услуга', 'Հիմնական ծառայություն', 'Main service'),
    durationMin: 60,
    priceMin: 5000,
  },
];

export const SERVICE_TEMPLATES: Record<SphereId, ServiceTemplateItem[]> = {
  nails: NAILS,
  barber: BARBER,
  hair: HAIR,
  cosmetology: COSMETOLOGY,
  massage: MASSAGE,
  dental: DENTAL,
  fitness: FITNESS,
  carwash: CARWASH,
  general: GENERAL,
};
