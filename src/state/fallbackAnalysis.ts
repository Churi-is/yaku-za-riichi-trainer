/**
 * Fallback analysis (Worker D). Temporary stand-in for @analysis until Worker C
 * lands, so the overlays and replay grading show real content in the demo.
 *
 * CRITICAL: like Worker C's module, every function here takes ONLY a PublicView
 * (grading additionally takes the recorded log, whose viewBefore snapshots are
 * themselves PublicViews). Nothing here reads hidden tiles. When Worker C's
 * branch merges, the analysis adapter routes to the real module and none of
 * this runs — but because both go through the adapter, live overlays and replay
 * grades stay consistent by construction.
 */
import type { PublicView, SeatIndex, TileKind, YakuId } from '@engine/types';
import type {
  AlternativeAction, Grade, GradedTurn, MistakeCategory, OpponentRead,
  OpponentWaitRead, ProbabilityBand, ReadSignal, RiskLevel, WaitGuess,
  WaitGuessRecord, YakuSuggestion,
} from '@analysis/types';
import type { ActionLogEntry } from '@replay/types';
import { shanten, ukeire, waits } from './engineAdapter';
import { kindOf } from './mahjong';

// ---------------------------------------------------------------------------
// Shared tile helpers (public-only)
// ---------------------------------------------------------------------------

function suitOf(k: TileKind): 0 | 1 | 2 | 3 {
  if (k < 9) return 0;
  if (k < 18) return 1;
  if (k < 27) return 2;
  return 3;
}
function isHonor(k: TileKind): boolean { return k >= 27; }
function isTerminal(k: TileKind): boolean { return k < 27 && (k % 9 === 0 || k % 9 === 8); }
function isTerminalOrHonor(k: TileKind): boolean { return isHonor(k) || isTerminal(k); }

const SUIT_NAME = ['characters', 'circles', 'bamboo'];
const YAKU_DEF: Partial<Record<YakuId, { name: string; closed: number; open: number | null; def: string }>> = {
  riichi: { name: 'Riichi', closed: 1, open: null, def: 'Declared ready hand while fully concealed.' },
  menzenTsumo: { name: 'Menzen Tsumo', closed: 1, open: null, def: 'Self-draw win with a concealed hand.' },
  pinfu: { name: 'Pinfu', closed: 1, open: null, def: 'All sequences, a valueless pair, and a two-sided wait.' },
  tanyao: { name: 'Tanyao', closed: 1, open: 1, def: 'No terminals or honors anywhere in the hand.' },
  yakuhaiHaku: { name: 'Yakuhai (White)', closed: 1, open: 1, def: 'A triplet of the White dragon.' },
  yakuhaiHatsu: { name: 'Yakuhai (Green)', closed: 1, open: 1, def: 'A triplet of the Green dragon.' },
  yakuhaiChun: { name: 'Yakuhai (Red)', closed: 1, open: 1, def: 'A triplet of the Red dragon.' },
  yakuhaiRoundWind: { name: 'Yakuhai (Round Wind)', closed: 1, open: 1, def: 'A triplet of the current round wind.' },
  yakuhaiSeatWind: { name: 'Yakuhai (Seat Wind)', closed: 1, open: 1, def: 'A triplet of your own seat wind.' },
  chiitoitsu: { name: 'Chiitoitsu', closed: 2, open: null, def: 'Seven distinct pairs.' },
  toitoi: { name: 'Toitoi', closed: 2, open: 2, def: 'All triplets and a pair, no sequences.' },
  sanshokuDoujun: { name: 'Sanshoku Doujun', closed: 2, open: 1, def: 'The same sequence in all three suits.' },
  ittsu: { name: 'Ittsu', closed: 2, open: 1, def: 'The 1-2-3, 4-5-6, 7-8-9 runs in one suit.' },
  chanta: { name: 'Chanta', closed: 2, open: 1, def: 'Every set contains a terminal or honor.' },
  honitsu: { name: 'Honitsu', closed: 3, open: 2, def: 'One suit plus honors only.' },
  chinitsu: { name: 'Chinitsu', closed: 6, open: 5, def: 'A single suit, no honors.' },
  junchan: { name: 'Junchan', closed: 3, open: 2, def: 'Every set contains a terminal (no honors).' },
  sanankou: { name: 'Sanankou', closed: 2, open: 2, def: 'Three concealed triplets.' },
  shousangen: { name: 'Shousangen', closed: 2, open: 2, def: 'Two dragon triplets plus a pair of the third.' },
};

function hanLabel(y: NonNullable<typeof YAKU_DEF[YakuId]>): string {
  if (y.open === null) return `${y.closed} (closed only)`;
  return `${y.closed} / ${y.open}`;
}

function bandFromScore(score: number): ProbabilityBand {
  if (score >= 0.8) return 'Very high';
  if (score >= 0.55) return 'High';
  if (score >= 0.32) return 'Medium';
  if (score >= 0.15) return 'Low';
  return 'Very low';
}

// ---------------------------------------------------------------------------
// Overlay A — yaku advisor
//
// DELETED. There is exactly one yaku advisor now: the Monte-Carlo one in
// @analysis/yakuAdvisor. The heuristic that used to live here scored hands
// with hand-written constants and printed them as percentages; keeping a
// second, differently-wrong implementation around as a "fallback" only made
// it possible to ship the wrong numbers by accident. `suggestYaku` in the
// adapter now calls the real module unconditionally.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Overlay B — opponent reading
// ---------------------------------------------------------------------------

export function readOpponents(view: PublicView): OpponentRead[] {
  const out: OpponentRead[] = [];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    if (s === view.viewer) continue;
    out.push(readOne(view, s));
  }
  return out;
}

function readOne(view: PublicView, seat: SeatIndex): OpponentRead {
  const p = view.seats[seat];
  const handDirection: ReadSignal[] = [];
  const riverCues: ReadSignal[] = [];

  // Melds → yaku direction
  const meldKinds = p.melds.flatMap((m) => m.tiles.map(kindOf));
  const meldSuitCounts = [0, 0, 0, 0];
  for (const k of meldKinds) meldSuitCounts[suitOf(k)]++;
  for (const m of p.melds) {
    const k = kindOf(m.tiles[0]);
    if (m.type === 'pon' || m.type === 'minkan' || m.type === 'kakan') {
      if (k >= 31) handDirection.push({ text: 'Called a dragon — likely a yakuhai hand', why: 'An open dragon triplet is an instant yaku; players call these to open up quickly.' });
      else if (k >= 27) handDirection.push({ text: 'Called an honor wind — possibly yakuhai', why: 'Wind triplets score only if they match the seat or round wind; a called wind hints at that.' });
    }
  }

  // Honitsu/chinitsu from river + melds discards concentration
  const riverKinds = p.river.filter((d) => d.calledBy === null).map((d) => kindOf(d.tile));
  const discardSuit = [0, 0, 0, 0];
  for (const k of riverKinds) discardSuit[suitOf(k)]++;
  const totalDiscards = riverKinds.length;
  if (totalDiscards >= 6) {
    for (let suit = 0; suit < 3; suit++) {
      if (discardSuit[suit] === 0 && (discardSuit[(suit + 1) % 3] + discardSuit[(suit + 2) % 3]) >= 5) {
        handDirection.push({
          text: `Possible flush in ${SUIT_NAME[suit]}`,
          why: `Almost no ${SUIT_NAME[suit]} discarded while shedding the other suits suggests collecting one suit (honitsu / chinitsu).`,
        });
        break;
      }
    }
  }

  // River cues: early honors then simples
  if (totalDiscards >= 4) {
    const earlyHonors = riverKinds.slice(0, 3).filter(isHonor).length;
    if (earlyHonors >= 2) riverCues.push({ text: 'Dropped honors early — going for speed', why: 'Discarding honors first usually means a fast tanyao/pinfu-style hand rather than a value hand.' });
    const lateTerminals = riverKinds.slice(-3).filter(isTerminalOrHonor).length;
    if (lateTerminals >= 2) riverCues.push({ text: 'Shedding terminals late — hand may be settling', why: 'Late terminal/honor discards often mean the shape is set and safe tiles are going out.' });
  }

  // Threat
  const riichi = p.riichi;
  const openMelds = p.melds.filter((m) => m.type !== 'ankan').length;
  const likelyTenpai = riichi || (openMelds >= 2 && totalDiscards >= 7) || (openMelds >= 3);
  let threatNote = 'Building — no strong tenpai signal yet.';
  if (riichi) threatNote = 'Riichi declared — treat as tenpai now.';
  else if (likelyTenpai) threatNote = 'Several calls and a long river — probably close to tenpai.';

  // Deal-in risk
  let risk: RiskLevel = 'Low';
  let riskWhy = 'No riichi and few calls; discarding is relatively safe.';
  if (riichi) { risk = 'High'; riskWhy = 'A declared riichi is live tenpai — any non-safe tile can deal in.'; }
  else if (likelyTenpai) { risk = 'Medium'; riskWhy = 'Open tempo suggests tenpai may be close; watch your dangerous tiles.'; }

  // Safe/danger tiles (genbutsu + suji), public-only
  const { safe, danger } = safeAndDanger(view, seat);

  return {
    seat,
    handDirection,
    riverCues,
    threat: { riichi, likelyTenpai, note: threatNote },
    dealInRisk: risk,
    dealInRiskWhy: riskWhy,
    safeTiles: safe,
    dangerTiles: danger,
  };
}

function safeAndDanger(view: PublicView, seat: SeatIndex): { safe: TileKind[]; danger: TileKind[] } {
  const p = view.seats[seat];
  // Genbutsu: anything in this opponent's river is safe against them.
  const genbutsu = new Set<TileKind>(p.river.map((d) => kindOf(d.tile)));
  // Also tiles in everyone's river after their riichi are safe-ish; keep simple: own river only.
  const safe = [...genbutsu];

  // Suji: if 4/5/6 of a suit is in genbutsu, the connecting suji is a bit safer.
  const suji = new Set<TileKind>();
  for (const k of genbutsu) {
    if (k >= 27) continue;
    const r = k % 9;
    const base = Math.floor(k / 9) * 9;
    if (r === 3) suji.add(base + 0); // 4 safe -> 1 suji
    if (r === 4) { suji.add(base + 1); suji.add(base + 7); } // 5 -> 2,8
    if (r === 5) suji.add(base + 8); // 6 -> 9
    if (r === 0) suji.add(base + 3);
    if (r === 8) suji.add(base + 5);
  }

  // Danger: honors not yet seen 3x and middle tiles not in genbutsu/suji, only meaningful if threat.
  const danger: TileKind[] = [];
  if (p.riichi || p.melds.filter((m) => m.type !== 'ankan').length >= 2) {
    for (let k = 0; k < 34; k++) {
      if (genbutsu.has(k) || suji.has(k)) continue;
      if (view.visibleCounts[k] >= 4) continue;
      // middle suited tiles are the classic danger
      if (k < 27) {
        const r = k % 9;
        if (r >= 2 && r <= 6) danger.push(k);
      } else {
        // live honors are dangerous if few visible
        if (view.visibleCounts[k] <= 1) danger.push(k);
      }
    }
  }

  return { safe: [...new Set([...safe, ...suji])], danger };
}

// ---------------------------------------------------------------------------
// Overlay C — wait guessing
// ---------------------------------------------------------------------------

export function guessWaits(view: PublicView): OpponentWaitRead[] {
  const out: OpponentWaitRead[] = [];
  for (let s = 0 as SeatIndex; s < 4; s = (s + 1) as SeatIndex) {
    if (s === view.viewer) continue;
    const p = view.seats[s];
    const openMelds = p.melds.filter((m) => m.type !== 'ankan').length;
    const tenpaiLikely = p.riichi || openMelds >= 2 || (p.river.length >= 10 && openMelds >= 1);
    if (!tenpaiLikely) { out.push({ seat: s, tenpaiLikely: false, guesses: [] }); continue; }
    out.push({ seat: s, tenpaiLikely: true, guesses: waitGuessesFor(view, s) });
  }
  return out;
}

function waitGuessesFor(view: PublicView, seat: SeatIndex): WaitGuess[] {
  const p = view.seats[seat];
  const guesses: WaitGuess[] = [];

  // Cue 1: riichi declaration tile suji — the declared tile is safe, its suji are candidate waits.
  const decl = p.river.find((d) => d.riichiDeclaration);

  // Cue 2: suits the opponent is NOT discarding are where the wait likely lives.
  const riverKinds = p.river.filter((d) => d.calledBy === null).map((d) => kindOf(d.tile));
  const discardSuit = [0, 0, 0, 0];
  for (const k of riverKinds) discardSuit[suitOf(k)]++;

  // Candidate danger kinds not visible-exhausted and not in their own river.
  const genbutsu = new Set(riverKinds);
  const liveMiddle: TileKind[] = [];
  for (let k = 0; k < 27; k++) {
    const r = k % 9;
    if (r >= 3 && r <= 5 && !genbutsu.has(k) && view.visibleCounts[k] < 4) liveMiddle.push(k);
  }

  // If a suit is heavily discarded, the wait is likely NOT there.
  const suspectSuits = [0, 1, 2].sort((a, b) => discardSuit[a] - discardSuit[b]);
  const primarySuit = suspectSuits[0];
  const primaryWaits = liveMiddle.filter((k) => suitOf(k) === primarySuit);
  if (primaryWaits.length) {
    guesses.push({
      kinds: primaryWaits.slice(0, 4),
      label: `Middle ${SUIT_NAME[primarySuit]} (${primaryWaits.slice(0, 4).map(kindStr).join(', ')})`,
      confidence: 'Medium',
      reasoning: `They've discarded the fewest ${SUIT_NAME[primarySuit]} tiles, so a two-sided wait likely sits in that suit.`,
    });
  }

  if (decl) {
    const dk = kindOf(decl.tile);
    if (dk < 27) {
      const base = Math.floor(dk / 9) * 9;
      const r = dk % 9;
      const sujiKinds: TileKind[] = [];
      if (r - 3 >= 0) sujiKinds.push(base + r - 3);
      if (r + 3 <= 8) sujiKinds.push(base + r + 3);
      const live = sujiKinds.filter((k) => !genbutsu.has(k) && view.visibleCounts[k] < 4);
      if (live.length) {
        guesses.push({
          kinds: live,
          label: `Suji off the riichi tile (${live.map(kindStr).join(', ')})`,
          confidence: 'Low',
          reasoning: `The riichi was declared on ${kindStr(dk)}; a ryanmen through that tile leaves these suji as candidate waits.`,
        });
      }
    }
  }

  // Honor/tanki fallback: live honors they hold could be a pair wait.
  const liveHonors: TileKind[] = [];
  for (let k = 27; k < 34; k++) if (!genbutsu.has(k) && view.visibleCounts[k] <= 1) liveHonors.push(k);
  if (liveHonors.length && guesses.length < 3) {
    guesses.push({
      kinds: liveHonors.slice(0, 3),
      label: `Honor tanki (${liveHonors.slice(0, 3).map(kindStr).join(', ')})`,
      confidence: 'Low',
      reasoning: 'Barely-seen honors can hide a single-tile pair wait, especially in a value hand.',
    });
  }

  return guesses.slice(0, 3);
}

function kindStr(k: TileKind): string {
  if (k < 9) return `${(k % 9) + 1}m`;
  if (k < 18) return `${(k % 9) + 1}p`;
  if (k < 27) return `${(k % 9) + 1}s`;
  return ['E', 'S', 'W', 'N', 'Haku', 'Hatsu', 'Chun'][k - 27];
}

// ---------------------------------------------------------------------------
// Replay grading
// ---------------------------------------------------------------------------

export function gradeMatch(log: ActionLogEntry[]): GradedTurn[] {
  const out: GradedTurn[] = [];
  for (const entry of log) {
    if (entry.seat !== 0) continue;
    if (!entry.viewBefore) continue;
    const a = entry.action;
    if (a.type !== 'discard' && a.type !== 'chi' && a.type !== 'pon'
      && a.type !== 'ron' && a.type !== 'tsumo' && a.type !== 'ankan'
      && a.type !== 'minkan' && a.type !== 'kakan' && a.type !== 'pass') continue;
    out.push(gradeTurn(entry));
  }
  return out;
}

function gradeTurn(entry: ActionLogEntry): GradedTurn {
  const view = entry.viewBefore!;
  const a = entry.action;
  const me = view.seats[0];
  const fullHand = view.drawnTile !== null ? [...view.hand, view.drawnTile] : [...view.hand];
  const meldCount = me.melds.length;

  const shBefore = safeCall(() => shanten(fullHand, me.melds), 6);
  const ukBefore = safeCall(() => sumUkeire(fullHand, me.melds, view.visibleCounts), 0);

  // Winning actions are always excellent.
  if (a.type === 'tsumo' || a.type === 'ron') {
    return {
      handId: entry.handId,
      turnNumber: entry.seq,
      actionLabel: a.type === 'tsumo' ? 'Declared tsumo' : 'Declared ron',
      grade: 'Excellent',
      category: 'none',
      explanation: 'Completing the hand is the correct call — take the win.',
      alternatives: [],
      shantenBefore: shBefore,
      shantenAfter: -1,
      ukeireBefore: ukBefore,
      ukeireAfter: 0,
    };
  }

  if (a.type === 'discard') {
    return gradeDiscard(entry, view, fullHand, meldCount, shBefore, ukBefore);
  }

  // Calls (chi/pon/kan) and pass — coarse judgment on tempo.
  const label = a.type === 'pass' ? 'Passed on a call' : `Called ${a.type}`;
  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: label,
    grade: 'Fair',
    category: a.type === 'pass' ? 'callJudgment' : 'callJudgment',
    explanation: a.type === 'pass'
      ? 'Passing keeps your hand closed and your riichi/menzen value intact — reasonable unless you badly needed the tempo.'
      : 'Opening the hand trades concealed value for speed. Worth it when it gives a clear yaku or big shape jump.',
    alternatives: [],
    shantenBefore: shBefore,
    shantenAfter: shBefore,
    ukeireBefore: ukBefore,
    ukeireAfter: ukBefore,
  };
}

function gradeDiscard(
  entry: ActionLogEntry, view: PublicView, fullHand: number[], meldCount: number,
  shBefore: number, ukBefore: number,
): GradedTurn {
  const a = entry.action as Extract<ActionLogEntry['action'], { type: 'discard' }>;
  const me = view.seats[0];

  // Evaluate every legal discard candidate for shanten/ukeire.
  const candidates = uniqueKinds(fullHand);
  type Cand = { tileId: number; kind: number; sh: number; uk: number };
  const evals: Cand[] = [];
  for (const id of candidates) {
    const rest = removeOne(fullHand, id);
    const sh = safeCall(() => shanten(rest, me.melds), 6);
    const uk = safeCall(() => sumUkeire(rest, me.melds, view.visibleCounts), 0);
    evals.push({ tileId: id, kind: kindOf(id), sh, uk });
  }
  // Best = lowest shanten, then highest ukeire.
  evals.sort((x, y) => x.sh - y.sh || y.uk - x.uk);
  const best = evals[0];
  const chosenRest = removeOne(fullHand, a.tile);
  const shAfter = safeCall(() => shanten(chosenRest, me.melds), 6);
  const ukAfter = safeCall(() => sumUkeire(chosenRest, me.melds, view.visibleCounts), 0);
  const chosen = evals.find((e) => e.kind === kindOf(a.tile)) ?? { sh: shAfter, uk: ukAfter, kind: kindOf(a.tile), tileId: a.tile };

  // Defensive context: is anyone threatening (riichi)?
  const threat = Object.values(view.seats).some((s) => s.seat !== 0 && s.riichi);
  const discardIsGenbutsu = threat && Object.values(view.seats).some(
    (s) => s.seat !== 0 && s.riichi && s.river.some((d) => kindOf(d.tile) === kindOf(a.tile)),
  );

  let grade: Grade;
  let category: MistakeCategory = 'none';
  let explanation: string;

  const shLoss = chosen.sh - best.sh;
  const ukLoss = best.uk - chosen.uk;

  if (threat && discardIsGenbutsu && a.tile !== best.tileId) {
    grade = 'Good';
    category = 'pushFold';
    explanation = 'A safe (genbutsu) discard against a live riichi. Slightly slower for your hand, but defending is sound here.';
  } else if (shLoss > 0) {
    grade = shLoss >= 2 ? 'Blunder' : 'Poor';
    category = 'efficiency';
    explanation = `This discard moved you ${shLoss} step${shLoss > 1 ? 's' : ''} further from tenpai than the best keep. It costs progress toward a ready hand.`;
  } else if (ukLoss > 4) {
    grade = 'Fair';
    category = 'efficiency';
    explanation = `Same shanten, but this discard narrows your acceptance by about ${ukLoss} tiles versus the widest option.`;
  } else if (ukLoss > 0) {
    grade = 'Good';
    category = 'efficiency';
    explanation = 'Keeps you at the same distance from tenpai with only a small loss of tile acceptance — a fine, near-optimal choice.';
  } else {
    grade = 'Excellent';
    category = 'none';
    explanation = shBefore === 0
      ? 'Maintains your tenpai with maximal acceptance — the textbook discard.'
      : 'Maximises both shanten progress and tile acceptance — the efficient discard.';
  }

  if (threat && !discardIsGenbutsu && chosen.sh > 0 && grade !== 'Blunder') {
    // pushing a non-safe tile while not tenpai against a riichi
    category = 'pushFold';
    if (grade === 'Excellent' || grade === 'Good') {
      grade = 'Fair';
      explanation += ' Note: there is a live riichi and you pushed a non-safe tile while not yet tenpai — consider folding.';
    }
  }

  // Build alternatives (revealed only in replay).
  const alternatives: AlternativeAction[] = evals
    .filter((e) => e.kind !== kindOf(a.tile))
    .slice(0, 3)
    .map((e) => ({
      label: `Discard ${kindStr(e.kind)}`,
      reasoning: `Leaves you at ${e.sh === -1 ? 'a complete hand' : `${e.sh}-shanten`} with about ${e.uk} tiles of acceptance.`,
      score: -(e.sh * 100) + e.uk,
    }))
    .sort((x, y) => y.score - x.score);

  return {
    handId: entry.handId,
    turnNumber: entry.seq,
    actionLabel: `Discard ${kindStr(kindOf(a.tile))}${a.riichi ? ' + Riichi' : ''}`,
    grade,
    category,
    explanation,
    alternatives,
    shantenBefore: shBefore,
    shantenAfter: shAfter,
    ukeireBefore: ukBefore,
    ukeireAfter: ukAfter,
  };
}

function uniqueKinds(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    const k = kindOf(id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
  }
  return out;
}
function removeOne(ids: number[], id: number): number[] {
  const out = [...ids];
  const i = out.findIndex((x) => kindOf(x) === kindOf(id));
  if (i >= 0) out.splice(i, 1);
  return out;
}
function sumUkeire(hand: number[], melds: PublicView['seats'][SeatIndex]['melds'], visible: number[]): number {
  return ukeire(hand, melds, visible).reduce((s, u) => s + u.count, 0);
}
function safeCall<T>(fn: () => T, fallbackVal: T): T {
  try { return fn(); } catch { return fallbackVal; }
}

// ---------------------------------------------------------------------------
// Practice-mode resolution
// ---------------------------------------------------------------------------

export function resolveWaitGuesses(records: WaitGuessRecord[], log: ActionLogEntry[]): WaitGuessRecord[] {
  // Find the revealed hand per (handId, seat) is NOT in the log entries;
  // the loop passes actual waits via HandLog. Here we can only resolve from
  // any viewBefore that exposes the seat's final wait — which public views do
  // not. So resolution is done by the loop using revealed hands; this fallback
  // leaves unresolved records untouched.
  void log;
  return records;
}
