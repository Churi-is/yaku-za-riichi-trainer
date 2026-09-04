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
    for (const f of [
      'src/ui/overlays/YakuAdvisorPanel.tsx',
      'src/ui/overlays/OpponentReadingPanel.tsx',
      'src/ui/overlays/WaitGuessingPanel.tsx',
    ]) {
      const src = read(f);
      expect(src).not.toMatch(/\bGameState\b/);
      // overlays route analysis through the adapter, never compute it inline
      expect(src).toMatch(/@state\/analysisAdapter/);
    }
  });
});
