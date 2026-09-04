import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Public-information firewall (project invariant #1). Worker D's fallback
 * analysis and its overlay panels must consume ONLY PublicView — never
 * GameState or the hidden-tile fields on it. Worker C enforces the same for the
 * real @analysis; this guards D's stand-in and UI so the training premise holds
 * even before C lands.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('public-information firewall (Worker D)', () => {
  it('fallback analysis does not import or reference GameState', () => {
    const src = read('src/state/fallbackAnalysis.ts');
    expect(src).not.toMatch(/\bGameState\b/);
    // must not read hidden wall / dead wall / ura from anything
    expect(src).not.toMatch(/\.deadWall\b/);
    expect(src).not.toMatch(/\.uraIndicators\b/);
  });

  it('overlay panels only receive PublicView-derived data', () => {
    // A panel may call the adapter directly, or through a hook that does. The
    // rule is that analysis is never computed inline in a component and never
    // reaches for anything outside PublicView.
    const routes = /@state\/analysisAdapter|@ui\/hooks\/useYakuAdvisor/;
    for (const f of [
      'src/ui/overlays/YakuAdvisorPanel.tsx',
      'src/ui/overlays/OpponentReadingPanel.tsx',
      'src/ui/overlays/WaitGuessingPanel.tsx',
    ]) {
      const src = read(f);
      expect(src).not.toMatch(/\bGameState\b/);
      expect(src).toMatch(routes);
    }
  });

  it('the advisor hook and its worker also route through the adapter', () => {
    for (const f of [
      'src/ui/hooks/useYakuAdvisor.ts',
      'src/ui/workers/yakuAdvisor.worker.ts',
    ]) {
      const src = read(f);
      expect(src).not.toMatch(/\bGameState\b/);
      expect(src).toMatch(/@state\/analysisAdapter/);
    }
  });

  it('the full-game simulator builds a state, but is never handed one', () => {
    const src = read('src/sim/fullGameSim.ts');
    // It is allowed to name GameState — it constructs one — but every entry
    // point must take a PublicView, and it must never reach into the live game.
    expect(src).not.toMatch(/from '@state/);
    expect(src).not.toMatch(/useMatch|useSession/);
    for (const m of src.matchAll(/export function (\w+)\(([^)]*)\)/g)) {
      const [, name, args] = m;
      if (name === 'simulateFullGames' || name === 'determinize') {
        expect(args).toMatch(/view: PublicView/);
      }
      expect(args).not.toMatch(/: GameState/);
    }
  });

  it('the yaku simulator reads nothing but the public view', () => {
    const src = read('src/analysis/yakuSim.ts');
    expect(src).not.toMatch(/\bGameState\b/);
    expect(src).not.toMatch(/\.deadWall\b/);
    expect(src).not.toMatch(/\.uraIndicators\b/);
    // opponents' concealed tiles are not a field it could read even by accident
    expect(src).not.toMatch(/\.players\b/);
  });
});
