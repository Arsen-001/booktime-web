import { SettingsModuleScreen } from '@/areas/settings/SettingsModuleScreen';

// /biz/settings/modules/[area] — настройки раздела, которые живут только во вкладе хаба (Н7): один вклад на странице.
export default async function Page({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  return <SettingsModuleScreen area={area} />;
}
