/** MatchScreen — placeholder. Owned by Worker D. */
import { useSession } from '@state/session';

export default function MatchScreen() {
  const go = useSession((s) => s.go);
  return (
    <div className="screen">
      <h1>MatchScreen</h1>
      <p>Placeholder — Worker D implements this screen.</p>
      <button onClick={() => go('menu')}>Back to menu</button>
    </div>
  );
}
