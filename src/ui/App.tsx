/** App shell + screen router. Owned by Worker D. */
import { useSession } from '@state/session';
import MainMenu from './screens/MainMenu';
import TableSettingsScreen from './screens/TableSettingsScreen';
import MatchScreen from './screens/MatchScreen';

export default function App() {
  const screen = useSession((s) => s.screen);
  switch (screen) {
    case 'menu': return <MainMenu />;
    case 'settings': return <TableSettingsScreen />;
    case 'match': return <MatchScreen />;
    default: return <MainMenu />;
  }
}
