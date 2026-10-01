'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, MapPin } from 'lucide-react';
import { coreList } from '@/api/core';
import { getPlacesData, updateLocationPlace, updateStaffPlaces, updateStaffRules, type PlacesData } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { DISTRICT_IDS } from '@/config/districts';
import type { DistrictId, Workplace } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useOnlineAccess } from '@/areas/online/access';
import { HelpHint } from '@/areas/online/HelpHint';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';

const WORKPLACE_IDS: Workplace[] = ['salon', 'home', 'visit', 'gym', 'online'];
const OWNER_LIKE = new Set(['owner', 'admin', 'network']);

/**
 * /biz/online/places — места работы и выезд (F-00-073…081). О30: места у каждого мастера свои (у Ани «на дому»),
 * поэтому сверху — выбор мастера: владельцу и администратору все, кто принимает клиентов, мастеру — только он сам.
 * Одна кнопка «Сохранить» на весь экран.
 */
export function PlacesScreen() {
  const t = useT('online');
  const { staffId, businessId, persona, locationId, ready } = useCurrent();
  const { own: hasAccess } = useOnlineAccess();
  const effectiveLocationId = locationId === 'all' ? undefined : locationId;
  const ownerLike = OWNER_LIKE.has(persona);

  const staffQ = useApiQuery(
    ['online-places-staff', businessId, ownerLike ? undefined : staffId],
    () => coreList('staff', (s) => s.businessId === businessId && s.status === 'active' && s.role !== 'admin' && (ownerLike || s.id === staffId)),
    { enabled: ready && Boolean(businessId) },
  );
  const masters = (staffQ.data ?? []).filter((s) => s.serviceIds.length > 0 || s.id === staffId);
  const [picked, setPicked] = useState<string | undefined>();
  const ownIsMaster = masters.some((s) => s.id === staffId && s.serviceIds.length > 0);
  const selectedId = picked ?? (ownIsMaster ? staffId : masters[0]?.id);

  const dataQ = useApiQuery(['online-places', selectedId, effectiveLocationId], () => getPlacesData(selectedId!, effectiveLocationId), {
    enabled: ready && Boolean(selectedId),
  });

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto w-full max-w-[760px]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6" data-f="F-00-073">
        <PageHeader
          title={t('places.title')}
          description={t('places.subtitle')}
          meta={<HelpHint screenKey="places" />}
          actions={
            // Выбор мастера у владельца — на месте уже до данных (выключен), чтобы шапка не перестраивалась
            !ready || staffQ.isLoading ? (
              ownerLike ? (
                <div className="w-56">
                  <Select value="" onValueChange={() => undefined} disabled aria-label={t('places.staffSelect')} options={[]} />
                </div>
              ) : undefined
            ) : masters.length > 1 ? (
              <div className="w-56">
                <Select
                  value={selectedId ?? ''}
                  onValueChange={setPicked}
                  aria-label={t('places.staffSelect')}
                  options={masters.map((s) => ({ value: s.id, label: s.name }))}
                />
              </div>
            ) : undefined
          }
        />
        {!ready || staffQ.isLoading || dataQ.isLoading ? (
          <PlacesFormSkeleton />
        ) : dataQ.isError || staffQ.isError || !dataQ.data ? (
          <ErrorState onRetry={() => (staffQ.isError ? staffQ.refetch() : dataQ.refetch())} />
        ) : (
          // Смена мастера — другая сущность: форма заводится заново по его данным (key), экран и шапка остаются
          <PlacesForm key={dataQ.data.staff.id} staffId={dataQ.data.staff.id} data={dataQ.data} />
        )}
      </div>
    </PermissionGate>
  );
}

function PlacesForm({ staffId, data }: { staffId: string; data: PlacesData }) {
  const t = useT('online');
  const tc = useT('common');
  const toast = useToast();
  const { location } = data;

  const [workplaces, setWorkplaces] = useState<Workplace[]>(data.staff.workplaces);
  const [homeAddress, setHomeAddress] = useState(data.staff.homeAddress ?? '');
  const [homeDistrict, setHomeDistrict] = useState<DistrictId | ''>(data.staff.homeDistrict ?? '');
  const [visitDistricts, setVisitDistricts] = useState<DistrictId[]>(data.staff.visitDistricts ?? []);
  const [travelFee, setTravelFee] = useState<number | undefined>(data.rules.travelFee);
  const [travelTimeMin, setTravelTimeMin] = useState<number | undefined>(data.rules.travelTimeMin);
  const [yandexMapsUrl, setYandexMapsUrl] = useState(location?.yandexMapsUrl ?? '');
  const [district, setDistrict] = useState<DistrictId | ''>(location?.district ?? '');
  const [locating, setLocating] = useState(false);
  const [justMarked, setJustMarked] = useState(false);

  const staffMutation = useApiMutation((patch: Parameters<typeof updateStaffPlaces>[1]) => updateStaffPlaces(staffId, patch));
  const locationMutation = useApiMutation((args: { id: string; patch: Parameters<typeof updateLocationPlace>[1] }) =>
    updateLocationPlace(args.id, args.patch),
  );
  const rulesMutation = useApiMutation((patch: Parameters<typeof updateStaffRules>[1]) => updateStaffRules(staffId, patch));

  const toggleWorkplace = (wp: Workplace) => setWorkplaces((prev) => (prev.includes(wp) ? prev.filter((x) => x !== wp) : [...prev, wp]));
  const toggleVisitDistrict = (id: DistrictId) => setVisitDistricts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // О30: одна кнопка «Сохранить» — и места мастера, и адрес салона, если он отмечен
  const saveAll = async () => {
    try {
      await staffMutation.mutate({
        workplaces,
        homeAddress: homeAddress.trim() || undefined,
        homeDistrict: homeDistrict || undefined,
        visitDistricts,
      });
      await rulesMutation.mutate({ travelFee, travelTimeMin });
      const locationChanged =
        location && ((yandexMapsUrl.trim() || undefined) !== location.yandexMapsUrl || (district || undefined) !== location.district);
      if (location && workplaces.includes('salon') && locationChanged) {
        await locationMutation.mutate({
          id: location.id,
          patch: { yandexMapsUrl: yandexMapsUrl.trim() || undefined, district: district || undefined },
        });
      }
      toast.success(t('places.saved'));
    } catch {
      toast.error(t('places.saveFailed'));
    }
  };

  const markHere = () => {
    setJustMarked(false);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(t('places.geoUnsupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          if (location) {
            await locationMutation.mutate({ id: location.id, patch: { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } } });
            setJustMarked(true);
          }
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error(t('places.geoFailed'));
      },
      { timeout: 8000 },
    );
  };

  const saving = staffMutation.isPending || rulesMutation.isPending || locationMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
        <SectionCard title={t('places.list.title')}>
          <div className="flex flex-col gap-1">
            {WORKPLACE_IDS.map((wp) => (
              <Checkbox
                key={wp}
                checked={workplaces.includes(wp)}
                onCheckedChange={() => toggleWorkplace(wp)}
                label={t(`places.workplace.${wp}` as never)}
                description={t(`places.workplaceHint.${wp}` as never)}
                className="py-2"
                data-f={wp === 'visit' ? 'F-00-078' : wp === 'online' ? 'F-00-081' : undefined}
              />
            ))}
          </div>
        </SectionCard>

        {workplaces.includes('salon') && location && (
          <div data-f="F-00-074 F-00-075 F-00-076 F-13-213">
            <SectionCard title={t('places.salon.title')} description={location.address ? location.address.ru : undefined}>
              <div className="flex flex-col gap-3">
                <FormField label={t('places.salon.yandexUrl')} optional>
                  <Input value={yandexMapsUrl} onChange={(e) => setYandexMapsUrl(e.target.value)} placeholder="https://yandex.ru/maps/..." />
                </FormField>
                <FormField label={t('places.salon.district')} required>
                  <Select
                    value={district}
                    onValueChange={(v) => setDistrict(v as DistrictId)}
                    placeholder={t('places.salon.districtPlaceholder')}
                    options={DISTRICT_IDS.map((id) => ({ value: id, label: tc(`districts.${id}` as never) }))}
                  />
                </FormField>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" leftIcon={<MapPin aria-hidden />} loading={locating} onClick={markHere}>
                    {t('places.salon.markHere')}
                  </Button>
                  {justMarked && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 aria-hidden className="size-4" />
                      {t('places.salon.marked')}
                    </span>
                  )}
                  {location.coords && !justMarked && <span className="text-sm text-muted">{t('places.salon.hasCoords')}</span>}
                </div>
                {yandexMapsUrl && (
                  <a
                    href={yandexMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-primary-text hover:underline"
                  >
                    {t('places.salon.openLink')}
                    <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {workplaces.includes('home') && (
          <div data-f="F-00-077">
            <SectionCard title={t('places.home.title')} description={t('places.home.hint')}>
              <div className="flex flex-col gap-3">
                <FormField label={t('places.home.address')}>
                  <Input value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} placeholder={t('places.home.addressPlaceholder')} />
                </FormField>
                <FormField label={t('places.home.district')} required>
                  <Select
                    value={homeDistrict}
                    onValueChange={(v) => setHomeDistrict(v as DistrictId)}
                    placeholder={t('places.salon.districtPlaceholder')}
                    options={DISTRICT_IDS.map((id) => ({ value: id, label: tc(`districts.${id}` as never) }))}
                  />
                </FormField>
              </div>
            </SectionCard>
          </div>
        )}

        {workplaces.includes('visit') && (
          <div data-f="F-00-080">
            <SectionCard title={t('places.visit.title')} description={t('places.visit.hint')}>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-fg">{t('places.visit.districts')}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                    {DISTRICT_IDS.map((id) => (
                      <Checkbox
                        key={id}
                        checked={visitDistricts.includes(id)}
                        onCheckedChange={() => toggleVisitDistrict(id)}
                        label={tc(`districts.${id}` as never)}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label={t('places.visit.fee')} optional>
                    <MoneyInput value={travelFee} onValueChange={setTravelFee} />
                  </FormField>
                  <FormField label={t('places.visit.time')} optional>
                    <Input
                      type="number"
                      min={0}
                      value={travelTimeMin ?? ''}
                      onChange={(e) => setTravelTimeMin(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="30"
                    />
                  </FormField>
                </div>
                <Badge tone="warning" variant="soft" className="w-fit">
                  {t('places.visit.alwaysManual')}
                </Badge>
              </div>
            </SectionCard>
          </div>
        )}

        {workplaces.includes('online') && (
          <p className="text-sm text-muted" data-f="F-00-081">
            {t('places.online.hint')}
          </p>
        )}

        <StickyActionBar>
          <Button loading={saving} onClick={saveAll}>
            {t('places.save')}
          </Button>
        </StickyActionBar>
    </div>
  );
}

/**
 * Скелетон формы мест — та же разметка, что PlacesForm у мастера салона (самый частый случай): список мест с
 * подсказками, карточка салона с полями и «Отметить здесь», «Сохранить» внизу; всё выключено до данных.
 */
function PlacesFormSkeleton() {
  const t = useT('online');
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <SectionCard title={t('places.list.title')}>
        <div className="flex flex-col gap-1">
          {WORKPLACE_IDS.map((wp) => (
            <Checkbox
              key={wp}
              checked={false}
              disabled
              onCheckedChange={() => undefined}
              label={t(`places.workplace.${wp}` as never)}
              description={t(`places.workplaceHint.${wp}` as never)}
              className="py-2"
            />
          ))}
        </div>
      </SectionCard>
      <SectionCard title={t('places.salon.title')} description={<SkeletonText width="24ch" />}>
        <div className="flex flex-col gap-3">
          <FormField label={t('places.salon.yandexUrl')} optional>
            <Input value="" readOnly disabled placeholder="https://yandex.ru/maps/..." />
          </FormField>
          <FormField label={t('places.salon.district')} required>
            <Select value="" onValueChange={() => undefined} disabled placeholder={t('places.salon.districtPlaceholder')} options={[]} />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" leftIcon={<MapPin aria-hidden />} disabled>
              {t('places.salon.markHere')}
            </Button>
            <span className="text-sm text-muted">
              <SkeletonText width="14ch" />
            </span>
          </div>
          <span className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-primary-text">
            {t('places.salon.openLink')}
            <ExternalLink aria-hidden className="size-3.5" />
          </span>
        </div>
      </SectionCard>
      <StickyActionBar className="animate-none">
        {/* Как у формы (кнопка не выключена — в панели она та же); до данных нажатие ничего не делает */}
        <Button onClick={() => undefined}>{t('places.save')}</Button>
      </StickyActionBar>
    </div>
  );
}
