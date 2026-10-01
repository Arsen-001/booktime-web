import { ClaimScreen } from '@/areas/client/claim/ClaimScreen';

// /claim/[token] — ссылка «Закрыть окно» из готового текста клиента (F-00-107)
export default async function Page({ params }: PageProps<'/claim/[token]'>) {
  const { token } = await params;
  return <ClaimScreen token={token} />;
}
