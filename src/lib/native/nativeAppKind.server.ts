import 'server-only';
import { headers } from 'next/headers';
import { nativeAppKindFromUserAgent, type NativeAppKind } from '@/lib/native/bridge';

/** Какое наше приложение открыло страницу (строка браузера «… BookTimeApp/business»); null — обычный браузер */
export async function getNativeAppKind(): Promise<NativeAppKind | null> {
  return nativeAppKindFromUserAgent((await headers()).get('user-agent'));
}
