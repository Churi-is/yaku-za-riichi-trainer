/** App shell + screen router. Owned by Worker D. */
import { useSession } from '@state/session';
import MainMenu from './screens/MainMenu';
import TableSettingsScreen from './screens/TableSettingsScreen';
import MatchScreen from './screens/MatchScreen';
import OpponentSelectScreen from './screens/OpponentSelectScreen';
import DojoScreen from './screens/DojoScreen';
import LessonScreen from './screens/LessonScreen';

export default function App() {
  const screen = useSession((s) => s.screen);
  switch (screen) {
    case 'menu': return <MainMenu />;
    case 'opponents': return <OpponentSelectScreen />;
    case 'settings': return <TableSettingsScreen />;
    case 'dojo': return <DojoScreen />;
    case 'lesson': return <LessonScreen />;
    case 'match': return <MatchScreen />;
    default: return <MainMenu />;
  }
}
