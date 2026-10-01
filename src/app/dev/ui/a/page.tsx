import type { Metadata } from 'next';
import { ShowcaseA } from '@/dev/showcase/ShowcaseA';

export const metadata: Metadata = { title: 'UI-кит A' };

export default function DevUiAPage() {
  return (
    <main data-showcase className="mx-auto max-w-5xl px-4 py-6">
      <ShowcaseA />
    </main>
  );
}
