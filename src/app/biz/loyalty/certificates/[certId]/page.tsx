import { CertificateDetailScreen } from '@/areas/loyalty/certificates/CertificateDetailScreen';

// /biz/loyalty/certificates/[certId] — страница сертификата в сети (F-06-188, F-06-195).
export default async function Page({ params }: PageProps<'/biz/loyalty/certificates/[certId]'>) {
  const { certId } = await params;
  return <CertificateDetailScreen certId={certId} />;
}
