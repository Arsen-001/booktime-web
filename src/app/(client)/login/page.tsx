import { LoginScreen } from '@/areas/client/login/LoginScreen';

// /login — вход клиента приложения (F-00-032, F-14-006…F-14-008)
export default async function Page({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const nextRaw = sp.next;
  const next = typeof nextRaw === 'string' ? nextRaw : '/';
  return <LoginScreen next={next} />;
}
