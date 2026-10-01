import { MotionToneShowcase } from '@/dev/showcase/MotionToneShowcase';
import { ShowcaseA } from '@/dev/showcase/ShowcaseA';
import { ShowcaseB } from '@/dev/showcase/ShowcaseB';
import { TokensShowcase } from '@/dev/showcase/TokensShowcase';

export const metadata = { title: 'UI-кит' };

// Витрина всех компонентов src/ui со всеми состояниями (dev-страница)
export default function UiShowcasePage() {
  return (
    <div data-showcase className="mx-auto flex max-w-5xl flex-col gap-14 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">UI-кит</h1>
        <p className="mt-2 text-muted">
          Токены, компоненты src/ui и их состояния. Тема и язык — демо-кнопкой справа внизу.
        </p>
      </header>
      <TokensShowcase />
      <MotionToneShowcase />
      <ShowcaseA />
      <ShowcaseB />
    </div>
  );
}
