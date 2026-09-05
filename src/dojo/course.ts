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
  /** Turn label, e.g. "Turn 4". Sets the scene for a scripted position. */
  turn?: string;
  /** The concealed hand for this step. */
  hand?: string;
  /** The tile just drawn, shown apart from the hand. */
  draw?: string;
  /** Tiles already called, shown as a meld row. */
  meld?: string;
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
            text: [
              'A winning hand is four sets and a pair. A set is three tiles: a run of three consecutive tiles in one suit, or three of the same tile. Everything you do in a hand is about getting there faster, or more expensively, than three other people.',
              'You have just drawn the 9s. Before you throw anything, look at what the hand is made of.',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '3456m 789m 13p 78p 55s',
            draw: '9s',
            text: [
              'Most of your hand is not finished sets, it is two-tile shapes one tile short. Which kind you hold matters enormously, because they are not equally good.',
            ],
            figures: [
              { tiles: '78p', caption: 'Two-sided (ryanmen). 6p or 9p finishes it — eight tiles.' },
              { tiles: '13p', caption: 'Closed (kanchan). Only 2p finishes it — four tiles.' },
              { tiles: '55s', caption: 'A pair (toitsu). Two tiles left to make it a triplet.' },
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
            text: [
              'So: 3456m is a run with a spare, 789m is a run, 13p is a closed shape, 78p is two-sided, 55s is your pair. That is five blocks and change.',
              'The 9s is a floater — a lone tile doing nothing. It is not attached to anything, and being a terminal it can only ever grow one way. It goes.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 2',
              hand: '234m 678m 22p 45p 789s',
              draw: 'E',
              prompt: 'You drew the East wind. You are the South seat, and East is not your wind. What leaves?',
              check: 'efficiency',
              options: [
                { tile: 'E', correct: true, why: 'A wind that is neither your seat nor the round can only ever be a triplet, and you have one copy. It is the emptiest tile in the hand — throw it while it is still safe to throw.' },
                { tile: '2p', why: 'That is your only pair. Every hand needs a head; giving it up for nothing costs you a block.' },
                { tile: '4p', why: 'Breaking a two-sided shape while a lone honour sits in your hand is exactly backwards.' },
                { tile: '9s', why: 'That breaks a finished run. Never break a completed set while junk is in the hand.' },
              ],
            },
            {
              turn: 'Turn 3',
              hand: '345m 55m 789m 123p 78p',
              draw: '9s',
              prompt: 'Six blocks want to be five. Which tile goes?',
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
              prompt: 'Six blocks and not one of them is junk. Which is weakest?',
              check: 'efficiency',
              options: [
                { tile: '1p', correct: true, why: 'The 12p edge shape accepts only 3p — four tiles — and 3p is the tile opponents hold on to. Of your three partial sets it does the least work, so it is the one to break.' },
                { tile: '4p', why: 'The 46p closed shape also accepts four tiles, so this is genuinely close — it loses because 46p wants a middle 5p, which flows far more freely than the 3p an edge shape needs.' },
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
            hand: '234m 55m 678m 135p',
            draw: '9s',
            table: 'Three 4p are already lying in the ponds.',
            text: [
              'Some shapes are worth more than the sum of their parts, and 135p is the one players throw away by mistake. It looks like two bad closed shapes. It is not.',
            ],
            figures: [
              { tiles: '135p', caption: 'Ryankan: 2p and 4p both finish it. Eight tiles — the same as a two-sided shape.' },
              { tiles: '3456p', caption: 'A run with a two-sided extension: 3p or 6p, and either way you keep a clean run.' },
              { tiles: '1123m', caption: 'A pair, a run-to-be and an edge shape at once: 1m, 3m and 4m all help.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 5',
            hand: '234m 55m 678m 135p',
            draw: '9s',
            table: 'Three 4p are already lying in the ponds.',
            text: [
              'The 9s goes, obviously — but look at the ponds before the next turn, because that ryankan is about to matter.',
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
              prompt: 'You are one tile from tenpai and 1p or 5p both get you there. Three 4p are in the ponds. Which?',
              check: 'efficiency',
              options: [
                { tile: '5p', correct: true, why: 'Throwing 5p leaves 1p-3p waiting on 2p, and all four 2p are live. Throwing 1p would leave 3p-5p waiting on the 4p — of which one remains. Identical shape, four times the wait.' },
                { tile: '1p', why: 'Also tenpai, on the tile the table has already eaten. This is the trap: the shapes look the same and the wait is a quarter of the size.' },
                { tile: '3p', why: 'The 3p is the tile both closed shapes share. Remove it and they collapse together — and you are not even tenpai.' },
                { tile: '5m', why: 'Breaking your head to keep a spare. That is a step backwards from tenpai.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '1123m 456m 789p 345s',
              draw: '9s',
              prompt: 'The 1123m shape is a pair AND a two-sided shape in four tiles. Prove it.',
              check: 'efficiency',
              options: [
                { tile: '9s', correct: true, why: 'Tenpai. Read 1123m as 11m plus 23m and the hand is three sets, a pair and a two-sided shape waiting on 1m and 4m — eight tiles. That is what the four-tile shape was worth all along.' },
                { tile: '1m', why: 'Also tenpai, and much worse: 123m 456m 789p 345s leaves a lone 9s tanki, three tiles. Same shanten, a quarter of the wait — this is the trap the shape is designed to avoid.' },
                { tile: '3m', why: 'Breaks the shape in the middle and leaves 112m doing nothing useful. Neither a clean pair nor a run.' },
                { tile: '9p', why: 'Breaking a completed run while an unattached tile sits in the hand.' },
              ],
            },
            {
              turn: 'Turn 7',
              hand: '345m 3456p 789p 44s 5s',
              draw: '1m',
              prompt: 'Which tile is genuinely spare here?',
              check: 'efficiency',
              options: [
                { tile: '1m', correct: true, why: 'Blocks: 345m, 3456p (a run plus an extension), 789p, 44s. The 1m connects to nothing at all — it is the only tile in the hand doing no work.' },
                { tile: '3p', why: 'That is the extension end of 3456p. Throwing it leaves 456p and gives up the 3p/6p improvement for nothing.' },
                { tile: '6p', why: 'Same shape, other end. The four-tile run-plus-extension is worth keeping whole while you still have a floater to shed.' },
                { tile: '4s', why: 'Your only pair, thrown while a lone terminal sits in the hand.' },
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
            hand: '234m 567m 234p 55s 78s',
            text: [
              'You are tenpai: one tile from complete. The tiles that finish the hand are your wait, and there are five kinds with wildly different sizes.',
            ],
            figures: [
              { tiles: '78s', caption: 'Ryanmen — 6s and 9s. Eight tiles.' },
              { tiles: '46s', caption: 'Kanchan — 5s only. Four tiles.' },
              { tiles: '12s', caption: 'Penchan — 3s only. Four tiles.' },
              { tiles: '55s', caption: 'Shanpon or tanki — two or four tiles.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 9',
            hand: '234m 567m 234p 555s',
            draw: '8s',
            text: [
              'Then you draw the third 5s and the hand changes shape. Now you hold four complete sets and a two-tile fragment, and every discard leaves you tenpai on something different.',
              'This is the moment where players talk themselves into the wrong wait, because a triplet feels like progress.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 9',
              hand: '234m 567m 234p 555s 78s',
              prompt: 'Every discard here is tenpai. Which wait do you actually want?',
              check: 'efficiency',
              options: [
                { tile: '5s', correct: true, why: 'Break the triplet back to a pair and 78s waits on 6s and 9s: eight tiles, two-sided. The third 5s bought you one tile of shape and cost you half your wait.' },
                { tile: '8s', why: 'Four sets and a lone 7s — a tanki on 7s. Four tiles, and you are holding none of the help.' },
                { tile: '7s', why: 'A tanki on 8s. Same size problem, and a middle tanki is not a wait people deal into early.' },
                { tile: '2p', why: 'Breaking a completed run to reshape a wait. Never.' },
              ],
            },
            {
              turn: 'Turn 11',
              hand: '345m 678m 123p 99p 46s',
              draw: '5s',
              table: 'Two 9p are visible in the ponds.',
              prompt: 'Tenpai either way. The 9p pair or the sou shape?',
              check: 'efficiency',
              options: [
                { tile: '4s', correct: true, why: 'Throwing 4s leaves 56s waiting on 4s and 7s — eight tiles, and none of them visible. The alternative is a 9p shanpon with only two 9p left in the world.' },
                { tile: '6s', why: 'Leaves 45s waiting on 3s and 6s, which is also eight tiles — a perfectly reasonable answer, and worse only because you just discarded the 6s neighbourhood yourself.' },
                { tile: '9p', why: 'Now you have 99p broken and no head at all. This is not tenpai.' },
                { tile: '5s', why: 'Throwing the tile you just drew keeps 46s: a closed wait on 5s, four tiles, when eight were available.' },
              ],
            },
            {
              turn: 'Turn 12',
              hand: '234m 567m 789m 44p 13s',
              draw: '2s',
              table: 'All four 4s and three 1s are already visible.',
              prompt: 'The 2s completes the sou shape. Do you take that tenpai, or the other one?',
              check: 'efficiency',
              options: [
                { tile: '1s', correct: true, why: 'Throw 1s and you wait on 4p for the shanpon... no: you wait on 2s-3s, a two-sided shape on 1s and 4s. Both are nearly dead — but so is every alternative, and this keeps the 44p pair as your head with a live tanki fallback.' },
                { tile: '3s', why: 'Leaves 12s waiting on 3s only. An edge wait, four tiles, and you are holding one of them.' },
                { tile: '4p', why: 'Breaking your head leaves 13s and 2s as your only shapes. You lose tenpai entirely.' },
                { tile: '2s', why: 'Throwing the tile that just improved the hand puts you back where you started, waiting on the 2s you have now shown the table.' },
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
            hand: '234m 88m 345p 12p 456s',
            draw: '3s',
            text: [
              'A finished hand is four sets and a pair: five blocks. So the whole early game is assembling five blocks and then feeding them, and every discard answers one question — do I already have five?',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 3',
            hand: '234m 88m 345p 12p 456s',
            draw: '3s',
            text: [
              'Count: 234m, 88m, 345p, 12p, 456s. Five. The 3s you just drew is a sixth candidate, and you have nowhere to put it.',
            ],
            note: {
              title: 'Why not six?',
              text: 'You can only use five. A sixth block does nothing but starve the other five, because every tile you spend feeding it is a tile you did not spend on a block you will actually use.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 3',
            hand: '234m 88m 345p 12p 456s',
            draw: '3s',
            text: [
              'The exception is when one of your five is very weak — an edge shape, or a pair of a tile three of which are already visible. Then a sixth candidate is insurance, and you hold it a turn or two while you see whether the weak one improves.',
              'Here the weak block is 12p. It is worth watching. It is not worth keeping a sixth block for on turn three, when you still have plenty of draws.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 4',
              hand: '234m 88m 345p 12p 456s',
              draw: '3s',
              prompt: 'Five blocks and a spare. What goes?',
              check: 'efficiency',
              options: [
                { tile: '3s', correct: true, why: 'The sixth candidate. Everything else in the hand is already part of a block you intend to use.' },
                { tile: '1p', why: 'The 12p edge shape is your weakest block and it will probably go eventually — but not while an unattached tile is sitting in the hand.' },
                { tile: '8m', why: 'Your only pair. Break it and you have four blocks and a head-shaped hole.' },
                { tile: '2m', why: 'Breaking a finished run to make room for a floater.' },
              ],
            },
            {
              turn: 'Turn 5',
              hand: '567m 99m 234p 78p 456s',
              draw: '2s',
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
              prompt: 'Here you only have four real blocks. Which floater do you keep?',
              check: 'efficiency',
              options: [
                { tile: '3s', correct: true, why: 'Blocks: 3456m, 789m, 22p, 456p — four and a spare man tile. You need a fifth block, so the question is which sou floater grows best, and 7s reaches 5s through 9s while 3s is the more crowded end.' },
                { tile: '7s', why: 'The mirror answer, and only marginally worse. What matters is that you keep exactly one of the two and do not sit on both while you are still short a block.' },
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
            hand: '345m 89m 34p FF 456s',
            draw: '1s',
            text: [
              'Sooner or later you draw a better block than one you hold and something has to go. The order is almost always the same, worst first.',
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
            hand: '345m 89m 34p FF 456s',
            draw: '1s',
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
              hand: '345m 89m 345p FF 456s 1s',
              prompt: 'Six blocks, two of them weak, one of them worth a han. Which goes?',
              check: 'efficiency',
              options: [
                { tile: '1s', correct: true, why: 'You are holding two edge-ish shapes and a dragon pair. One of the weak shapes has to go, and the freshly drawn 1s is attached to nothing at all.' },
                { tile: '9m', why: 'Defensible — 89m is genuinely your weakest real block. It only loses because the 1s is not a block at all.' },
                { tile: 'F', why: 'The mistake this lesson exists for. Two tiles from a guaranteed yaku, and the copy you need is the one nobody discards after turn ten. Breaking it makes the hand fast and worthless.' },
                { tile: '4s', why: 'Breaking a finished run to solve a spare-block problem, while an unattached terminal sits in the hand.' },
              ],
            },
            {
              turn: 'Turn 8',
              hand: '123m 79m 456p 78p 234s',
              draw: '5s',
              prompt: 'No honours here, so it is pure shape. Which block loses?',
              check: 'efficiency',
              options: [
                { tile: '9m', correct: true, why: 'The 79m closed shape accepts only 8m. Everything else in the hand is a finished run or a two-sided shape, and the 5s is attached to your 234s.' },
                { tile: '5s', why: 'It extends 234s into 2345s, which is worth a little — but nothing like as much as being rid of a four-tile closed shape.' },
                { tile: '8p', why: 'Breaking eight tiles of acceptance to keep four. This is the shape order upside down.' },
                { tile: '1m', why: 'Breaking a completed run to solve a problem that a spare tile already solves.' },
              ],
            },
            {
              turn: 'Turn 9',
              hand: '234m 55m 678p 12s 345s',
              draw: 'P',
              table: 'Nobody has discarded a white dragon yet.',
              prompt: 'You drew a lone white dragon on turn nine with five blocks already. Now what?',
              options: [
                { label: 'Discard the white dragon', correct: true, why: 'You already have five blocks and a head, and a lone dragon needs two more copies. On turn nine that is a long shot, and honours get harder to discard the longer you hold them. Let it go now while it is still safe.' },
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
            hand: '345m 789m 22p 456s',
            draw: '5p',
            table: 'You also hold a lone 1m and a lone North wind.',
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
            hand: '345m 789m 22p 456s',
            draw: '5p',
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
              turn: 'Turn 1',
              hand: '345m 678m 8m 22p 4567s',
              draw: 'P',
              table: 'First go-around.',
              prompt: 'Turn one, four blocks, and you draw a white dragon. What do you throw?',
              options: [
                { label: 'Discard the 8m', correct: true, why: 'Keep the dragon. On turn one a lone yakuhai costs you almost nothing, and pairing it turns a cheap hand into one with a guaranteed yaku that can also be opened. The 8m next to 678m is nearly redundant.' },
                { label: 'Discard the white dragon', why: 'The safe habit, and a small leak. Early, an honour is cheap to hold and the upside is a han and the freedom to call. Late, this answer becomes right.' },
                { label: 'Discard 2p', why: 'Your only pair, on turn one, for no reason at all.' },
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
            hand: '234m 234p 22s 34s 678s',
            draw: '9s',
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
            hand: '234m 234p 22s 34s 678s',
            draw: '9s',
            text: [
              'Now look at this hand properly. You hold 234m and 234p, and your 34s is one tile from 234s — the same run in all three suits, which is sanshoku, worth two han closed.',
              'The important part: you were keeping 34s anyway. It is a two-sided shape. The yaku costs you nothing, so you take it.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 7',
              hand: '234m 234p 22s 34s 678s 9s',
              prompt: 'Sanshoku is one tile away and it is free. Confirm it.',
              check: 'efficiency',
              options: [
                { tile: '9s', correct: true, why: 'The 9s is your only spare tile. Keeping 34s keeps both your acceptance and the sanshoku — that is what "free" means, and it is the only kind of sanshoku worth chasing.' },
                { tile: '4s', why: 'Throwing the shape that carries both the acceptance and the yaku, to keep a lone 9s.' },
                { tile: '2s', why: 'The 2s pair is your head, and the 2s is also the sanshoku tile. Breaking it gives up both at once.' },
                { tile: '2m', why: 'Breaking a run that is part of the sanshoku.' },
              ],
            },
            {
              turn: 'Turn 8',
              hand: '345m 456p 22s 78s 999s',
              draw: '3p',
              prompt: 'Sanshoku 345 is two tiles away: you would need 345p AND 345s. Worth it?',
              check: 'efficiency',
              options: [
                { tile: '3p', correct: true, why: 'Yes, throw it — the sanshoku is not free here. You already hold 456p; converting it to 345p means drawing 3p and discarding 6p, then rebuilding the sou side too. Two turns of speed for two han is a bad trade on turn eight.' },
                { tile: '8s', why: 'Breaking a two-sided shape to chase a yaku that needs two more specific tiles. This is exactly the trap.' },
                { tile: '6p', why: 'The first step of the chase, and the point where it starts costing you. One step is how these things always begin.' },
                { tile: '2s', why: 'Breaking your head for a yaku detour.' },
              ],
            },
            {
              turn: 'Turn 5',
              hand: '234m 567m 345p 33s 78s',
              draw: '9m',
              table: 'Your hand is closed and every tile is a simple.',
              prompt: 'You are one tile from tenpai. The 9m would break tanyao. What do you do?',
              options: [
                { label: 'Discard the 9m', correct: true, why: 'The hand is already all simples: tanyao is sitting there for free, and keeping 9m would break it while adding nothing. You are not choosing a yaku, you are declining to throw one away.' },
                { label: 'Keep 9m for a possible 789m', why: 'You would be spending a turn and your tanyao to build a sixth block you have no room for.' },
                { label: 'Discard 3s and keep 9m', why: 'Breaking your head and your yaku in one move, to keep a terminal you drew by accident.' },
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
            hand: '1123p 789p PP FF',
            draw: '5m',
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
            hand: '1123p 789p PP FF',
            draw: '5m',
            text: [
              'Toitoi is all triplets: two han, and it pairs naturally with yakuhai. Commit when you already hold three pairs by turn six. The catch is that pairs complete on two tiles instead of eight, so the hand is slow and needs the value to justify it.',
              'Chiitoitsu is seven distinct pairs, closed only, two han. Take it when you hold five pairs early — not as a consolation prize at turn twelve, when the single-tile wait at the end will not save you.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 4',
              hand: '1123p 55p 789p PP FF 5m',
              prompt: 'Nine pin tiles and two dragon pairs. Commit or stay flexible?',
              check: 'efficiency',
              options: [
                { tile: '5m', correct: true, why: 'Commit. Nine tiles of one suit plus two dragon pairs on turn four is a honitsu with yakuhai on top — potentially a haneman. The lone 5m is the only tile in the hand that cannot be part of it.' },
                { tile: '1p', why: 'The 1123p shape is doing three jobs and it is the backbone of the flush. Breaking it while an off-suit floater sits in the hand is the wrong order.' },
                { tile: 'P', why: 'Breaking a dragon pair in a honitsu hand throws away the yaku that makes the hand expensive.' },
                { tile: '9p', why: 'Breaking a finished run of the suit you are collecting.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '11m 8m 44m 77p 99p 33s 5s',
              draw: '8s',
              prompt: 'Five pairs on turn six. What is this hand?',
              options: [
                { label: 'Chiitoitsu — throw the 8m', correct: true, why: 'Five pairs by turn six is exactly when seven pairs is right. Every pair you hold is already progress and the floaters are not, so shed them one at a time and keep the two most likely to pair.' },
                { label: 'Ignore it and build runs — throw the 1m', why: 'Five pairs is a terrible standard hand: you would be breaking four of your five blocks to build runs from nothing.' },
                { label: 'Go for toitoi — throw the 5s', why: 'Not unreasonable with this many pairs, but toitoi needs four of them to become triplets — two tiles each, and you cannot call for chiitoitsu. Seven pairs is the faster read of the same tiles.' },
              ],
            },
            {
              turn: 'Turn 11',
              hand: '234m 567m 88p 345s 33s',
              draw: '9m',
              table: 'The player across from you has discarded nothing but man tiles for six turns and has called two pon of pin tiles.',
              prompt: 'What is the seat across from you doing, and what does that mean for your 9m?',
              options: [
                { label: 'They are on a pin honitsu — hold the 9m and fold', correct: true, why: 'Two pon of pin and a river of nothing but man is the loudest tell in the game. Their hand is pin plus honours, so your man tiles are safe against them and any pin tile is not. The 9m is a safe tile — hold it as your escape, not as part of the hand.' },
                { label: 'They are collecting man tiles — the 9m is dangerous', why: 'Backwards: tiles a player discards are the tiles they cannot win on. A river full of man means man is safe against them.' },
                { label: 'Nothing readable yet — discard the 9m and push', why: 'Two calls and a one-suit river by turn eleven is not ambiguous. Pushing into it without checking what is safe is how a cheap hand pays for an expensive one.' },
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
            table: 'Closed hand. Nobody else has declared.',
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
            text: [
              'Declare immediately, too. Riichi on the turn you reach tenpai, not two turns later after you have "improved" it. Every turn you wait is a turn of ippatsu and a draw thrown away, and the improvement usually does not come.',
              'The common beginner mistake is holding dama because the wait feels bad. A bad wait with riichi is usually still better than a bad wait without it: the value goes up and the opponents fold, which means your bad wait now faces three players throwing safe tiles instead of three players building hands.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 6',
              hand: '234m 567m 44p 234s 78s 1m',
              table: 'Closed. Nobody has declared. Wall is half full.',
              prompt: 'Discarding 1m gives tenpai on 6s/9s. Riichi or dama?',
              options: [
                { label: 'Riichi, discarding 1m', correct: true, why: 'A two-sided wait, turn six, nobody committed. This is the textbook insta-riichi — there is no reason on the exceptions list that applies here.' },
                { label: 'Dama, discarding 1m', why: 'You keep the ability to fold and you give up roughly four times the value. Dama needs a reason; "I might deal in" is not one.' },
                { label: 'Discard 4p to reshape the hand', why: 'Breaking your head while tenpai, hoping for a better hand that will not arrive. This is the improvement trap.' },
              ],
            },
            {
              turn: 'Turn 3',
              hand: '345m 678m 234p 55s 46s',
              draw: '9p',
              table: 'Closed. Turn three. Nobody has discarded a 5s.',
              prompt: 'Tenpai on turn three, but the wait is a closed 5s. Riichi?',
              options: [
                { label: 'Riichi, discarding 9p', correct: true, why: 'Yes. A closed wait feels bad and the arithmetic disagrees: on turn three you have fifteen draws left, all four 5s are live, and riichi roughly quadruples what the hand pays. Early riichi on a poor wait still beats late dama on a good one.' },
                { label: 'Dama and wait for a better shape', why: 'The wait might improve, and meanwhile you have surrendered ippatsu, ura, and the pressure that makes three opponents stop attacking. Improvement is a maybe; the value is certain.' },
                { label: 'Discard 4s and take a 5s tanki instead', why: 'A worse wait for no gain, and it does not dodge the decision — you would still be choosing between riichi and dama, just with fewer tiles.' },
              ],
            },
            {
              turn: 'Turn 8',
              hand: '234m 567m 234p 55s 78s',
              draw: '9s',
              table: 'You discarded a 6s on turn two. Closed, nobody else declared.',
              prompt: 'Throwing 9s gives tenpai on 6s and 9s. But you discarded a 6s earlier. Now what?',
              options: [
                { label: 'Dama — you are furiten', correct: true, why: 'You discarded a 6s, which is part of your own wait, so you cannot ron either tile: only tsumo. Riichi would lock you into that for the rest of the hand with no way to fold. This is one of the four real exceptions.' },
                { label: 'Riichi anyway — tsumo still pays', why: 'It does, and you have thrown away the ability to drop out plus most of the ways to win. Furiten riichi is a specialist play, not a default.' },
                { label: 'Discard 5s and wait on 7s tanki instead', why: 'A four-tile tanki to escape furiten is worth considering, but you would be discarding into an eight-tile wait you can still tsumo. Dama keeps more.' },
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
            table: 'Closed, three dora, tenpai on 3s and 6s.',
            text: [
              'The exceptions are real but narrow. Learn them as a list and treat anything not on the list as a riichi.',
              'One: the hand is already big. Two: you are furiten. Three: there are no draws left. Four: you are leading in the last hand and want it to end quietly.',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 9',
            hand: '234m 22m 345p 678p 45s',
            text: [
              'Notice what is not on that list: "the wait is bad", "somebody riichi\'d first", "I might deal in". Those feel like reasons and are usually not. A bad wait still wants the value. A second riichi still wants the pressure.',
            ],
            note: {
              title: 'A test for the exceptions',
              text: 'If your reason for dama is about the hand — its size, its furiten, the wall running out — it is probably real. If it is about your nerves, it is not.',
            },
          },
          ...drills([
            {
              turn: 'Turn 14',
              hand: '345m 678m 234p 99p 55s',
              draw: '2m',
              table: 'Four tiles left in the wall. Closed, tenpai on the 9p / 5s shanpon.',
              prompt: 'One draw each remains. Do you declare?',
              options: [
                { label: 'Dama', correct: true, why: 'Riichi buys you a single draw and forfeits your ability to drop the hand, and there is barely time for ippatsu or ura to matter. With the wall this short, tenpai for the noten payment is the prize — do not risk it.' },
                { label: 'Riichi', why: 'A han and an ura chance on one draw, in exchange for being unable to fold on the last go-around. The maths does not survive the wall being this short.' },
                { label: 'Break tenpai and play safe', why: 'Worse than either: you give up the noten payment and gain nothing. Take the tenpai.' },
              ],
            },
            {
              turn: 'Turn 7',
              hand: '234m 567m 44p 234s 78s',
              draw: '1m',
              table: 'Your hand holds three dora. Closed, tenpai on 6s/9s. Nobody else has declared.',
              prompt: 'Three dora, closed, a good wait. Riichi or dama?',
              options: [
                { label: 'Riichi', correct: true, why: 'Dama-because-it-is-big applies to hands that are already at the mangan ceiling on a narrow wait. This is three dora on an eight-tile wait: riichi adds a han, ippatsu and ura on top and pushes it well past mangan. Declare.' },
                { label: 'Dama to keep it quiet', why: 'The instinct is right in principle — big hands can afford silence — but it applies when riichi adds little and the wait is thin. Here it adds a lot and the wait is wide.' },
                { label: 'Dama and fish for a better wait', why: 'You already have the best wait shape in the game. There is nothing to fish for.' },
              ],
            },
            {
              turn: 'Turn 10',
              hand: '345m 678m 22p 456p 78s',
              draw: '3m',
              table: 'The seat to your left declared riichi two turns ago. Your hand is cheap: no dora, no yaku but riichi.',
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
            hand: '345m 78m 234p 55s 468s',
            draw: '2p',
            table: 'The player across from you declared riichi on turn seven.',
            text: [
              'Somebody has declared. You have a hand. The question is not whether you are scared — it is whether what you stand to win beats what you stand to lose, and both sides of that are estimable.',
              'How close are you? How much is the hand worth? How dangerous is the tile you would have to throw? And how late is it?',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 8',
            hand: '345m 78m 234p 55s 468s',
            draw: '2p',
            text: [
              'This hand is two away from tenpai with no yaku and no dora. That is the easy case: it is not worth a single dangerous tile. Fold.',
            ],
            note: {
              title: 'The short version',
              text: 'Tenpai with value: push. Tenpai and cheap: push safe tiles, fold to dangerous ones. One away and cheap: fold. Two away: fold, and do it early enough that you still have safe tiles left.',
            },
          },
          {
            kind: 'teach',
            turn: 'Turn 8',
            hand: '345m 78m 234p 55s 468s',
            draw: '2p',
            text: [
              'That last clause is the part people get wrong. Folding is a plan that needs materials. Wait until turn fourteen to decide and you will be holding nothing but dangerous tiles, and you will deal in anyway.',
              'Decide by turn eight or nine and keep one or two safe tiles in reserve.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 8',
              hand: '345m 78m 234p 55s 468s 2p',
              table: 'Riichi from across the table on turn seven. Your hand: two from tenpai, no dora, no yaku.',
              prompt: 'Two away, cheap, into a live riichi. What is the plan?',
              options: [
                { label: 'Fold, starting now', correct: true, why: 'Two shanten with nothing to show for it is not worth one dangerous tile, let alone the four or five you would need. Start folding while you still have safe tiles to fold with.' },
                { label: 'Push — you might still get there', why: 'You need three more useful draws and each intervening discard is a coin flip against a mangan. The arithmetic is not close.' },
                { label: 'Push one turn and see', why: 'The most common way to deal in: the tile you throw "just this once" is the one that costs eight thousand, and by the time you commit to folding you have no safe tiles left.' },
              ],
            },
            {
              turn: 'Turn 9',
              hand: '234m 567m 234p 55s 78s',
              draw: '1m',
              table: 'Riichi from your right on turn eight. Your hand is tenpai on 6s/9s with two dora, and the 1m is in their pond.',
              prompt: 'Tenpai, two dora, and the tile you want to throw is already in their discards. Now?',
              options: [
                { label: 'Push — declare riichi', correct: true, why: 'The tile is genbutsu, so pushing costs you nothing at all this turn, and you are tenpai with a good wait and real value. This is the easiest push in mahjong: free danger and a hand worth having.' },
                { label: 'Fold and hold the tenpai', why: 'You cannot both fold and keep tenpai — folding means dismantling. Throwing away a valuable tenpai hand when the discard is provably safe is pure loss.' },
                { label: 'Dama and push quietly', why: 'Pushing without the value on. If the tile is safe and the hand is good, take the riichi too.' },
              ],
            },
            {
              turn: 'Turn 13',
              hand: '345m 678m 234p 99p 45s',
              draw: '3s',
              table: 'Riichi from your left. Six tiles left in the wall. You are tenpai on 3s/6s but you just drew one of your own waits.',
              prompt: 'Late, tenpai, thin wall. The 3s you drew is not safe. Do you push it?',
              options: [
                { label: 'Push the 3s', correct: true, why: 'Six tiles left means one or two more draws each. Tenpai is worth the noten payment on its own, your wait is two-sided, and folding now surrenders that for the sake of one turn of safety. Late tenpai pushes.' },
                { label: 'Fold with a safe tile', why: 'Correct earlier in the hand, wrong here: you would be paying the noten penalty to dodge one or two discards, and your hand was already tenpai with a good wait.' },
                { label: 'Break tenpai but stay in', why: 'The worst of both — you keep discarding tiles into a riichi and you have given up the payment that made staying in worthwhile.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'safe-tiles',
        title: 'Finding a safe tile',
        summary: 'Genbutsu, suji, one-chance — in that order of certainty.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 10',
            hand: '345m 678m 123p 45s 88s',
            draw: '2p',
            table: 'Riichi from across. Their pond: 3p, 9m, 4p, 1s, 7z.',
            text: [
              'Against a riichi, some tiles are provably safe and others are merely likely to be. Take them in order.',
              'Genbutsu is a tile already in their pond. It is completely safe against that player — you cannot ron a tile you discarded yourself. Their 3p and 4p are free to you.',
            ],
            figures: [
              { tiles: '3p 4p', caption: 'In their pond. These can never deal in — this is certainty, not a read.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 10',
            hand: '345m 678m 123p 45s 88s',
            draw: '2p',
            table: 'Riichi from across. Their pond: 3p, 9m, 4p, 1s, 7z.',
            text: [
              'Suji is the tile four away from one they discarded. They threw a 4p, so 1p and 7p cannot complete a two-sided wait on it. That is not safety, it is a filter: about four fifths of riichi waits are two-sided, so suji removes most of the danger and leaves the rest.',
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
              hand: '345m 678m 123p 45s 88s 2p',
              table: 'Riichi from across. Their pond: 3p, 9m, 4p, 1s, and a North wind.',
              prompt: 'You have decided to fold. Which tile do you throw?',
              options: [
                { label: 'The 3p — it is already in their pond', correct: true, why: 'Genbutsu, and you are holding one. A tile they discarded themselves can never win their hand, so it costs you exactly nothing. Check their pond before anything else, every single time.' },
                { label: 'The 2p you just drew — it sits next to their 3p', why: 'Adjacency is not safety. A 2p can be caught by 13p, by 34p, by a 2p pair. Being near a discard tells you nothing at all.' },
                { label: 'An 8s — you are holding two of them', why: 'Two copies makes a shanpon wait less likely, not impossible, and says nothing about a tanki or a two-sided wait. That is a last resort, not a first choice.' },
              ],
            },
            {
              turn: 'Turn 11',
              hand: '234m 567m 345p 22s 79s',
              draw: '4m',
              table: 'Riichi from your right. Their pond contains 1s, 4s, 8m and 2p. You have no genbutsu.',
              prompt: 'No tile of theirs in your hand. Which is the least dangerous?',
              options: [
                { label: 'The 7s — suji off their 4s', correct: true, why: 'They discarded 4s, so 7s cannot complete a two-sided wait on it. Not proof, but it removes the most likely shape, and it is the best available when nothing is genbutsu.' },
                { label: 'The 4m — a middle tile', why: 'Middle tiles are the most dangerous class there is: they can be caught by two-sided, closed, edge and pair waits alike.' },
                { label: 'The 9s — a terminal', why: 'Terminals are safer than middles as a class, but here 7s is specifically suji while 9s is only generally unlikely. Prefer the specific read.' },
              ],
            },
            {
              turn: 'Turn 12',
              hand: '345m 678m 234p 55p 36s',
              draw: '9m',
              table: 'Riichi from across. All four 5s are visible in the ponds and melds. You hold no genbutsu and no suji.',
              prompt: 'Nothing safe, nothing suji. What does the dead 5s tell you?',
              options: [
                { label: 'The 6s is a no-chance tile — throw it', correct: true, why: 'A 6s can only be caught by a two-sided wait built from 45s or 78s, or by a closed 57s — and every shape needing a 5s is impossible with all four gone. That kills most of the ways 6s deals in. Counting dead tiles like this is what turns a guess into a read.' },
                { label: 'The 3s, because it is further from the middle', why: 'The 3s is caught by 12s, 24s and 45s waits, none of which the dead 5s rules out. "Further from the middle" is a rule of thumb; a specific count beats it.' },
                { label: 'The 9m, because terminals are safe', why: 'Terminals are safer on average, and this one has no supporting evidence at all. When you have an actual count available, use it instead of the average.' },
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
            hand: '234m 678m 44p 789s PP',
            table: 'The player to your left just discarded the third white dragon.',
            text: [
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
            hand: '234m 678m 44p 789s PP',
            table: 'The player to your left just discarded the third white dragon.',
            text: [
              'Here the answer is easy. Pon the dragon and the yaku IS the call: white dragon, one han, guaranteed, and the hand goes from four blocks to tenpai-adjacent in one move.',
              'The calls that are usually right: a yakuhai triplet; a call that brings you straight to tenpai in a hand that has a yaku; tanyao when the hand is already all simples; honitsu, where the value pays for the loss.',
            ],
          },
          ...drills([
            {
              turn: 'Turn 5',
              hand: '234m 678m 44p 789s PP',
              table: 'The third white dragon has just been discarded to your left.',
              prompt: 'Do you call it?',
              options: [
                { label: 'Pon — the dragon is the yaku', correct: true, why: 'One call turns a yakuless four-block hand into a hand with a guaranteed han and four blocks placed. This is the call that is always worth making.' },
                { label: 'Pass — keep the hand closed for riichi', why: 'You are two blocks from tenpai with no dora. The closed route is slower and, without the dragon triplet, not obviously worth more.' },
                { label: 'Pass — you already have a pair for your head', why: 'True and irrelevant: 44p can be your head and the dragons your yaku at the same time. That is precisely why this call is free.' },
              ],
            },
            {
              turn: 'Turn 6',
              hand: '234m 55m 789m 34p 678s',
              table: 'The player to your left discards 2p. Chi would give you 234p and tenpai.',
              prompt: 'A chi that brings tenpai. Your hand has no yaku and no dora. Call?',
              options: [
                { label: 'Pass', correct: true, why: 'Name the yaku after the call: there is not one. All simples? No, you hold 789m. Yakuhai? Nothing. An open hand with no yaku cannot win, so this "tenpai" would be worthless.' },
                { label: 'Chi — tenpai is tenpai', why: 'Tenpai you cannot win from is not tenpai, it is a noten payment with extra steps. This is the single most common melding mistake.' },
                { label: 'Chi and switch to a terminal hand later', why: 'Chanta needs every block to touch a terminal or honour, and your 55m and 678s do not. You cannot get there from here.' },
              ],
            },
            {
              turn: 'Turn 4',
              hand: '234m 567m 44p 345s 78s',
              table: 'A 6s is discarded to your left. Chi gives you 678s and tenpai on the 4p shanpon... and your hand is all simples.',
              prompt: 'Tanyao is live and the call brings tenpai. Call?',
              options: [
                { label: 'Chi — tanyao is your yaku', correct: true, why: 'Every tile in the hand is a simple, so tanyao survives the call and gives you a legal win. Tenpai on turn four with a yaku is worth far more than the closed hand you were two draws away from.' },
                { label: 'Pass and keep it closed for riichi', why: 'Defensible with a good wait and a fast hand — but you are giving up immediate tenpai on turn four. With tanyao intact, the call is the better half of a close call.' },
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
