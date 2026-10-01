'use client';

/**
 * Состояние формы услуги (У3): один черновик на всю форму — поля, мастера с их ценами, онлайн-окно, данные для чека.
 * «Сохранить» пишет всё одной операцией (saveServiceForm), «есть несохранённое» считается сравнением с тем, что
 * пришло с сервера. Проверка (У14, У19) — здесь же: ошибки по полям и id поля, к которому прокрутить.
 */
import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  bufferToTechBreak,
  getService,
  getServiceExtra,
  listCategories,
  listServiceStaff,
  listStaffForPicker,
  saveServiceForm,
  type ServiceInput,
} from '@/api/services';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useSphere } from '@/demo/hooks';
import type { LocalizedText, ServiceKind } from '@/domain/core';
import { isRangeValid, type ServiceOnlineWindow, type ServiceStaffEntry, type ServiceUpsell, type TechBreakMode } from '@/domain/services';
import { hasName, normalizeName } from '@/areas/services/components/LocalizedTextField';

export type TaxSystem = 'general' | 'simplified' | 'patent' | 'none';

export interface ServiceDraft {
  name: LocalizedText;
  description: LocalizedText;
  categoryId: string;
  kind: ServiceKind;
  capacity: number;
  durationMin: number | undefined;
  durationRange: boolean;
  durationMax: number | undefined;
  free: boolean;
  priceMin: number | undefined;
  priceRange: boolean;
  priceMax: number | undefined;
  techBreak: TechBreakMode;
  techBreakMin: number;
  repeatDays: number | undefined;
  photos: string[];
  online: boolean;
  window: ServiceOnlineWindow;
  shadeChoice: 'off' | 'required' | 'preferred';
  receiptName: LocalizedText;
  taxSystem: TaxSystem;
  autoTranslated: { hy?: boolean; en?: boolean };
  staff: ServiceStaffEntry[];
  /** ⭐ Сопутствующие услуги и товары — допродажа при записи (01.10.2026) */
  upsell: ServiceUpsell;
}

export type ServiceFormErrorKey = 'name' | 'category' | 'price' | 'priceMax' | 'duration' | 'durationMax';
export type ServiceFormErrors = Partial<Record<ServiceFormErrorKey, string>>;

/** id обёрток полей — к первому с ошибкой прокручивается форма (У19) */
export const FIELD_IDS: Record<ServiceFormErrorKey, string> = {
  name: 'svc-f-name',
  category: 'svc-f-category',
  price: 'svc-f-price',
  priceMax: 'svc-f-price-max',
  duration: 'svc-f-duration',
  durationMax: 'svc-f-duration-max',
};

const EMPTY_TEXT: LocalizedText = { ru: '' };

export function emptyDraft(categoryId = ''): ServiceDraft {
  return {
    name: EMPTY_TEXT,
    description: EMPTY_TEXT,
    categoryId,
    kind: 'individual',
    capacity: 2,
    durationMin: 60,
    durationRange: false,
    durationMax: undefined,
    free: false,
    priceMin: undefined,
    priceRange: false,
    priceMax: undefined,
    techBreak: 'shared',
    techBreakMin: 15,
    repeatDays: undefined,
    photos: [],
    online: true,
    window: { enabled: false },
    shadeChoice: 'off',
    receiptName: EMPTY_TEXT,
    taxSystem: 'none',
    autoTranslated: {},
    staff: [],
    upsell: { serviceIds: [], productIds: [] },
  };
}

export function useServiceForm() {
  const { ready, businessId } = useCurrent();
  const sphere = useSphere();
  const params = useParams<{ serviceId?: string }>();
  const search = useSearchParams();
  const isNew = !params.serviceId || params.serviceId === 'new';
  const serviceId = isNew ? undefined : params.serviceId;
  const enabled = ready && Boolean(businessId);

  const categoriesQ = useApiQuery(['services', 'categories', businessId], () => listCategories(businessId ?? ''), { enabled });
  const staffListQ = useApiQuery(['services', 'staffPicker', businessId], () => listStaffForPicker(businessId ?? ''), { enabled });
  const detailQ = useApiQuery(['services', 'detail', serviceId], () => getService(serviceId ?? ''), {
    enabled: enabled && Boolean(serviceId),
  });
  const extraQ = useApiQuery(['services', 'extra', serviceId], () => getServiceExtra(serviceId ?? ''), {
    enabled: enabled && Boolean(serviceId),
  });
  const staffQ = useApiQuery(['services', 'staff', serviceId], () => listServiceStaff(serviceId ?? '', businessId ?? ''), {
    enabled: enabled && Boolean(serviceId),
  });

  const [draft, setDraft] = useState<ServiceDraft>(() => emptyDraft(search.get('categoryId') ?? ''));
  const [initial, setInitial] = useState<ServiceDraft | null>(null);
  const [errors, setErrors] = useState<ServiceFormErrors>({});

  // Подхват данных формы, когда всё пришло (правка состояния в рендере — без эффекта)
  if (!initial) {
    if (isNew && ready) {
      setInitial(draft);
    } else if (detailQ.data && !extraQ.isLoading && staffQ.data) {
      const s = detailQ.data;
      const extra = extraQ.data;
      const tb = bufferToTechBreak(s.bufferAfterMin);
      const filled: ServiceDraft = {
        ...emptyDraft(s.categoryId),
        name: s.name,
        description: s.description ?? EMPTY_TEXT,
        kind: s.kind,
        capacity: s.capacity ?? 2,
        durationMin: s.durationMin,
        durationRange: s.durationMax != null,
        durationMax: s.durationMax,
        free: s.priceMin === 0 && !s.priceMax,
        priceMin: s.priceMin,
        priceRange: s.priceMax != null,
        priceMax: s.priceMax,
        techBreak: tb.mode,
        techBreakMin: tb.min ?? 15,
        repeatDays: s.repeatIntervalDays,
        photos: s.photos,
        online: s.onlineBookable,
        window: extra?.onlineWindow ?? { enabled: false },
        shadeChoice: s.shadeChoice ?? 'off',
        receiptName: extra?.receipt?.receiptName ?? EMPTY_TEXT,
        taxSystem: extra?.receipt?.taxSystem ?? 'none',
        autoTranslated: extra?.autoTranslated ?? {},
        upsell: { serviceIds: extra?.upsell?.serviceIds ?? [], productIds: extra?.upsell?.productIds ?? [] },
        staff: staffQ.data.map(({ staff, term }) => ({
          staffId: staff.id,
          price: term?.price,
          durationMin: term?.durationMin,
        })),
      };
      setDraft(filled);
      setInitial(filled);
    }
  }

  const dirty = initial !== null && JSON.stringify(initial) !== JSON.stringify(draft);

  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (Object.keys(errors).length) setErrors({});
  };

  const saveM = useApiMutation(saveServiceForm);

  /** Ключи ошибок (переводит экран); порядок — сверху вниз по форме */
  const validate = (): ServiceFormErrors => {
    const e: ServiceFormErrors = {};
    if (!hasName(draft.name)) e.name = 'form.nameRequired';
    if (!draft.categoryId) e.category = 'form.categoryRequired';
    if (!draft.free && draft.priceMin == null) e.price = 'form.priceRequired';
    if (draft.priceRange && !draft.free && (draft.priceMax == null || !isRangeValid(draft.priceMin, draft.priceMax)))
      e.priceMax = 'form.rangeInvalid';
    if (!draft.durationMin) e.duration = 'form.durationRequired';
    if (draft.durationRange && (draft.durationMax == null || !isRangeValid(draft.durationMin, draft.durationMax)))
      e.durationMax = 'form.rangeInvalid';
    return e;
  };

  const toInput = (): ServiceInput => ({
    categoryId: draft.categoryId,
    name: normalizeName(draft.name),
    description:
      draft.description.ru.trim() || draft.description.hy?.trim() || draft.description.en?.trim()
        ? normalizeName(draft.description)
        : undefined,
    kind: draft.kind,
    capacity: draft.capacity,
    durationMin: draft.durationMin ?? 60,
    durationMax: draft.durationRange ? draft.durationMax : undefined,
    priceMin: draft.free ? 0 : (draft.priceMin ?? 0),
    priceMax: draft.priceRange && !draft.free ? draft.priceMax : undefined,
    techBreak: draft.techBreak,
    techBreakMin: draft.techBreakMin,
    repeatIntervalDays: draft.repeatDays,
    photos: draft.photos,
    onlineBookable: draft.online,
    shadeChoice: draft.shadeChoice === 'off' ? undefined : draft.shadeChoice,
  });

  const save = () =>
    saveM.mutate({
      id: serviceId,
      businessId: businessId ?? '',
      sphereId: sphere.id,
      input: toInput(),
      staff: draft.staff,
      extra: {
        autoTranslated: draft.autoTranslated,
        receipt: {
          receiptName: draft.receiptName.ru ? draft.receiptName : undefined,
          taxSystem: draft.taxSystem,
        },
        onlineWindow: draft.window,
        upsell: draft.upsell,
      },
    });

  const loading =
    !ready ||
    categoriesQ.isLoading ||
    staffListQ.isLoading ||
    (!isNew && (detailQ.isLoading || extraQ.isLoading || staffQ.isLoading)) ||
    !initial;

  return {
    isNew,
    serviceId,
    businessId,
    draft,
    set,
    setDraft,
    dirty,
    markSaved: () => setInitial(draft),
    errors,
    setErrors,
    validate,
    save,
    saving: saveM.isPending,
    loading,
    isError: categoriesQ.isError || detailQ.isError,
    retry: () => (categoriesQ.isError ? categoriesQ.refetch() : detailQ.refetch()),
    categories: categoriesQ.data ?? [],
    staffList: staffListQ.data ?? [],
    snapshot: detailQ.data,
  };
}
