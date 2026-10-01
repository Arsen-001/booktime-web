import { AppGate } from '@/areas/client/apps/AppGate';
import { StoriesGeneratorScreen } from '@/areas/client/apps/StoriesGeneratorScreen';

// /biz/apps/stories — раздел «client»: генератор сторис + покупка (F-00-155…163, F-14-033…036, F-14-172).
export default function Page() {
  return (
    <AppGate permission="journal.view">
      <StoriesGeneratorScreen />
    </AppGate>
  );
}
