import { CertificateDetailScreen } from '@/areas/client/certificates/CertificateDetailScreen';

// /certificates/[certificateId] — карточка сертификата (F-14-040)
export default async function Page({ params }: PageProps<'/certificates/[certificateId]'>) {
  const { certificateId } = await params;
  return <CertificateDetailScreen certificateId={certificateId} />;
}
