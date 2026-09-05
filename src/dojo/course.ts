/**
 * Dojo course content.
 *
 * The syllabus follows the chapter and section structure of **Riichi Book I:
 * A Mahjong Strategy Primer for European Players** by Daina Chiba (2016),
 * chapters 3 onward. The book is CC BY-NC 3.0, free at http://riichi.dynaman.net/.
 * The structure is his; the wording, hands and drills here are written for this
 * app.
 *
 * SHAPE OF A LESSON. Not a page — a scripted sequence of turns. Every lesson is
 * a guided hand played a turn at a time, where each idea arrives at the moment
 * the hand needs it, followed by three drills on positions of your own. You
 * read one screen, make one decision, and move on.
 *
 * Tile notation is the engine's own: "123m" = 1-2-3 man, "0p" = red five pin,
 * and E S W N P F C are the honours (P/F/C = white, green, red dragon).
 *
 * EVERY POSITION IS CHECKED. The test suite rebuilds each step through the
 * engine and, for efficiency drills, verifies that the marked answer is the
 * fastest discard with the scripted ponds taken into account. When two
 * discards would be equally good, the position puts the tiles one of them
 * needs into the ponds, so that the lesson's answer is the table's answer.
 */

export interface DrillOption {
  /** A tile to discard. Mutually exclusive with `label`. */
  tile?: string;
  /** A plain action, for judgement drills ("Declare riichi", "Fold"). */
  label?: string;
  correct?: boolean;
  /** Shown after answering, for every option — the wrong ones are the lesson. */
  why: string;
}

export interface Step {
  /** 'teach' walks the hand forward; 'drill' stops and asks. */
  kind: 'teach' | 'drill';
  /** Tiles to spotlight in your hand — everything else dims. */
  focus?: string;
  /**
   * Tiles to spotlight in the ponds, for pointing at what has been discarded.
   * Prefix with a seat to look in one pond only: "2:1m 9m" is seat 2's.
   */
  focusPond?: string;
  /** Spotlight the centre block (dora, wall, round) instead of tiles. */
  focusCentre?: boolean;
  /**
   * Force the coach card to one end of the screen in portrait; otherwise it
   * docks on the side away from whatever the step is pointing at.
   */
  cardAt?: 'top' | 'bottom';
  /**
   * Face-up dora indicator for this position. Leave it out and the table
   * picks one whose dora is not in your hand, so it cannot change the answer.
   */
  dora?: string;
  /**
   * Discards already in the ponds, per seat, oldest first. Seat 0 is you,
   * 1 is to your right, 2 across, 3 to your left. A riichi seat's last
   * discard is its declaration tile. These are not decoration: the engine
   * counts them when it works out what is still live, so a drill can kill an
   * alternative answer by putting its tiles in the ponds.
   */
  rivers?: Partial<Record<0 | 1 | 2 | 3, string>>;
  /** Seats that have declared riichi. */
  riichi?: (0 | 1 | 2 | 3)[];
  /** Open sets an opponent has called, per seat ("111p" a pon, "234s" a chi). */
  melds?: Partial<Record<0 | 1 | 2 | 3, string[]>>;
  /** Tiles left in the live wall. Defaults to what the ponds imply. */
  wall?: number;
  /** The viewer's seat wind. */
  seatWind?: 'east' | 'south' | 'west' | 'north';
  /** Turn label, e.g. "Turn 4". Sets the scene for a scripted position. */
  turn?: string;
  /** The concealed hand for this step. */
  hand?: string;
  /** The tile just drawn, shown apart from the hand. */
  draw?: string;
  /** Table context: what the ponds and the other seats are telling you. */
  table?: string;
  /** Body paragraphs. */
  text?: string[];
  /** A highlighted aside. */
  note?: { title: string; text: string };
  /** Caption under the tiles, for a pure diagram step. */
  caption?: string;
  /** Extra diagram rows, each with its own caption. */
  figures?: { tiles: string; caption: string }[];

  // drill only
  prompt?: string;
  options?: DrillOption[];
  /**
   * 'efficiency' drills are checked against the engine's shanten in the test
   * suite. Judgement drills (push/fold, riichi timing, melding) are not, since
   * the right answer there is deliberately not the fastest one.
   */
  check?: 'efficiency';
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: Step[];
}

export interface Chapter {
  id: string;
  book: number;
  title: string;
  kanji: string;
  blurb: string;
  lessons: Lesson[];
}

const drills = (steps: Omit<Step, 'kind'>[]): Step[] =>
  steps.map((s) => ({ ...s, kind: 'drill' as const }));

export const CHAPTERS: Chapter[] = [
  // =========================================================================
  {
    id: 'basics',
    book: 3,
    title: 'The building blocks',
    kanji: '基本',
    blurb: 'What a hand is made of, the shapes that make it, and the waits they leave you on.',
    lessons: [
      {
        id: 'blocks',
        title: 'Blocks, partial sets and floaters',
        summary: 'Four sets and a pair — and the half-finished shapes that become them.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '3456m 789m 13p 78p 55s',
            draw: '9s',
            focus: '3456m 789m',
            text: [
              'A winning hand is four sets and a pair. A set is three tiles: a run of three consecutive tiles in one suit, or three of the same tile. Everything you do in a hand is about getting there faster, or more expensively, than three other people.',
              'You are East, it is your first draw, and it is the 9s. Before you throw anything, look at what the hand is made of. The lit tiles are your finished business: 789m is a run, and 3456m is a run with a spare on the end.',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '3456m 789m 13p 78p 55s',
            draw: '9s',
            focus: '78p 13p 55s',
            text: [
              'The rest is two-tile shapes one tile short of a set, and they are not equally good.',
              'The 78p is two-sided: 6p or 9p finishes it, eight tiles. The 13p is closed: only 2p, four tiles. The 55s is a pair, two tiles from a triplet — but a pair is also the head every hand needs, so it is doing a job as it stands.',
            ],
            note: {
              title: 'The number that matters',
              text: 'A two-sided shape accepts eight tiles. Every other two-tile shape accepts four or fewer. That single fact drives most of the discards you will ever make.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '3456m 789m 13p 78p 55s',
            draw: '9s',
            focus: '9s',
            text: [
              'So: 3456m, 789m, 13p, 78p, 55s. Five blocks, one for each set and the pair, and every one of them already has two tiles or more.',
              'And this. The 9s is a floater — attached to nothing, and a terminal, so it can only ever grow one way. It goes.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 2',
              hand: '234m 678m 22p 45p 789s',
              draw: 'N',
              seatWind: 'south',
              rivers: { 0: 'P', 1: 'C', 2: 'S', 3: 'W F' },
              prompt: 'You are the South seat in the East round, and you drew the North wind. What leaves?',
              check: 'efficiency',
              options: [
                { tile: 'N', correct: true, why: 'North is neither your seat wind nor the round wind, so a triplet of it would score nothing, and you hold one copy. It is the emptiest tile in the hand — throw it while it is still safe to throw.' },
                { tile: '2p', why: 'That is your only pair. Every hand needs a head; giving it up for nothing costs you a block.' },
                { tile: '4p', why: 'Breaking a two-sided shape while a lone honour sits in your hand is exactly backwards.' },
                { tile: '9s', why: 'That breaks a finished run. Never break a completed set while junk is in the hand.' },
              ],
            },
            {
              turn: 'Turn 3',
              hand: '345m 55m 789m 123p 78p',
              draw: '9s',
              rivers: { 0: 'N W', 1: 'C F', 2: 'P C', 3: 'S F' },
              prompt: 'Six candidate blocks want to be five. Which tile goes?',
              check: 'efficiency',
              options: [
                { tile: '9s', correct: true, why: 'Count them: 345m, 55m, 789m, 123p, 78p. Five blocks, all of them real. The 9s is a sixth candidate you have no room for.' },
                { tile: '5m', why: 'The 55m pair is your head. Breaking it leaves the hand with four blocks and no pair.' },
                { tile: '8p', why: 'Your best remaining shape, thrown to keep a lone terminal. This is the mistake the lesson is about.' },
                { tile: '1p', why: 'Breaking a finished run. There is a floater in the hand doing nothing — throw that instead.' },
              ],
            },
            {
              turn: 'Turn 4',
              hand: '234m 789m 12p 46p 55s 78s',
              rivers: { 0: 'C S 1m', 1: 'F 3p 1s', 2: 'S P 9p', 3: 'W F 3p' },
              focusPond: '3p 3p',
              table: 'Two 3p are already in the ponds — one to your right, one to your left.',
              prompt: 'Six blocks and not one of them is junk. Which is weakest?',
              check: 'efficiency',
              options: [
                { tile: '1p', correct: true, why: 'The 12p edge shape accepts only 3p, and two of the four 3p are already in the ponds — two tiles left in the whole wall. The 46p closed shape wants 5p, and all four are live. Same shape on paper; half the wait in practice.' },
                { tile: '4p', why: 'The 46p closed shape also accepts only one tile kind — but all four 5p are still out there, while the 12p edge is down to two 3p. Break the shape with fewer live tiles.' },
                { tile: '8s', why: 'Eight tiles of acceptance thrown away while two four-tile shapes sit in the hand. Always break the narrow shape first.' },
                { tile: '5s', why: 'Breaking your pair. A hand with no head is not a hand, and you have two weaker blocks to choose from.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'complex',
        title: 'Complex shapes',
        summary: 'Three- and four-tile shapes that are worth more than they look.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 5',
            hand: '234m 55m 678m 135p 12s',
            draw: '9s',
            rivers: { 0: 'N P 1m 9p', 1: 'N 4p 9m 9p', 2: 'F W 9m 4p', 3: 'C S 4p 1m' },
            focus: '135p',
            text: [
              'Some shapes are worth more than the sum of their parts, and the lit one is what players throw away by mistake. It looks like two bad closed shapes sharing a 3p.',
              'It is not: 2p or 4p finishes it, so it accepts eight tiles, as many as a two-sided shape. This is a ryankan.',
            ],
            figures: [
              { tiles: '3456p', caption: 'Also worth keeping whole: a run with a two-sided extension.' },
              { tiles: '1123m', caption: 'And this — a pair and a two-sided shape in four tiles.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 5',
            hand: '234m 55m 678m 135p 12s',
            draw: '9s',
            rivers: { 0: 'N P 1m 9p', 1: 'N 4p 9m 9p', 2: 'F W 9m 4p', 3: 'C S 4p 1m' },
            focusPond: '4p 4p 4p',
            text: [
              'The 9s goes, obviously — but look at the three ponds before the next turn, because that ryankan is about to matter.',
              'Three of the four 4p are gone. So of the eight tiles 135p theoretically accepts, only five are actually out there: four 2p and a single 4p.',
            ],
            note: {
              title: 'Count the pond, not the shape',
              text: 'A shape is worth the tiles that are still live, not the tiles it accepts on paper. This is the habit that separates a player who counts from a player who guesses.',
            },
          },
          ...drills([
            {
              turn: 'Turn 9',
              hand: '234m 55m 678m 135p 999s',
              rivers: { 0: 'F S 9p 1s 8s 7s 3s 6s', 1: 'N C 4p 1m 8p 7p 3s 6s', 2: 'P C 1m 9p 2s 4p 7s 6p', 3: 'W F 1s 9m 4p 7p 8s 5s' },
              focusPond: '4p 4p 4p',
              table: 'Three 4p are in the ponds. Discarding 1p or 5p both give tenpai.',
              prompt: 'You are one tile from tenpai and 1p or 5p both get you there. Which?',
              check: 'efficiency',
              options: [
                { tile: '5p', correct: true, why: 'Throwing 5p leaves 13p waiting on 2p, and all four 2p are live. Throwing 1p would leave 35p waiting on the 4p — of which one remains. Identical shape, four times the wait.' },
                { tile: '1p', why: 'Also tenpai, on the tile the table has already eaten. This is the trap: the shapes look the same and the wait is a quarter of the size.' },
                { tile: '3p', why: 'The 3p is the tile both closed shapes share. Remove it and they collapse together — and you are not even tenpai.' },
                { tile: '5m', why: 'Breaking your head to keep a spare. That is a step backwards from tenpai.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '1123m 456p 789p 345s',
              draw: '9s',
              rivers: { 0: 'F C 1p 1s 2p', 1: 'W F 1s P 2s', 2: 'N S 9m E 8m', 3: 'P S 1p 9m 8s' },
              prompt: 'The 1123m shape is a pair AND a two-sided shape in four tiles. Prove it.',
              check: 'efficiency',
              options: [
                { tile: '9s', correct: true, why: 'Tenpai. Read 1123m as 11m plus 23m and the hand is three sets, a pair and a two-sided shape waiting on 1m and 4m — six tiles live, since you hold two of the 1m. That is what the four-tile shape was worth all along.' },
                { tile: '1m', why: 'Also tenpai, and much worse: 123m 456p 789p 345s leaves a lone 9s tanki, three tiles. Same shanten, half the wait — this is the trap the shape is designed to avoid.' },
                { tile: '3m', why: 'Breaks the shape in the middle and leaves 112m doing nothing useful. Neither a clean pair nor a run.' },
                { tile: '9p', why: 'Breaking a completed run while an unattached tile sits in the hand.' },
              ],
            },
            {
              turn: 'Turn 7',
              hand: '345m 3456p 789p 444s',
              draw: '1m',
              rivers: { 0: 'C N 1s 1p 2s 3s', 1: 'P F 9m 9s 8s 7m', 2: 'S F 9m 1p 8m 7m', 3: 'W C 9s 1s 2p 7s' },
              prompt: 'Every pin discard and the 1m all leave you tenpai. Which one?',
              check: 'efficiency',
              options: [
                { tile: '1m', correct: true, why: 'Blocks: 345m, 3456p (a run plus an extension), 789p, 444s. The 1m connects to nothing at all. Throw it and you are tenpai on 3p, 6p and 9p — the four-tile shape reads as 456p plus a 3p tanki, as 345p plus a 6p tanki, or as 34p-56p around a 9p pair. Nine tiles.' },
                { tile: '3p', why: 'Also tenpai, but on a lone 1m: three tiles. The four-tile run-plus-extension was worth three kinds of wait, and you have just cut it to one.' },
                { tile: '6p', why: 'Same shape, other end, same problem: a 1m tanki, three tiles, instead of the nine the pin shape gives you.' },
                { tile: '4s', why: 'The triplet can serve as pair plus spare, but breaking it while a lone terminal sits in the hand takes you from tenpai back to one away.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'waits',
        title: 'Waits',
        summary: 'What you are waiting on decides how often you win.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 8',
            hand: '234m 567m 234p 55s 78p',
            rivers: { 0: 'W N 1s 1m 2s 3s 6s', 1: 'C F 1m 1p 8s 3s 8m', 2: 'P F 9m 1p 8s 7s 5p', 3: 'S P 9s 9m 8m 7s 4s' },
            focus: '78p',
            text: [
              'You are tenpai: one tile from complete. The tiles that finish the hand are your wait — here 6p or 9p — and there are five kinds of wait with wildly different sizes.',
            ],
            figures: [
              { tiles: '78s', caption: 'Ryanmen — 6s and 9s. Eight tiles.' },
              { tiles: '46s', caption: 'Kanchan — 5s only. Four tiles.' },
              { tiles: '12s', caption: 'Penchan — 3s only. Four tiles.' },
              { tiles: '55s', caption: 'Shanpon or tanki — two or three tiles.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 9',
            hand: '234m 567m 234p 55s 78p',
            draw: '5s',
            rivers: { 0: 'N C 1p 1s 8s 3s 4s 5p', 1: 'W F 1m 1p 2s 7s 6s 5p', 2: 'S P 9m 1m 8m 7s 2s 4s', 3: 'F P 9s 9m 8m 3s 8s 6s' },
            focus: '555s',
            text: [
              'Next turn you draw the third 5s and the hand changes shape. Now you hold four complete sets and a two-tile fragment, and every discard leaves you tenpai on something different.',
              'This is the moment where players talk themselves into the wrong wait, because a triplet feels like progress.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 9',
              hand: '234m 567m 234p 55s 78p',
              draw: '5s',
              rivers: { 0: 'N C 1p 1s 8s 3s 4s 5p', 1: 'W F 1m 1p 2s 7s 6s 5p', 2: 'S P 9m 1m 8m 7s 2s 4s', 3: 'F P 9s 9m 8m 3s 8s 6s' },
              prompt: 'Three discards here keep you tenpai. Which wait do you actually want?',
              check: 'efficiency',
              options: [
                { tile: '5s', correct: true, why: 'Break the triplet back to a pair and 78p waits on 6p and 9p: eight tiles, two-sided, none of them visible. The third 5s bought you one tile of shape and would have cost you most of your wait.' },
                { tile: '8p', why: 'Four sets and a lone 7p — a tanki on 7p. Three tiles, and you are holding none of the help.' },
                { tile: '7p', why: 'A tanki on 8p. Same size problem, and a middle tanki is not a wait people deal into early.' },
                { tile: '2m', why: 'Breaking a completed run to reshape a wait. Never.' },
              ],
            },
            {
              turn: 'Turn 11',
              hand: '234m 678m 123p 99p 55s',
              draw: '6s',
              rivers: { 0: 'S F 9m E 8s 3s 6p 5m 5p 9s', 1: 'C N 1m 9p 8p 7p 2s 4p 5m P', 2: 'F S 1s 1m 2s 7p 9p 5p 4p W', 3: 'P W 9s 1s 8s 3s 8p 6p 9m E' },
              focusPond: '9p 9p',
              table: 'Two 9p are visible in the ponds.',
              prompt: 'Tenpai either way. Which pair do you break?',
              check: 'efficiency',
              options: [
                { tile: '5s', correct: true, why: 'Throwing 5s leaves 56s waiting on 4s and 7s — eight tiles, and none of them visible. Keeping both pairs instead is a shanpon on 9p and 5s, and every 9p is accounted for: two in the ponds, two in your hand. That shanpon is two live tiles.' },
                { tile: '6s', why: 'Throwing the tile you drew keeps the 9p/5s shanpon. Count it: the two 9p not in your hand are both in the ponds, so only the two 5s could ever come — two tiles against eight. The tile you just drew is not automatically the tile to throw.' },
                { tile: '9p', why: 'Tenpai gone. Without the 9p pair, 55s has to be your head and 6s is a bare floater waiting to become a shape.' },
                { tile: '2m', why: 'Breaking a completed run while a tenpai is sitting there for the taking.' },
              ],
            },
            {
              turn: 'Turn 12',
              hand: '234m 567m 789p 44p 88s',
              draw: '7s',
              rivers: { 0: 'N C 1p 1s 8m 3p 3s 5s 6p 4s E', 1: 'F W 6s 1m 2p 3s 4s 9s 5p 2s 9m', 2: 'S F 1m P 9s 3p 8m 6p 5s 6s C', 3: 'W S 9m 1s 2s 6s 2p 5p 9s 1p E' },
              focusPond: '6s 6s 6s 9s 9s 9s',
              table: 'Three 6s and three 9s are already visible.',
              prompt: 'The 7s makes a two-sided 78s shape. Do you take that wait, or keep the shanpon?',
              check: 'efficiency',
              options: [
                { tile: '7s', correct: true, why: 'Throw the 7s back and stay on the 4p/8s shanpon: two 4p and two 8s left, four live tiles. The "good" 78s shape waits on 6s and 9s — and the ponds hold three of each, so it is worth two tiles. A ryanmen is only eight tiles when the tiles exist.' },
                { tile: '8s', why: 'That leaves 78s waiting on 6s and 9s, a two-sided shape on paper and a two-tile wait in fact: three of each are already in the ponds. Count before you trust the shape.' },
                { tile: '4p', why: 'Tenpai gone. 88s becomes your only pair and 7s sits next to it doing nothing.' },
                { tile: '2m', why: 'Breaking a completed run while tenpai. Never.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'five-block',
    book: 4,
    title: 'The five-block method',
    kanji: '五',
    blurb: 'One idea that answers most discard questions: build exactly five blocks, no more.',
    lessons: [
      {
        id: 'five-blocks',
        title: 'Count to five',
        summary: 'Four sets and a pair means five blocks — anything beyond that is spare.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 3',
            hand: '234m 88m 567p 12p 456s',
            draw: '9s',
            rivers: { 0: 'C N', 1: 'S P', 2: 'F E', 3: 'W P' },
            text: [
              'A finished hand is four sets and a pair: five blocks. So the whole early game is assembling five blocks and then feeding them, and every discard answers one question — do I already have five?',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 3',
            hand: '234m 88m 567p 12p 456s',
            draw: '9s',
            rivers: { 0: 'C N', 1: 'S P', 2: 'F E', 3: 'W P' },
            focus: '234m 88m 567p 12p 456s',
            text: [
              'Count them, lit up: 234m, 88m, 567p, 12p, 456s. Five. The 9s you just drew touches none of them — a sixth candidate with nowhere to go. Throw it and you are tenpai, waiting on 3p.',
            ],
            note: {
              title: 'Why not six?',
              text: 'You can only use five. A sixth block does nothing but starve the other five, because every tile you spend feeding it is a tile you did not spend on a block you will actually use.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 3',
            hand: '234m 88m 567p 12p 456s',
            draw: '9s',
            rivers: { 0: 'C N', 1: 'S P', 2: 'F E', 3: 'W P' },
            focus: '12p',
            text: [
              'The exception is when one of your five is very weak — an edge shape, or a pair of a tile three of which are already visible. Then a sixth candidate is insurance, and you hold it a turn or two while you see whether the weak one improves.',
              'Here the weak block is 12p, and it is worth watching. But a lone 9s is no insurance for anything, and throwing it makes you tenpai on turn three. Tenpai now beats a better shape later.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 4',
              hand: '456m 99m 234p 67s 789s',
              draw: 'C',
              rivers: { 0: 'E W 1m', 1: 'P N 9p', 2: 'F N 1s', 3: 'E S 1p' },
              prompt: 'Five blocks and a red dragon. What goes?',
              check: 'efficiency',
              options: [
                { tile: 'C', correct: true, why: '456m, 99m, 234p, 67s, 789s — five blocks, and throwing the dragon leaves you tenpai on 5s or 8s. A lone dragon would be a sixth block that needs two more copies; with five already in place it is the spare.' },
                { tile: '9m', why: 'Your only pair. Break it and you have four blocks and a head-shaped hole, to keep a dragon that is not yet even a pair.' },
                { tile: '7s', why: 'The 67s is a two-sided shape one tile from finishing the hand. Breaking eight tiles of acceptance for a single honour is the wrong way round.' },
                { tile: '2p', why: 'Breaking a finished run to make room for a floater.' },
              ],
            },
            {
              turn: 'Turn 5',
              hand: '567m 99m 234p 78p 456s',
              draw: '2s',
              rivers: { 0: 'P C 1s 1m', 1: 'E N 1m 1p', 2: 'S F 1p 1s', 3: 'C P 9s 1m' },
              prompt: 'Count first, then choose.',
              check: 'efficiency',
              options: [
                { tile: '2s', correct: true, why: '567m, 99m, 234p, 78p, 456s — five blocks, all healthy. The 2s is spare, and with 456s already complete it is not even extending anything useful.' },
                { tile: '9m', why: 'The pair is your head. Terminal pairs are unglamorous but they are still a block.' },
                { tile: '4s', why: 'Breaking a finished run to keep an unattached tile. Backwards in every way.' },
                { tile: '8p', why: 'Same mistake in the other suit.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '3456m 789m 22p 456p 3s',
              draw: '7s',
              rivers: { 0: 'N E 9p 1p 8p', 1: '1s P 1m 2s 2m', 2: 'S 2s 1s 1p 2m', 3: 'C 1s 1p 9p 8p' },
              focusPond: '1s 1s 1s 2s 2s',
              table: 'Three 1s and two 2s are already in the ponds.',
              prompt: 'Only four real blocks here. Which floater do you keep?',
              check: 'efficiency',
              options: [
                { tile: '3s', correct: true, why: 'Blocks: 3456m, 789m, 22p, 456p — four, plus a spare man tile. You need a fifth block, so the question is which sou floater grows best. The 7s can pair with 5s, 6s, 8s or 9s, all untouched. The 3s wants 1s, 2s, 4s or 5s — and the ponds already hold three 1s and two 2s.' },
                { tile: '7s', why: 'The mirror answer, and the ponds are what separate them: the 3s side of the suit is half eaten already, so keep the floater whose neighbours are still live.' },
                { tile: '2p', why: 'Your only pair, and you are already short of blocks. This is the one clearly bad answer.' },
                { tile: '4p', why: 'Breaking a completed run while two floaters are in the hand.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'weakest-block',
        title: 'Dropping the weakest block',
        summary: 'When you do have to break something, there is an order.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 6',
            hand: '345m 89m 345p FF 34s 7s',
            draw: '8s',
            rivers: { 0: 'P C 1s 1m 2p', 1: 'N C 9p 1p 8p', 2: 'S P 1p 1m 2m', 3: 'W S 9p 1s 2m' },
            focus: '89m 78s',
            text: [
              'Sooner or later you draw a better block than one you hold and something has to go. You have just drawn the 8s, which turns a lone 7s into a two-sided 78s — a sixth block, and a better one than some you already have. The order is almost always the same, worst first.',
            ],
            figures: [
              { tiles: '89m', caption: 'Penchan. Four tiles, and the 7m it needs is the one people hold.' },
              { tiles: '13p', caption: 'Terminal-side kanchan. Four tiles, slightly better than a penchan.' },
              { tiles: '46s', caption: 'Middle kanchan. Four tiles, and they flow freely.' },
              { tiles: '34p', caption: 'Ryanmen. Eight tiles. You almost never break one of these.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 6',
            hand: '345m 89m 345p FF 34s 7s',
            draw: '8s',
            rivers: { 0: 'P C 1s 1m 2p', 1: 'N C 9p 1p 8p', 2: 'S P 1p 1m 2m', 3: 'W S 9p 1s 2m' },
            focus: 'FF',
            text: [
              'But shape is not the only currency. That green dragon pair is a worse shape than any of your runs — two tiles left — and a better block, because the third copy is a guaranteed yaku and a han, and opponents will stop discarding it late.',
            ],
            note: {
              title: 'Shape versus value',
              text: 'Break the weaker shape when the hand is cheap and fast. Keep the more valuable block when the hand is slow anyway — a slow hand has to be worth something when it lands.',
            },
          },
          ...drills([
            {
              turn: 'Turn 6',
              hand: '345m 89m 345p FF 34s 7s',
              draw: '8s',
              rivers: { 0: 'P C 1s 1m 2p', 1: 'N C 9p 1p 8p', 2: 'S P 1p 1m 2m', 3: 'W S 9p 1s 2m' },
              prompt: 'Six blocks: two weak shapes, one dragon pair, and the 78s you just made. Which goes?',
              check: 'efficiency',
              options: [
                { tile: '9m', correct: true, why: 'The 89m edge shape accepts only 7m, four tiles, and it is the worst shape in the hand. The dragon pair is a worse shape still — two tiles — but it is the block that gives the hand a yaku. Shape says break the dragons; value says break the edge. Value wins.' },
                { tile: 'F', why: 'The mistake this lesson exists for. Two tiles from a guaranteed yaku, and the copy you need is the one nobody discards after turn ten. Here it does not even buy speed: the dragons are your only pair, so throwing one leaves the hand headless and a step further from tenpai.' },
                { tile: '8s', why: 'Throwing back the tile that just made your best new shape. The 78s is two-sided; the 89m it would be keeping is not.' },
                { tile: '3s', why: 'Breaking a two-sided shape while an edge shape sits in the hand. Wrong end of the order.' },
              ],
            },
            {
              turn: 'Turn 7',
              hand: '234m 88m 12p 46p 567s 78s',
              rivers: { 0: 'W F 1s 9m 8p 3s', 1: 'C N 3p 1m 2s 7p', 2: 'F S 1m 9p 8p 7m', 3: 'S P 1s E 3p 3s' },
              focusPond: '3p 3p',
              table: 'Two 3p are already in the ponds.',
              prompt: 'No honours here, so it is pure shape. Which block loses?',
              check: 'efficiency',
              options: [
                { tile: '1p', correct: true, why: 'Blocks: 234m, 88m, 12p, 46p, 567s, 78s — six, so one goes. The 12p edge accepts only 3p, and two of those are already gone: two live tiles. The 46p closed shape wants 5p, all four still out. Break the edge.' },
                { tile: '4p', why: 'The 46p closed shape is the other weak block, but all four 5p are live. The 12p edge is down to two 3p — break the shape with fewer tiles left, not the one that merely looks worse.' },
                { tile: '8s', why: 'Breaking eight tiles of acceptance to keep four. This is the shape order upside down.' },
                { tile: '8m', why: 'Breaking your only pair to keep two four-tile shapes. A hand with no head is not a hand.' },
              ],
            },
            {
              turn: 'Turn 9',
              hand: '234m 55m 678p 12s 456s',
              draw: 'P',
              rivers: { 0: 'C N 1p 9s 8s 7m 3p 5p', 1: 'F W 1m 1p 8m 3p 7m 4p', 2: 'S F 9m E 2p 7s 8m 4p', 3: 'C S 9p 9m 2p 7s 6m 5p' },
              table: 'Nobody has discarded a white dragon yet.',
              prompt: 'You drew a lone white dragon on turn nine with five blocks already. Now what?',
              options: [
                { label: 'Discard the white dragon', correct: true, why: 'You already have five blocks and a head — throw the dragon and you are tenpai on 3s — and a lone dragon needs two more copies. On turn nine that is a long shot, and honours get harder to discard the longer you hold them. Let it go now while it is still safe.' },
                { label: 'Keep it and discard 1s', why: 'Trading a real block for a lottery ticket. It would be right on turn one — a lone yakuhai costs almost nothing early — but not with five blocks already assembled and the hand half over.' },
                { label: 'Keep it and discard 5m', why: 'Breaking your head for a single honour is the worst of both: no pair, no yaku, and a dead tile in hand.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'floaters',
        title: 'Choosing which floater to keep',
        summary: 'When you are short of blocks, keep the tiles that can become one.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 2',
            hand: '456m 789m 22p 4567s 1m',
            draw: '5p',
            rivers: { 0: 'C', 1: 'E', 2: 'F', 3: 'S' },
            focus: '5p 1m',
            text: [
              'The other half of the five-block method is the case where you have four blocks and need a fifth. Now floaters matter, and they are not equal.',
            ],
            figures: [
              { tiles: '5p', caption: 'A middle tile grows from either side: 3p, 4p, 6p, 7p. Sixteen useful tiles.' },
              { tiles: '2p', caption: 'A 2 or an 8 grows from one side only.' },
              { tiles: '1m', caption: 'A terminal can only make an edge shape or a triplet. Six useful tiles, all poor.' },
              { tiles: 'N', caption: 'An honour can only pair — but if it is a yakuhai, it carries value no number tile does.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 2',
            hand: '456m 789m 22p 4567s 1m',
            draw: '5p',
            rivers: { 0: 'C', 1: 'E', 2: 'F', 3: 'S' },
            focus: '1m',
            text: [
              'That ordering is the whole reason the standard early discard is honours you cannot use, then terminals, then 2s and 8s. You are shedding tiles in order of how likely they are to become the block you are missing.',
            ],
            note: {
              title: 'Keep a yakuhai anyway',
              text: 'A lone dragon is a poor shape and a fine hold in the first few turns. One copy costs you almost nothing; the second copy changes what the hand is worth.',
            },
          },
          ...drills([
            {
              turn: 'Turn 2',
              hand: '456m 789m 22p 4567s 1m',
              draw: '5p',
              rivers: { 0: 'C', 1: 'E', 2: 'F', 3: 'S' },
              prompt: 'Four blocks and two floaters. Which floater goes?',
              check: 'efficiency',
              options: [
                { tile: '1m', correct: true, why: 'An isolated terminal: only 2m and 3m help it, and only into an edge or a closed shape. The 5p reaches 3p, 4p, 6p and 7p — sixteen useful tiles against six poor ones.' },
                { tile: '5p', why: 'Throwing your best floater and keeping your worst. This is the mistake.' },
                { tile: '2p', why: 'Your only pair, thrown while two floaters sit in the hand.' },
                { tile: '9m', why: 'Breaking a finished run while a tile with no job at all sits in the hand.' },
              ],
            },
            {
              turn: 'Turn 3',
              hand: '2345m 567m 88s 123p 9p',
              draw: '4s',
              rivers: { 0: 'F P', 1: 'E N', 2: 'C W', 3: 'S E' },
              prompt: 'Same question, different floaters.',
              check: 'efficiency',
              options: [
                { tile: '9p', correct: true, why: 'It sits next to a run you have already completed, so it can only ever pair or make 789p from scratch. The 4s is next to your 88s pair and grows both ways.' },
                { tile: '4s', why: 'The better floater by some distance — it can make 456s, 345s, or back up the 88s pair.' },
                { tile: '8s', why: 'Breaking the pair while two spare tiles are in the hand.' },
                { tile: '3p', why: 'Breaking a completed run to solve a problem that a spare tile already solves.' },
              ],
            },
            {
              turn: 'Turn 2',
              hand: '345m 678m 22p 456s 9s N',
              draw: 'P',
              seatWind: 'south',
              rivers: { 0: 'C', 1: 'N', 2: 'F', 3: 'W' },
              focusPond: 'N',
              table: 'You are the South seat, so North is a guest wind: it scores nothing. One North is already out.',
              prompt: 'Turn two, four blocks, two lone honours and a lone terminal. What do you throw?',
              check: 'efficiency',
              options: [
                { tile: 'N', correct: true, why: 'Three floaters, and the North is the worst of them: it can only ever pair, a pair of it is worth nothing to you, and one copy is already in a pond. The dragon can also only pair, but that pair is a yaku. Between the two honours, throw the one that pays nothing.' },
                { tile: 'P', why: 'The safe habit, and a small leak. Early, a lone dragon is cheap to hold and the upside is a han and the freedom to call. Throw the guest wind first; the dragon can go next turn if nothing has changed.' },
                { tile: '9s', why: 'A poor floater, but a floater with more ways to grow than either honour: 7s, 8s, or a pair. Shed the tile that can only pair before the tile that can still make a run.' },
                { tile: '2p', why: 'Your only pair, on turn two, for no reason at all.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'yaku',
    book: 5,
    title: 'Pursuing yaku',
    kanji: '役',
    blurb: 'When a yaku is worth going out of your way for, and when it is a trap.',
    lessons: [
      {
        id: 'cheap-yaku',
        title: 'The yaku you take for free',
        summary: 'Pinfu, tanyao and yakuhai come to you. Chase the rest only when the hand offers.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 7',
            hand: '234m 234p 22s 34s 567s',
            draw: '9s',
            rivers: { 0: 'P N 1m 1s 8p 7p', 1: 'C W 9p 1p 8m 7m', 2: 'F P 9m 9p 8p 7p', 3: 'S C 1p 1m 8m 7m' },
            text: [
              'There are yaku you steer towards and yaku you notice you already have. The second kind is where your points come from.',
              'Riichi needs only a closed tenpai hand. Pinfu is what an efficient closed hand looks like anyway: all runs, a plain pair, a two-sided wait. Tanyao is what happens when you shed terminals, which you were doing regardless. Yakuhai is one block.',
            ],
            note: {
              title: 'The rule of thumb',
              text: 'If a yaku costs you nothing, take it. If it costs you a turn, think. If it costs you a block, it had better be worth several han.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 7',
            hand: '234m 234p 22s 34s 567s',
            draw: '9s',
            rivers: { 0: 'P N 1m 1s 8p 7p', 1: 'C W 9p 1p 8m 7m', 2: 'F P 9m 9p 8p 7p', 3: 'S C 1p 1m 8m 7m' },
            focus: '234m 234p 34s',
            text: [
              'Now look at this hand properly. You hold 234m and 234p, and your 34s is one tile from 234s — the same run in all three suits, which is sanshoku, worth two han closed.',
              'The important part: you were keeping 34s anyway. It is a two-sided shape, and the hand is tenpai on 2s, 5s and 8s the moment the 9s goes. The yaku costs you nothing, so you take it.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 7',
              hand: '234m 234p 22s 34s 567s',
              draw: '9s',
              rivers: { 0: 'P N 1m 1s 8p 7p', 1: 'C W 9p 1p 8m 7m', 2: 'F P 9m 9p 8p 7p', 3: 'S C 1p 1m 8m 7m' },
              prompt: 'Sanshoku is one tile away and it is free. Confirm it.',
              check: 'efficiency',
              options: [
                { tile: '9s', correct: true, why: 'The 9s is your only spare tile. Throw it and you are tenpai on 2s, 5s and 8s — nine tiles — with sanshoku waiting on the 2s. Keeping 34s kept both your acceptance and the yaku; that is what "free" means.' },
                { tile: '3s', why: 'Also tenpai, but read what is left: 456s and a 79s closed shape, waiting on 8s only. Four tiles instead of nine, and the sanshoku is gone with the 3s.' },
                { tile: '2s', why: 'Breaking your pair to keep a terminal. The 2s is also the sanshoku tile. This gives up the head and the yaku at once.' },
                { tile: '2m', why: 'Breaking a run that is part of the sanshoku, and breaking tenpai with it.' },
              ],
            },
            {
              turn: 'Turn 8',
              hand: '123m 456m 456p 22s 78s',
              draw: '8m',
              rivers: { 0: 'N S 1s 1p 2p 7p 3p', 1: 'W P 9p E 8p 3p 7p', 2: 'C N 1p 9p 8p 3s 4s', 3: 'P F 1s S 2p 3s 5s' },
              table: 'Closed. Discarding 8m gives tenpai on 6s and 9s.',
              prompt: 'Ittsu is two tiles away: you would need 789m. Worth it?',
              check: 'efficiency',
              options: [
                { tile: '8m', correct: true, why: 'Throw it and take the tenpai: 6s or 9s, eight tiles, with riichi and pinfu already yours. The straight would need 7m and 9m to arrive in the right order and cost you the tenpai you already hold. Two turns of speed for two han is a bad trade on turn eight.' },
                { tile: '8s', why: 'Breaking a two-sided shape and giving up tenpai to chase a yaku that needs two more specific tiles. This is exactly the trap.' },
                { tile: '7s', why: 'Same trade, same problem. A tenpai in hand is worth more than a yaku that needs two exact tiles.' },
                { tile: '2s', why: 'Breaking your head for a yaku detour.' },
              ],
            },
            {
              turn: 'Turn 5',
              hand: '234m 567m 345p 33s 56s',
              draw: '9m',
              rivers: { 0: 'S C 9p 9s', 1: 'W N 1p 1m', 2: 'P N 1s 1p', 3: 'F W 1m E' },
              table: 'Your hand is closed and every tile is a simple.',
              prompt: 'Discarding the 9m gives tenpai. Keeping it would break tanyao. What do you do?',
              options: [
                { label: 'Discard the 9m', correct: true, why: 'The hand is already all simples: tanyao is sitting there for free, and keeping 9m would break it while adding nothing. Throw it and you are tenpai on 4s and 7s with riichi, pinfu and tanyao all live. You are not choosing a yaku, you are declining to throw one away.' },
                { label: 'Keep 9m for a possible 789m', why: 'You would be giving up a tenpai and your tanyao to build a sixth block you have no room for.' },
                { label: 'Discard 3s and keep 9m', why: 'Breaking your head, your yaku and your tenpai in one move, to keep a terminal you drew by accident.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'big-hands',
        title: 'Honitsu, toitoi and chiitoitsu',
        summary: 'The three hands worth reshaping for — and the tell they give off.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 4',
            hand: '1234p 55p 789p PP FF',
            draw: '5m',
            rivers: { 0: 'S W 9s', 1: 'N C 1s', 2: 'E C 9s', 3: 'W S 1m' },
            focus: '1234p 55p 789p',
            text: [
              'Some hands are worth committing to, and all three of these change how you discard for the rest of the hand. Decide early, and read the signs when an opponent does the same.',
              'Honitsu is one suit plus honours: two han open, three closed, and usually more because the honour triplets stack yakuhai on top. Commit when you hold seven or eight tiles of one suit by the middle of the hand, especially with a yakuhai pair.',
            ],
            note: {
              title: 'Honitsu is the loudest hand in mahjong',
              text: 'A player discarding nothing but one suit is telling the whole table what they hold. Read it in others, and expect to be read when you do it.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 4',
            hand: '1234p 55p 789p PP FF',
            draw: '5m',
            rivers: { 0: 'S W 9s', 1: 'N C 1s', 2: 'E C 9s', 3: 'W S 1m' },
            focus: 'PP FF',
            text: [
              'Toitoi is all triplets: two han, and it pairs naturally with yakuhai. Commit when you already hold three pairs by turn six. The catch is that pairs complete on two tiles instead of eight, so the hand is slow and needs the value to justify it.',
              'Chiitoitsu is seven distinct pairs, closed only, two han. Take it when you hold five pairs early — not as a consolation prize at turn twelve, when the single-tile wait at the end will not save you.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 4',
              hand: '1234p 55p 789p PP FF',
              draw: '5m',
              rivers: { 0: 'S W 9s', 1: 'N C 1s', 2: 'E C 9s', 3: 'W S 1m' },
              prompt: 'Nine pin tiles and two dragon pairs. Commit or stay flexible?',
              check: 'efficiency',
              options: [
                { tile: '5m', correct: true, why: 'Commit. Nine tiles of one suit plus two dragon pairs on turn four is a honitsu with yakuhai on top — potentially a haneman. The lone 5m is the only tile in the hand that cannot be part of it, and throwing it is also the fastest discard.' },
                { tile: '1p', why: 'The 1234p shape is a run with a two-sided extension, and the backbone of the flush. Breaking it while an off-suit floater sits in the hand is the wrong order.' },
                { tile: 'P', why: 'Breaking a dragon pair in a honitsu hand throws away the yaku that makes the hand expensive.' },
                { tile: '9p', why: 'Breaking a finished run of the suit you are collecting.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '11m 8m 44m 77p 99p 33s 5s',
              draw: '8s',
              rivers: { 0: 'C N 9s 9m 2m', 1: 'F 8m 9m 1p 2s', 2: 'S P 1p 9s 2m', 3: 'F W 1s 8m 8p' },
              focusPond: '8m 8m',
              table: 'Two 8m are already in the ponds.',
              prompt: 'Five pairs on turn six. What is this hand, and what goes?',
              options: [
                { label: 'Chiitoitsu — throw the 8m', correct: true, why: 'Five pairs by turn six is exactly when seven pairs is right. Every pair you hold is already progress and the three singles are not, so shed them one at a time, worst first: two 8m are already gone, so it is the least likely to pair. The 5s and 8s still have three copies each.' },
                { label: 'Ignore it and build runs — throw the 1m', why: 'Five pairs is a terrible standard hand: you would be breaking four of your five blocks to build runs from nothing.' },
                { label: 'Go for toitoi — throw the 5s', why: 'Not unreasonable with this many pairs, but toitoi needs four of them to become triplets — two tiles each, and you cannot call for chiitoitsu. Seven pairs is the faster read of the same tiles, and the 8m is the worse single anyway.' },
              ],
            },
            {
              turn: 'Turn 7',
              hand: '234m 567m 88p 34s 33s 6s',
              draw: '9m',
              rivers: { 0: 'N F 1m 9s 2p 7p', 1: 'C P 9p 9s 8s 7s', 2: '1m 9m 2m 8m 3m 7m', 3: 'S C 1s 9p 8m 3p' },
              melds: { 2: ['111p', '666p'] },
              focusPond: '2:1m 9m 2m 8m 3m 7m',
              table: 'The seat across from you has called two pon of pin, and their river is nothing but man tiles.',
              prompt: 'What is the seat across from you doing, and what does that mean for your 9m?',
              options: [
                { label: 'They are on a pin honitsu — the 9m is safe against them', correct: true, why: 'Two pon of pin and a river of nothing but man is the loudest tell in the game. Their hand is pin plus honours, so man tiles are safe against them and any pin tile is not. Throwing the 9m costs you nothing today, and it will cost you nothing later either — remember that when you next need a safe tile.' },
                { label: 'They are collecting man tiles — the 9m is dangerous', why: 'Backwards: tiles a player discards are the tiles they cannot win on. A river full of man means man is safe against them.' },
                { label: 'Nothing readable yet — no need to think about safety', why: 'Two calls and a one-suit river by turn seven is not ambiguous. Their hand is fast and expensive, and you should already be noting which of your tiles are safe against it.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'riichi',
    book: 7,
    title: 'Riichi judgement',
    kanji: '立直',
    blurb: 'The single most profitable decision in the game, and the handful of times to skip it.',
    lessons: [
      {
        id: 'insta-riichi',
        title: 'Riichi is the default',
        summary: 'Closed and tenpai? Declare. The exceptions are narrow and you should know them by name.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 6',
            hand: '234m 567m 44p 234s 78s',
            draw: '1m',
            rivers: { 0: 'N S 1p 9p 8m', 1: 'C E 9p 1p 8p', 2: 'P W 1s 9m 2p', 3: 'F W 9m 1s 8p' },
            focus: '78s',
            text: [
              'You have just drawn into tenpai. Throw the 1m and you are waiting on 6s and 9s with a closed hand on turn six.',
              'Declare. Riichi is worth far more than the one han printed on the card: the han itself, plus the ippatsu you will sometimes catch, plus the ura dora only riichi hands see, plus three opponents who stop pushing tiles at you.',
            ],
            note: {
              title: 'The honest arithmetic',
              text: 'Riichi turns an average closed tenpai hand from roughly a thousand points into roughly five. That is not an edge you can take or leave — it is most of your income.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 6',
            hand: '234m 567m 44p 234s 78s',
            draw: '1m',
            rivers: { 0: 'N S 1p 9p 8m', 1: 'C E 9p 1p 8p', 2: 'P W 1s 9m 2p', 3: 'F W 9m 1s 8p' },
            focus: '1m',
            text: [
              'Declare immediately, too. Riichi on the turn you reach tenpai, not two turns later after you have "improved" it. Every turn you wait is a turn of ippatsu and a draw thrown away, and the improvement usually does not come.',
              'The common beginner mistake is holding dama because the wait feels bad. A bad wait with riichi is usually still better than a bad wait without it: the value goes up and the opponents fold, which means your bad wait now faces three players throwing safe tiles instead of three players building hands.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 6',
              hand: '234m 567m 44p 234s 78s',
              draw: '1m',
              rivers: { 0: 'N S 1p 9p 8m', 1: 'C E 9p 1p 8p', 2: 'P W 1s 9m 2p', 3: 'F W 9m 1s 8p' },
              table: 'Closed. Nobody has declared.',
              prompt: 'Discarding 1m gives tenpai on 6s/9s. Riichi or dama?',
              options: [
                { label: 'Riichi, discarding 1m', correct: true, why: 'A two-sided wait, turn six, nobody committed. This is the textbook insta-riichi — there is no reason on the exceptions list that applies here.' },
                { label: 'Dama, discarding 1m', why: 'You keep the ability to fold and you give up roughly four times the value. Dama needs a reason; "I might deal in" is not one.' },
                { label: 'Discard 4p to reshape the hand', why: 'Breaking your head while tenpai, hoping for a better hand that will not arrive. This is the improvement trap.' },
              ],
            },
            {
              turn: 'Turn 3',
              hand: '345m 678m 234p 99s 46s',
              draw: '9p',
              rivers: { 0: 'P S', 1: 'W C', 2: 'C F', 3: 'F W' },
              table: 'Closed. Turn three. Nobody has discarded a 5s.',
              prompt: 'Tenpai on turn three, but the wait is a closed 5s. Riichi?',
              options: [
                { label: 'Riichi, discarding 9p', correct: true, why: 'Yes. A closed wait feels bad and the arithmetic disagrees: on turn three you have fifteen draws left, all four 5s are live, and riichi roughly quadruples what the hand pays. Early riichi on a poor wait still beats late dama on a good one.' },
                { label: 'Dama and wait for a better shape', why: 'The wait might improve — a 3s or 7s draw would make it two-sided — and meanwhile you have surrendered ippatsu, ura, and the pressure that makes three opponents stop attacking. Improvement is a maybe; the value is certain.' },
                { label: 'Discard 6s and wait on the 9s/4s shapes instead', why: 'That is not tenpai at all: 4s alone next to a 99s pair is a floater, not a wait. You would be throwing away a tenpai on turn three to hold a one-away hand.' },
              ],
            },
            {
              turn: 'Turn 4',
              hand: '234m 567m 234p 55s 78s',
              draw: 'N',
              rivers: { 0: 'S 6s 1m', 1: 'F S 1s', 2: 'C P 9m', 3: 'W C 1p' },
              focus: '78s',
              focusPond: '0:6s',
              table: 'Look at your own pond: you threw a 6s on turn two.',
              prompt: 'Throwing the North gives tenpai on 6s and 9s. But you discarded a 6s earlier. Now what?',
              options: [
                { label: 'Dama — you are furiten', correct: true, why: 'You discarded a 6s, which is part of your own wait, so you cannot ron either tile: only tsumo. Riichi would lock you into that for the rest of the hand with no way to fold. This is one of the four real exceptions — and on turn four, with the hand closed, there is time to draw out of it.' },
                { label: 'Riichi anyway — tsumo still pays', why: 'It does, and you have thrown away the ability to drop out plus most of the ways to win. Furiten riichi is a specialist play, not a default.' },
                { label: 'Discard 5s and wait on 7s tanki instead', why: 'That is not what the hand does: throwing a 5s leaves 5s 78s together, one tile from tenpai, not tenpai. Dama with the furiten tenpai keeps more, and a 5s or 8s draw fixes the wait.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'no-riichi',
        title: 'When not to riichi',
        summary: 'Four situations, and nothing else.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 9',
            hand: '234m 22m 345p 678p 45s',
            dora: '1m',
            rivers: { 0: 'W N 9m 1s 8s 7s 2p 6m', 1: 'C P 9s 9m 2s 7m 8m 5m', 2: 'S N 9p 1p 8m 7s 2p 5m', 3: 'F S 1s 1p 8s 7m 6m 2s' },
            focusCentre: true,
            table: 'The dora indicator is 1m, so every 2m is dora. Closed, tenpai on 3s and 6s.',
            text: [
              'The exceptions are real but narrow. Learn them as a list and treat anything not on the list as a riichi.',
              'One: the hand is already big enough that the han would not change the payout. Two: you are furiten. Three: there are no draws left. Four: you are leading in the last hand and want it to end quietly.',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 9',
            hand: '234m 22m 345p 678p 45s',
            dora: '1m',
            rivers: { 0: 'W N 9m 1s 8s 7s 2p 6m', 1: 'C P 9s 9m 2s 7m 8m 5m', 2: 'S N 9p 1p 8m 7s 2p 5m', 3: 'F S 1s 1p 8s 7m 6m 2s' },
            focus: '222m',
            text: [
              'This hand has three dora and a two-sided wait, and it is still a riichi. Dama it is pinfu and three dora, four han; riichi makes it a mangan outright and puts ippatsu and ura on the table for a haneman. The first exception is for hands already at the ceiling — a dama haneman on a bad wait — where the extra han buys nothing.',
              'Notice what is not on the list: "the wait is bad", "somebody riichi\'d first", "I might deal in". Those feel like reasons and are usually not.',
            ],
            note: {
              title: 'A test for the exceptions',
              text: 'If your reason for dama is about the hand — its size, its furiten, the wall running out — it is probably real. If it is about your nerves, it is not.',
            },
          },
          ...drills([
            {
              turn: 'Turn 17',
              hand: '345m 678m 234p 99p 55s',
              draw: '2m',
              rivers: { 0: 'P W 9m 1s 8s 7p 7s 6p 6s 5p 2s 1m 9s F E C', 1: 'N P 1s 1p 8p 7s 3s 4s 6p 5p 6s 8s 1m 9s C W', 2: 'S N 1m 9m 2s 3s 8s 5p 4s 6p 7p 8p E W 1p F', 3: 'C S 9s 1p 8p 7p 7s 4s 6s 3s 2s 9m 1s F P E' },
              focusCentre: true,
              table: 'Closed, tenpai on the 9p / 5s shanpon. Check the wall count.',
              prompt: 'Five tiles left in the wall — one more draw each. Do you declare?',
              options: [
                { label: 'Dama', correct: true, why: 'Riichi buys you a single draw and forfeits your ability to drop the hand, and there is barely time for ippatsu or ura to matter. With the wall this short, tenpai for the noten payment is the prize — do not risk it, and do not pay a thousand points for a stick you will not get back.' },
                { label: 'Riichi', why: 'A han and an ura chance on one draw, in exchange for a thousand-point stick and being unable to fold on the last go-around. The maths does not survive the wall being this short.' },
                { label: 'Break tenpai and play safe', why: 'Worse than either: you give up the noten payment and gain nothing. Take the tenpai.' },
              ],
            },
            {
              turn: 'Turn 7',
              hand: '345m 678m 44p 234s 78s',
              draw: '1m',
              dora: '3p',
              rivers: { 0: 'S F 9p 1p 8p 7p', 1: 'N C 1s 9m 2p 7p', 2: 'C S 9m 1s 2m 8p', 3: 'P W 1p 9p 2p 6p' },
              focus: '44p',
              focusCentre: true,
              table: 'The indicator is 3p, so your 4p pair is two dora. Closed, tenpai on 6s/9s.',
              prompt: 'Two dora, closed, a good wait. Riichi or dama?',
              options: [
                { label: 'Riichi', correct: true, why: 'Dama-because-it-is-big applies to hands already at the ceiling on a narrow wait. This is two dora on an eight-tile wait: dama it is pinfu and two dora, 3900. Riichi makes it 7700 before ippatsu or ura, and either of those makes it a mangan. Declare.' },
                { label: 'Dama to keep it quiet', why: 'The instinct is right in principle — big hands can afford silence — but it applies when riichi adds little and the wait is thin. Here it adds a lot and the wait is wide.' },
                { label: 'Dama and fish for a better wait', why: 'You already have the best wait shape in the game. There is nothing to fish for.' },
              ],
            },
            {
              turn: 'Turn 10',
              hand: '345m 678m 22p 456p 78s',
              draw: '3m',
              riichi: [3],
              rivers: { 0: 'P F 1p 1s 8p 7p 3p 4s 9p', 1: 'W P 1m 9m 2s 3s 7p 4s 1p', 2: 'N C 9p 1m 2m 3s 5s 8p E', 3: 'S P 1s 9m 2s 3p 2m 5s E' },
              table: 'The seat to your left is in riichi. Your hand is cheap: no dora, no yaku but riichi.',
              prompt: 'You reach tenpai into a live riichi with a cheap hand. Declare?',
              options: [
                { label: 'Riichi', correct: true, why: 'Uncomfortable and still right. Your wait is two-sided, you are tenpai, and riichi is the only thing making this hand worth anything at all. Folding a closed tenpai hand because somebody else got there first is how you finish an evening with nothing.' },
                { label: 'Dama and push quietly', why: 'You take on all the risk of pushing and none of the reward. If you have decided to push, push with the value on.' },
                { label: 'Fold', why: 'Defensible only if the tile you must discard is genuinely dangerous and your hand is genuinely worthless. Tenpai with a good wait is usually a push — see the defence chapter for the comparison.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'defense',
    book: 8,
    title: 'Defence',
    kanji: '守備',
    blurb: 'How to work out whether to fight, and what to throw when you decide not to.',
    lessons: [
      {
        id: 'push-fold',
        title: 'Push or fold',
        summary: 'The comparison is your hand against their hand, not your nerves against the table.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 8',
            hand: '345m 78m 234p 46s 1p 9s W',
            draw: 'N',
            riichi: [2],
            rivers: { 0: 'P S 1m 9p 8p 7s 7p', 1: 'F C 9p 1s 8s 3s 7s', 2: 'C F 1p E 2s 7p 8s', 3: 'C F 1s 1m 2m 3s 2s' },
            text: [
              'Somebody has declared. You have a hand. The question is not whether you are scared — it is whether what you stand to win beats what you stand to lose, and both sides of that are estimable.',
              'How close are you? How much is the hand worth? How dangerous is the tile you would have to throw? And how late is it?',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 8',
            hand: '345m 78m 234p 46s 1p 9s W',
            draw: 'N',
            riichi: [2],
            rivers: { 0: 'P S 1m 9p 8p 7s 7p', 1: 'F C 9p 1s 8s 3s 7s', 2: 'C F 1p E 2s 7p 8s', 3: 'C F 1s 1m 2m 3s 2s' },
            focus: '78m 46s 1p 9s W N',
            text: [
              'This hand is two away from tenpai — two finished sets, two partial shapes, no pair, and four tiles doing nothing — with no yaku and no dora. That is the easy case: it is not worth a single dangerous tile. Fold.',
            ],
            note: {
              title: 'The short version',
              text: 'Tenpai with value: push. Tenpai and cheap: push safe tiles, fold to dangerous ones. One away and cheap: fold. Two away: fold, and do it early enough that you still have safe tiles left.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 8',
            hand: '345m 78m 234p 46s 1p 9s W',
            draw: 'N',
            riichi: [2],
            rivers: { 0: 'P S 1m 9p 8p 7s 7p', 1: 'F C 9p 1s 8s 3s 7s', 2: 'C F 1p E 2s 7p 8s', 3: 'C F 1s 1m 2m 3s 2s' },
            focusPond: '2:1p',
            focus: '1p',
            text: [
              'That last clause is the part people get wrong. Folding is a plan that needs materials. Wait until turn fourteen to decide and you will be holding nothing but dangerous tiles, and you will deal in anyway.',
              'Decide by turn eight or nine and keep one or two safe tiles in reserve. Here the 1p is already in their pond — that is your first safe discard, and the winds behind it are your next two.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 8',
              hand: '345m 78m 234p 46s 1p 9s W',
              draw: 'N',
              riichi: [2],
              rivers: { 0: 'P S 1m 9p 8p 7s 7p', 1: 'F C 9p 1s 8s 3s 7s', 2: 'C F 1p E 2s 7p 8s', 3: 'C F 1s 1m 2m 3s 2s' },
              table: 'Riichi from across. Two from tenpai, no dora, no yaku.',
              prompt: 'Two away, cheap, into a live riichi. What is the plan?',
              options: [
                { label: 'Fold, starting now', correct: true, why: 'Two shanten with nothing to show for it is not worth one dangerous tile, let alone the four or five you would need. Start folding while you still have safe tiles to fold with — the 1p first, since it is in their pond.' },
                { label: 'Push — you might still get there', why: 'You need three more useful draws and each intervening discard is a coin flip against a mangan. The arithmetic is not close.' },
                { label: 'Push one turn and see', why: 'The most common way to deal in: the tile you throw "just this once" is the one that costs eight thousand, and by the time you commit to folding you have no safe tiles left.' },
              ],
            },
            {
              turn: 'Turn 9',
              hand: '234m 567m 234p 55s 78s',
              draw: '1m',
              riichi: [1],
              dora: '4s',
              rivers: { 0: 'S W 1p 1s 8p 7p 8m 6p', 1: 'C F 9m 1m 2s 3s 5p E', 2: 'N S 9m 9p 8m 3s 6p 5p', 3: 'P C 9p 1p 8p 7p 1s 2s' },
              focus: '1m 55s',
              focusPond: '1:1m',
              table: 'Riichi from your right. The indicator is 4s, so your 5s pair is two dora — and look at their pond.',
              prompt: 'Tenpai, two dora, and the tile you want to throw is already in their discards. Now?',
              options: [
                { label: 'Push — declare riichi', correct: true, why: 'The 1m is genbutsu against the riichi, so pushing costs you nothing at all this turn, and you are tenpai on 6s/9s with two dora. This is the easiest push in mahjong: free danger and a hand worth having.' },
                { label: 'Fold and hold the tenpai', why: 'You cannot both fold and keep tenpai — folding means dismantling. Throwing away a valuable tenpai hand when the discard is provably safe is pure loss.' },
                { label: 'Dama and push quietly', why: 'Pushing without the value on. If the tile is safe and the hand is good, take the riichi too.' },
              ],
            },
            {
              turn: 'Turn 16',
              hand: '345m 678m 234p 99p 45s',
              draw: '6p',
              riichi: [3],
              rivers: { 0: 'W N 9m 9s 8p 7p 7s 5p 2m 1p 2s 8s 1m 1s', 1: 'C P 1s 9s 2m 7s 7p 5p 2s 8s 9m 8p 1m 1p', 2: 'F P 1m 1s 2s 7p 7s 5p 8s 8p 2m 9m 9s E', 3: 'W S 1p 9m 8p 8s 2p 5p 7p 7s 2s E 2m 1s' },
              focusCentre: true,
              focus: '6p',
              table: 'Riichi from your left, thirteen tiles left in the wall, and the 6p you drew is not in their pond.',
              prompt: 'Late, tenpai on 3s/6s, thin wall. The 6p is not safe. Do you push it?',
              options: [
                { label: 'Push the 6p', correct: true, why: 'Thirteen tiles left means three more draws each. Tenpai is worth the noten payment on its own, your wait is two-sided with all eight tiles live, and folding now surrenders that for the sake of a few discards. Late tenpai pushes — throw the 6p and declare.' },
                { label: 'Fold with a safe tile', why: 'Correct earlier in the hand, wrong here: you would be paying the noten penalty to dodge a few discards, and your hand was already tenpai with a good wait. Folding also means breaking the hand — there is no safe tile that keeps tenpai.' },
                { label: 'Break tenpai but stay in', why: 'The worst of both — you keep discarding tiles into a riichi and you have given up the payment that made staying in worthwhile.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'safe-tiles',
        title: 'Finding a safe tile',
        summary: 'Genbutsu, suji, dead tiles — in that order of certainty.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 10',
            hand: '345m 67m 3p 8p 46s 88s 9s 1m',
            draw: '2p',
            riichi: [2],
            rivers: { 0: 'P S 9m 1s 8m 3s 7s 5p 6p', 1: 'F N 1s 9m 8m 3s 2m 5p 5s', 2: 'E N 3p S 9p 4p 2s P C', 3: 'C P 9p E 2s 7s 6p 5s 2m' },
            focusPond: '2:3p 4p',
            focus: '3p',
            text: [
              'Against a riichi, some tiles are provably safe and others are merely likely to be. Take them in order.',
              'Genbutsu is a tile already in their pond. It is completely safe against that player — a player cannot ron a tile they discarded themselves. Their 3p and 4p are free to you, and you are holding a 3p.',
            ],
            figures: [
              { tiles: '3p 4p', caption: 'Both sit in the pond across from you. Neither can ever deal in — certainty, not a read.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 10',
            hand: '345m 67m 3p 8p 46s 88s 9s 1m',
            draw: '2p',
            riichi: [2],
            rivers: { 0: 'P S 9m 1s 8m 3s 7s 5p 6p', 1: 'F N 1s 9m 8m 3s 2m 5p 5s', 2: 'E N 3p S 9p 4p 2s P C', 3: 'C P 9p E 2s 7s 6p 5s 2m' },
            focusPond: '2:4p',
            text: [
              'Suji is the tile three away from one they discarded. They threw a 4p, so 1p and 7p cannot complete a two-sided wait on it. That is not safety, it is a filter: about four fifths of riichi waits are two-sided, so suji removes most of the danger and leaves the rest.',
            ],
            figures: [
              { tiles: '1p 7p', caption: 'Suji off their 4p: safe against a two-sided wait, not against a closed or pair wait.' },
            ],
            note: {
              title: 'Suji is a probability, not a promise',
              text: 'The one fifth of waits that are not two-sided is exactly why people still deal in on suji tiles.',
            },
          },
          ...drills([
            {
              turn: 'Turn 10',
              hand: '345m 67m 3p 8p 46s 88s 9s 1m',
              draw: '2p',
              riichi: [2],
              rivers: { 0: 'P S 9m 1s 8m 3s 7s 5p 6p', 1: 'F N 1s 9m 8m 3s 2m 5p 5s', 2: 'E N 3p S 9p 4p 2s P C', 3: 'C P 9p E 2s 7s 6p 5s 2m' },
              table: 'Riichi from across. Their pond is on the table — read it.',
              prompt: 'You have decided to fold. Which tile do you throw?',
              options: [
                { label: 'The 3p — it is already in their pond', correct: true, why: 'Genbutsu, and you are holding one. A tile they discarded themselves can never win their hand, so it costs you exactly nothing. Check their pond before anything else, every single time.' },
                { label: 'The 2p you just drew — it sits next to their 3p', why: 'Adjacency is not safety. A 2p can be caught by 13p, by 34p, by a 2p pair. Being near a discard tells you nothing at all.' },
                { label: 'An 8s — you are holding two of them', why: 'Two copies makes a shanpon wait less likely, not impossible, and says nothing about a tanki, a two-sided 67s or a closed 79s. That is a last resort, not a first choice.' },
              ],
            },
            {
              turn: 'Turn 11',
              hand: '234m 567m 46p 22s 79s 9p',
              draw: '4m',
              riichi: [1],
              rivers: { 0: 'P F 9m 1p 8m 3p 5p 5s N S', 1: 'W N 1s 8p 4s 2p 3s 8s P C', 2: 'S N 1p E 8m 7p 5s 1m W F', 3: 'C W 1m 9m 7p 3p 5p F E S' },
              focusPond: '1:4s',
              table: 'Riichi from your right. Nothing of theirs is in your hand.',
              prompt: 'No genbutsu in your hand. Which tile is the least dangerous?',
              options: [
                { label: 'The 7s — suji off their 4s', correct: true, why: 'They discarded 4s, so 7s cannot complete a two-sided 56s wait: the 7s waits left are an edge 89s, a closed 68s, a pair of 7s, or a lone 7s. Not proof, but it removes the most likely shape, and it is the best available when nothing is genbutsu.' },
                { label: 'The 4m — a middle tile', why: 'Middle tiles are the most dangerous class there is: they can be caught by two-sided, closed, edge and pair waits alike, and nothing in their pond rules any of them out.' },
                { label: 'The 9p — a terminal', why: 'Terminals are safer than middles as a class, but their pond says nothing about the 9p: a 78p wait catches it. The 7s is specifically suji; prefer the specific read to the general one.' },
              ],
            },
            {
              turn: 'Turn 12',
              hand: '345m 678m 234p 55p 36s',
              draw: '9m',
              riichi: [2],
              rivers: { 0: 'W P 1m 9s 8s 7s 8p 6p 5s 2m S', 1: 'P F 1p 9p 4s 7p 7s 6p 5s 2s 1m', 2: 'E S 4s 1p N 9p 4s W 1s F C', 3: 'S C 9s 1s 2m 2s 7p 4s 8s 8p F' },
              focusPond: '4s 4s 4s 4s',
              table: 'Riichi from across. All four 4s are in the ponds. Nothing in your hand is genbutsu, and nothing is a full suji.',
              prompt: 'Nothing safe, nothing suji. What do the dead 4s tell you?',
              options: [
                { label: 'The 3s is a no-chance tile — throw it', correct: true, why: 'A 3s deals in to a 12s edge, a 24s closed shape, a 45s two-sided shape, a 3s pair or a lone 3s. Two of those — 24s and 45s — need a 4s, and all four are gone. That kills the two-sided wait, which is the shape four fifths of riichi hands sit on. Counting dead tiles like this is what turns a guess into a read.' },
                { label: 'The 6s, because it is further from their discards', why: 'A 6s is caught by 45s, 57s, 78s, a pair and a tanki, and the dead 4s only remove the first of those. The 3s loses two of its five shapes including the two-sided one; the 6s loses one.' },
                { label: 'The 9m, because terminals are safe', why: 'Terminals are safer on average, and this one has no supporting evidence at all: a 78m wait catches it and nothing in the ponds says they do not have one. When you have an actual count available, use it instead of the average.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'melding',
    book: 9,
    title: 'Melding judgement',
    kanji: '鳴き',
    blurb: 'Calling is not free. It buys speed and it sells your hand.',
    lessons: [
      {
        id: 'to-meld',
        title: 'Do you have a yaku?',
        summary: 'The one question to answer before every call.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 5',
            hand: '234m 678m 44p 78s PP 9p',
            rivers: { 0: 'E N 1m 1s', 1: 'S N 1p 9m', 2: 'E S 1s 1m', 3: 'W S 9m 1p P' },
            focus: 'PP',
            focusPond: '3:P',
            text: [
              'The player to your left has just discarded a white dragon, and you hold two. Before you call, understand what a call costs.',
              'Opening your hand costs riichi, menzen tsumo, pinfu, ippatsu and ura dora — call it two han of expectation, gone the moment you call. The call has to buy at least that much back.',
            ],
            note: {
              title: 'Ask first, call second',
              text: 'What is my yaku after this call? If you cannot name it, do not call. An open hand with no yaku cannot win, and you will spend the rest of the hand discovering that.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 5',
            hand: '234m 678m 44p 78s PP 9p',
            rivers: { 0: 'E N 1m 1s', 1: 'S N 1p 9m', 2: 'E S 1s 1m', 3: 'W S 9m 1p P' },
            focus: '234m 678m 44p 78s',
            text: [
              'Here the answer is easy. Pon the dragon and the yaku IS the call: white dragon, one han, guaranteed. Look at what is left — 234m, 678m, 44p, 78s and a spare 9p — throw the 9p after the call and you are tenpai on 6s and 9s.',
              'The calls that are usually right: a yakuhai triplet; a call that brings you straight to tenpai in a hand that has a yaku; tanyao when the hand is already all simples; honitsu, where the value pays for the loss.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 5',
              hand: '234m 678m 44p 78s PP 9p',
              rivers: { 0: 'E N 1m 1s', 1: 'S N 1p 9m', 2: 'E S 1s 1m', 3: 'W S 9m 1p P' },
              focusPond: '3:P',
              table: 'The third white dragon has just been discarded to your left.',
              prompt: 'Do you call it?',
              options: [
                { label: 'Pon — the dragon is the yaku', correct: true, why: 'One call turns a yakuless one-away hand into a tenpai hand with a guaranteed han: pon, throw the 9p, wait on 6s and 9s. This is the call that is always worth making.' },
                { label: 'Pass — keep the hand closed for riichi', why: 'Closed, you are one away with a thin eleven-tile acceptance and no dora, and the last white dragon is about to be gone for good. The closed route is slower and, without the dragon triplet, not obviously worth more.' },
                { label: 'Pass — you already have a pair for your head', why: 'True and irrelevant: 44p can be your head and the dragons your yaku at the same time. That is precisely why this call is free.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '234m 55m 789m 34p 68s 1s',
              rivers: { 0: 'C E 1p 9p 8p', 1: 'N P 1m 1p 2s', 2: 'W F 9s 1m 2s', 3: 'W S 9p 1m 8p 2p' },
              focusPond: '3:2p',
              table: 'The player to your left discards 2p. Chi would give you 234p, and throwing the 1s would leave you tenpai on 7s.',
              prompt: 'A chi that brings tenpai. Your hand has no yaku and no dora. Call?',
              options: [
                { label: 'Pass', correct: true, why: 'Name the yaku after the call: there is not one. All simples? No — 789m is in the hand for good. Yakuhai? Nothing. An open hand with no yaku cannot win, so this "tenpai" would be worthless.' },
                { label: 'Chi — tenpai is tenpai', why: 'Tenpai you cannot win from is not tenpai, it is a noten payment with extra steps. This is the single most common melding mistake.' },
                { label: 'Chi and switch to a terminal hand later', why: 'Chanta needs every block to touch a terminal or honour, and your 55m and 68s do not. You cannot get there from here.' },
              ],
            },
            {
              turn: 'Turn 8',
              hand: '234m 567m 44p 35s 67s 2p',
              rivers: { 0: 'N W 9m 9s 8p 3p 6p', 1: 'F P 9p 1m 2s 7p 8m', 2: 'P C 1s E 8m 7p 6p', 3: 'S F 1p 9m 8p 3p 4s' },
              focusPond: '3:4s',
              focus: '35s',
              table: 'A 4s is discarded to your left. Chi with 35s makes 345s; throw the 2p and you are tenpai on 5s/8s, all simples.',
              prompt: 'Tanyao is live and the call brings tenpai. Call?',
              options: [
                { label: 'Chi — tanyao is your yaku', correct: true, why: 'Every tile in the hand is a simple, so tanyao survives the call and gives you a legal win. You were one away with a closed 35s shape; the call makes you tenpai on turn eight on a two-sided wait, with a yaku. That is worth far more than the closed hand you were still two good draws away from.' },
                { label: 'Pass and keep it closed for riichi', why: 'Defensible with a fast hand — but your one-away shape was a closed 35s, four tiles, and you are giving up an immediate two-sided tenpai. With tanyao intact, the call is the better half of a close call.' },
                { label: 'Pass — an open tanyao is worth almost nothing', why: 'One han is not much, but one han now beats two han three turns later, and the fold pressure of an early open tenpai is real.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'credits',
    book: 0,
    title: 'Where this comes from',
    kanji: '出典',
    blurb: 'The syllabus, the source, and what to read next.',
    lessons: [
      {
        id: 'source',
        title: 'Riichi Book I',
        summary: 'Credit where it is due, and the book itself.',
        steps: [
          {
            kind: 'teach',
            text: [
              'This course follows the chapter structure of Riichi Book I: A Mahjong Strategy Primer for European Players, by Daina Chiba (2016) — chapters 3 onward, which is where the book stops explaining websites and starts explaining mahjong.',
              'Chapter 3, the building blocks. Chapter 4, the five-block method. Chapter 5, pursuing yaku. Chapter 7, riichi judgement. Chapter 8, defence. Chapter 9, melding.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'The book is released under a Creative Commons Attribution Non-Commercial licence and is free to download. The hands, wording and drills here are written for this app rather than copied, but the syllabus is his and the book is far more thorough than a phone screen can be. Read it.',
            ],
            note: {
              title: 'Not covered here yet',
              text: 'Chapter 6 (scoring) and Chapter 10 (endgame strategy). Chapter 6 especially is worth reading in the book, because knowing what your hand is worth is what makes every judgement in this course concrete.',
            },
          },
        ],
      },
    ],
  },
];

export const ALL_LESSONS: { chapter: Chapter; lesson: Lesson }[] =
  CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ chapter: c, lesson: l })));

export function lessonById(id: string): { chapter: Chapter; lesson: Lesson } | null {
  return ALL_LESSONS.find((x) => x.lesson.id === id) ?? null;
}

/** The lesson after `id` in reading order, or null at the end of the course. */
export function nextLesson(id: string): Lesson | null {
  const i = ALL_LESSONS.findIndex((x) => x.lesson.id === id);
  return i >= 0 && i + 1 < ALL_LESSONS.length ? ALL_LESSONS[i + 1].lesson : null;
}
