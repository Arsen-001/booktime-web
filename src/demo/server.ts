import 'server-only';
import { cookies } from 'next/headers';
import { DEMO_COOKIES, readDemoSettings, type DemoSettings } from '@/demo/settings';

/** Демо-настройки текущего запроса (из cookie). */
export async function getDemoSettings(): Promise<DemoSettings> {
  const jar = await cookies();
  return readDemoSettings((key) => jar.get(DEMO_COOKIES[key])?.value);
}
