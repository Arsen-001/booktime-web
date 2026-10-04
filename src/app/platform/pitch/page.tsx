import { PITCH_DECKS } from '@/areas/platform/pitch/decks.server';
import { PitchScreen } from '@/areas/platform/pitch/PitchScreen';

export default function Page() {
  return <PitchScreen decks={PITCH_DECKS} />;
}
