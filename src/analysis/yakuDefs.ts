/**
 * analysis/yakuDefs — Worker C.
 *
 * THE static yaku table. Descriptions are textbook DEFINITIONS ONLY and never
 * vary with the hand. The yaku advisor, opponent reading, wait guessing and
 * replay grading all share this table so names/han/descriptions can never
 * contradict each other.
 *
 * Han format matches the engine contract: closed/open, "Yakuman" for
 * yakuman, "Mangan" for renhou (accepted default), "-" where the yaku cannot
 * be open.
 */
import type { YakuId } from '@engine/types';

export interface YakuDef {
  id: YakuId;
  name: string;
  /** Closed/open han, e.g. "2 / 1". */
  hanClosed: number | null;
  hanOpen: number | null;
  hanLabel: string;
  /** Textbook definition. NEVER tile advice. NEVER hand-dependent. */
  description: string;
  /** Closed-only yaku become impossible once the hand is open. */
  closedOnly: boolean;
  openOnly: boolean;
  yakuman: boolean;
  /** True when this yaku can only be scored as part of a win by riichi, etc. */
  requiresWin: boolean;
}

const NO_OPEN = '—';

export const YAKU_DEFS: YakuDef[] = [
  {
    id: 'menzenTsumo', name: 'Menzen Tsumo', hanClosed: 1, hanOpen: null,
    hanLabel: `1 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A closed hand that wins by drawing the winning tile from the wall by itself, with no calls having been made.',
  },
  {
    id: 'riichi', name: 'Riichi', hanClosed: 1, hanOpen: null,
    hanLabel: `1 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A closed hand declared to be one tile from completion, announced by placing a 1,000-point stick on the table.',
  },
  {
    id: 'ippatsu', name: 'Ippatsu', hanClosed: 1, hanOpen: null,
    hanLabel: `1 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Winning within one uninterrupted go-around after declaring riichi, with no calls made by anyone in between.',
  },
  {
    id: 'pinfu', name: 'Pinfu', hanClosed: 1, hanOpen: null,
    hanLabel: `1 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A closed hand with four open-ended sequences and a non-scoring pair, winning on a two-sided wait with no added points from shape.',
  },
  {
    id: 'tanyao', name: 'Tanyao', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A hand composed entirely of middle tiles, with no terminals and no honors. Open hands may use it only when kuitan is allowed.',
  },
  {
    id: 'yakuhaiHaku', name: 'Yakuhai — White Dragon', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A triplet of the white dragon in a winning hand. A pair of dragons alone gives no yaku; it becomes one only as a triplet.',
  },
  {
    id: 'yakuhaiHatsu', name: 'Yakuhai — Green Dragon', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A triplet of the green dragon in a winning hand. Like all yakuhai it may be called openly and still counts.',
  },
  {
    id: 'yakuhaiChun', name: 'Yakuhai — Red Dragon', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A triplet of the red dragon in a winning hand. The only way to score a dragon as a pair is a full three-dragon hand.',
  },
  {
    id: 'yakuhaiRoundWind', name: 'Yakuhai — Round Wind', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A triplet of the wind matching the current round. Round wind is the most valuable wind in an East/South round because it doubles with the seat wind when possible.',
  },
  {
    id: 'yakuhaiSeatWind', name: 'Yakuhai — Seat Wind', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A triplet of your own seat wind. When your seat wind is also the round wind, the same triplet counts as two yakuhai.',
  },
  {
    id: 'doubleRiichi', name: 'Double Riichi', hanClosed: 2, hanOpen: null,
    hanLabel: `2 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A riichi declared on the very first turn, before any tile has been drawn, with the hand already one tile from completion.',
  },
  {
    id: 'chankan', name: 'Chankan', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Robbed a kan: winning on the tile an opponent just added to an existing triplet. Closed and open hands both qualify.',
  },
  {
    id: 'haitei', name: 'Haitei Raoyue', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Winning on the very last live tile of the hand, drawn from the wall. The last tile can never be won by discard.',
  },
  {
    id: 'houtei', name: 'Houtei Raoyui', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Winning on the final discard of the hand, the tile that empties the live wall without a draw.',
  },
  {
    id: 'rinshan', name: 'Rinshan Kaihou', hanClosed: 1, hanOpen: 1,
    hanLabel: '1 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Winning on the replacement tile drawn after declaring a kan. Only possible immediately after the kan.',
  },
  {
    id: 'chiitoitsu', name: 'Chiitoitsu', hanClosed: 2, hanOpen: null,
    hanLabel: `2 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Seven distinct pairs, forming a closed hand with no sequences or triplets. It is scored flat at 25 fu.',
  },
  {
    id: 'toitoi', name: 'Toitoi', hanClosed: 2, hanOpen: 2,
    hanLabel: '2 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Four triplets and a pair, with no sequences at all. It is the classic hand built entirely on calls.',
  },
  {
    id: 'sanshokuDoujun', name: 'Sanshoku Doujun', hanClosed: 2, hanOpen: 1,
    hanLabel: '2 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'The same three-number sequence in all three number suits. A closed hand scores it at 2 han, open at 1.',
  },
  {
    id: 'ittsu', name: 'Ittsu', hanClosed: 2, hanOpen: 1,
    hanLabel: '2 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Three complete sequences in one suit that together run the full length of that suit. Closed hands score it at 2 han, open at 1.',
  },
  {
    id: 'chanta', name: 'Chanta', hanClosed: 2, hanOpen: 1,
    hanLabel: '2 / 1', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Every sequence contains a terminal tile and every set contains a terminal or an honor. Honors are required in the scoring count.',
  },
  {
    id: 'honroutou', name: 'Honroutou', hanClosed: 2, hanOpen: 2,
    hanLabel: '2 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A hand made only of terminal tiles and honor tiles. It always overlaps with another yaku such as toitoi or chiitoitsu.',
  },
  {
    id: 'shousangen', name: 'Shousangen', hanClosed: 2, hanOpen: 2,
    hanLabel: '2 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Two dragon triplets plus a dragon pair. It is the small step below the full three-dragon yakuman.',
  },
  {
    id: 'sanankou', name: 'Sanankou', hanClosed: 2, hanOpen: 2,
    hanLabel: '2 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Three concealed triplets in one winning hand. A closed kan also counts as a concealed triplet.',
  },
  {
    id: 'sankantsu', name: 'Sankantsu', hanClosed: 2, hanOpen: 2,
    hanLabel: '2 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Three kans in one hand. Each kan also flips an extra dora indicator, so the hand is usually worth far more than its nominal han.',
  },
  {
    id: 'sanshokuDoukou', name: 'Sanshoku Doukou', hanClosed: 2, hanOpen: 2,
    hanLabel: '2 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'The same triplet of one rank in all three number suits.',
  },
  {
    id: 'honitsu', name: 'Honitsu', hanClosed: 3, hanOpen: 2,
    hanLabel: '3 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'One number suit plus honor tiles only, with no tiles of the other two number suits. Open hands score it at 2 han.',
  },
  {
    id: 'junchan', name: 'Junchan', hanClosed: 3, hanOpen: 2,
    hanLabel: '3 / 2', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Every sequence contains a terminal tile and every set contains a terminal. No honor tiles may appear — junchan is chanta without honors.',
  },
  {
    id: 'ryanpeikou', name: 'Ryanpeikou', hanClosed: 3, hanOpen: null,
    hanLabel: `3 / ${NO_OPEN}`, closedOnly: true, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Four pairs of sequences — the same sequence twice in two suits. A closed-only hand scored at 3 han, distinct from seven pairs.',
  },
  {
    id: 'chinitsu', name: 'Chinitsu', hanClosed: 6, hanOpen: 5,
    hanLabel: '6 / 5', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'A hand made entirely of one number suit, with no honors and no other suits. It also includes the related single-suit patterns.',
  },
  {
    id: 'renhou', name: 'Renhou', hanClosed: null, hanOpen: null,
    hanLabel: 'Mangan', closedOnly: false, openOnly: false, yakuman: false,
    requiresWin: true,
    description: 'Winning on a discarded tile on your very first draw of the hand, before you have made any call or discard.',
  },
  {
    id: 'kokushi', name: 'Kokushi Musou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: true, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Thirteen orphans: one of each terminal and honor tile plus one duplicate, forming the only hand with no sequences, triplets or pair structure.',
  },
  {
    id: 'suuankou', name: 'Suuankou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: true, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Four concealed triplets and a pair, won without any open call. Ron on the final tile cannot complete suuankou by triplet.',
  },
  {
    id: 'daisangen', name: 'Daisangen', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Triplets of all three dragons, plus any pair. The only non-yakuman part of the hand is its pair and final set.',
  },
  {
    id: 'shousuushi', name: 'Shousuushi', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Three wind triplets plus a pair of the fourth wind. One wind set shy of the full four-wind yakuman.',
  },
  {
    id: 'daisuushii', name: 'Daisuushii', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Triplets of all four winds, plus any pair. Together with daisangen it is one of the two "calling" yakuman.',
  },
  {
    id: 'tsuuiisou', name: 'Tsuuiisou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'All honor tiles: winds and dragons only, with no number tiles at all in any set or pair.',
  },
  {
    id: 'chinroutou', name: 'Chinroutou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'All terminal tiles, with no honors and no middle tiles.',
  },
  {
    id: 'ryuuiisou', name: 'Ryuuiisou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'The green hand: sequences and triplets built only from the green tiles, including the green dragon.',
  },
  {
    id: 'chuurenPoutou', name: 'Chuuren Poutou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: true, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Nine gates: a closed one-suit hand with three of the lowest rank, one of every middle rank, and three of the highest rank, which waits on all nine ranks of that suit.',
  },
  {
    id: 'suukantsu', name: 'Suukantsu', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: false, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'Four kans in one hand. It flips four extra dora indicators and, when fully concealed, also scores as a hand of four hidden triplets.',
  },
  {
    id: 'tenhou', name: 'Tenhou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: true, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'The dealer winning on the very first draw of the hand, before anyone has discarded a tile.',
  },
  {
    id: 'chiihou', name: 'Chiihou', hanClosed: null, hanOpen: null,
    hanLabel: 'Yakuman', closedOnly: true, openOnly: false, yakuman: true,
    requiresWin: true,
    description: 'A non-dealer winning on their very first draw, before anyone else has discarded a tile.',
  },
];

export const YAKU_BY_ID = new Map<string, YakuDef>(YAKU_DEFS.map((d) => [d.id, d]));

export const oneHanIds: YakuId[] = YAKU_DEFS
  .filter((d) => !d.yakuman && d.hanClosed === 1)
  .map((d) => d.id);
