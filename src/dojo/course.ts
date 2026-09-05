/**
 * Dojo course content.
 *
 * The syllabus follows the chapter and section structure of **Riichi Book I:
 * A Mahjong Strategy Primer for European Players** by Daina Chiba (2016),
 * chapters 3 onward — the tile-efficiency and judgement half of the book.
 * The book is published under CC BY-NC 3.0 and is available free at
 * http://riichi.dynaman.net/ (mirror linked from the credits lesson).
 *
 * The structure is his. The wording, the examples and the drills here are
 * written for this app: the point is a course you can tap through on a phone
 * between hands, not a transcription of a book you should also go and read.
 *
 * Tile notation is the engine's own: "123m" = 1-2-3 man, "0p" = red five pin,
 * and E S W N P F C are the honours (P/F/C = white, green, red dragon).
 */

export type SectionKind = 'p' | 'tiles' | 'callout' | 'list';

export interface LessonSection {
  kind: SectionKind;
  /** Prose, for 'p' and 'callout'. */
  text?: string;
  /** Heading for a callout. */
  title?: string;
  /** Tile notation, for 'tiles'. */
  tiles?: string;
  /** Caption under a tile row. */
  caption?: string;
  /** Bullets, for 'list'. */
  items?: string[];
}

export interface QuizOption {
  /** A single tile in engine notation — the answer is "discard this". */
  tile: string;
  correct?: boolean;
  /** Shown after answering, for every option, right or wrong. */
  why: string;
}

export interface Quiz {
  prompt: string;
  /** The hand to display, usually 14 tiles. */
  hand: string;
  options: QuizOption[];
}

export interface Lesson {
  id: string;
  title: string;
  /** One line shown in the chapter list. */
  summary: string;
  sections: LessonSection[];
  quizzes?: Quiz[];
}

export interface Chapter {
  id: string;
  /** Chapter number in Riichi Book I. */
  book: number;
  title: string;
  kanji: string;
  blurb: string;
  lessons: Lesson[];
}

const p = (text: string): LessonSection => ({ kind: 'p', text });
const tiles = (t: string, caption?: string): LessonSection => ({ kind: 'tiles', tiles: t, caption });
const note = (title: string, text: string): LessonSection => ({ kind: 'callout', title, text });
const list = (...items: string[]): LessonSection => ({ kind: 'list', items });

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
        sections: [
          p('A winning hand is four sets and a pair. A set is three tiles: a run of three consecutive tiles in one suit, or three of the same tile. That is the whole target, and every decision you make in a hand is about getting there faster or more expensively than three other people.'),
          tiles('234m', 'A run — three consecutive tiles in one suit.'),
          tiles('777p', 'A triplet — three of the same tile.'),
          p('Most of the time you are not holding finished sets, you are holding two-tile shapes that are one tile short. These are called partial sets, and which kind you hold matters enormously, because they are not equally good.'),
          tiles('45s', 'A two-sided shape (ryanmen): 3s or 6s finishes it. Eight tiles.'),
          tiles('46s', 'A closed shape (kanchan): only 5s finishes it. Four tiles.'),
          tiles('89s', 'An edge shape (penchan): only 7s finishes it. Four tiles.'),
          tiles('55s', 'A pair (toitsu): another 5s makes it a triplet. Two tiles left.'),
          note(
            'The number that matters',
            'A two-sided shape accepts eight tiles. Every other two-tile shape accepts four or fewer. That single fact drives most of the discards you will ever make: when you must break something, break the shape that accepts less.',
          ),
          p('Anything that is not part of a set or a partial set is a floater — a lone tile doing nothing yet. Floaters are not worthless: a lone 5m can grow into a shape from either side. A lone 1m can only grow one way, and a lone honour can only ever pair up. That is why you shed honours and terminals first and keep middle tiles.'),
        ],
        quizzes: [
          {
            prompt: 'Five blocks are already here. Which tile leaves your hand?',
            hand: '3456m 789m 13p 78p 55s 9s',
            options: [
              { tile: '9s', correct: true, why: 'A lone terminal that connects to nothing. It is doing the least work of any tile here — throw it before you break a real shape.' },
              { tile: '1p', why: 'The 1p-3p closed shape only accepts 2p, so it is the weakest of your partial sets — but it is still a partial set, and you have a spare floater to shed first.' },
              { tile: '5s', why: 'That breaks your only pair. You need a pair for the head of the hand; giving it up for nothing costs you a block.' },
              { tile: '8p', why: 'Never break a two-sided shape while a lone terminal is sitting in your hand doing nothing.' },
            ],
          },
        ],
      },
      {
        id: 'complex',
        title: 'Complex shapes',
        summary: 'Three- and four-tile shapes that are worth more than they look.',
        sections: [
          p('Some shapes are more than the sum of their parts. Learning to see them is what separates a player who counts tiles from a player who reads a hand.'),
          tiles('3456p', 'A run plus a two-sided extension. Accepts 3p and 6p — and whichever comes, you keep a clean run.'),
          tiles('1123m', 'A pair, a run-to-be and an edge shape at once. Accepts 1m, 3m and 4m.'),
          tiles('135p', 'Two closed shapes sharing a tile (ryankan). Accepts 2p and 4p — eight tiles, the same as a two-sided shape.'),
          note(
            'Ryankan is not a bad shape',
            'Players throw 135p away because it "looks like two kanchan". It accepts eight tiles, exactly as many as a ryanmen. Keep it when the alternative is a penchan or a lone kanchan.',
          ),
          tiles('4455p', 'A double pair. It becomes a triplet plus a pair, or with 3p or 6p, a run plus a pair.'),
          p('Three-tile shapes with a pair inside them are the ones people misplay most. When you hold a pair next to a partial set, you usually hold both: the pair is your head, and it costs you nothing to let the neighbours grow.'),
        ],
        quizzes: [
          {
            prompt: 'Three 4p are already in the ponds. Both 1p and 5p give tenpai — which one?',
            hand: '234m 55m 678m 135p 999s',
            options: [
              { tile: '5p', correct: true, why: 'Discarding the 5p leaves 1p-3p waiting on 2p, and all four 2p are live. Discarding 1p would leave 3p-5p waiting on the 4p — and only one of those is left. Same shape, four times the tiles.' },
              { tile: '1p', why: 'Also tenpai, on 4p, which is exactly the tile the ponds have already eaten. This is the trap: the shape looks identical and the wait is a quarter of the size.' },
              { tile: '3p', why: 'The 3p is the shared tile of the ryankan. Remove it and both closed shapes collapse at once — and you are not even tenpai.' },
              { tile: '5m', why: 'Breaking your head leaves the hand with no pair. A step backwards from tenpai.' },
            ],
          },
        ],
      },
      {
        id: 'waits',
        title: 'Waits',
        summary: 'What you are waiting on decides how often you win.',
        sections: [
          p('When your hand is one tile from complete you are tenpai, and the tiles that finish it are your wait. There are five kinds, and their sizes are wildly different.'),
          list(
            'Ryanmen — two-sided, 8 tiles. 45s waits on 3s and 6s.',
            'Kanchan — closed, 4 tiles. 46s waits on 5s.',
            'Penchan — edge, 4 tiles. 12s waits on 3s.',
            'Shanpon — two pairs, 4 tiles. 55s + 77s waits on 5s and 7s.',
            'Tanki — single tile, 4 tiles. Waiting to pair your last tile.',
          ),
          p('Raw counts are only the start. What matters is how many of those tiles are still live: four minus the ones already visible in the discards, in melds and in your own hand. A two-sided wait on tiles that are all in the pond is worse than a closed wait on a fresh tile.'),
          note(
            'Count the pond, not the shape',
            'Before you settle on a wait, look at what has been discarded. A 4-tile wait where all four are live beats an 8-tile wait where six are gone.',
          ),
          p('There is a second reason to prefer two-sided waits: they are the ones other players deal into. A closed wait on the 5 of a suit that everybody is discarding around will sit there all hand. Tanki waits on honours nobody has seen are the exception — those get dealt in early or never.'),
        ],
        quizzes: [
          {
            prompt: 'You just drew the third 5s. Every discard here is tenpai — which wait do you want?',
            hand: '234m 567m 234p 555s 78s',
            options: [
              { tile: '5s', correct: true, why: 'Breaking the triplet back to a pair leaves 78s waiting on 6s and 9s: eight tiles, two-sided. The triplet was worth one extra tile of shape and cost you the good wait.' },
              { tile: '8s', why: 'That leaves four complete sets and a lone 7s — a tanki on 7s, four tiles, and two of those are behind your own back.' },
              { tile: '7s', why: 'A tanki on 8s. Same problem: four tiles where eight were on offer.' },
              { tile: '2p', why: 'Breaking a completed run to reshape a wait. Never.' },
            ],
          },
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
        sections: [
          p('A finished hand is four sets and a pair: five blocks. So the job in the early game is to assemble five blocks and then feed them, and the job of every discard is to answer one question — do I already have five?'),
          p('Count your blocks. Finished sets count. Partial sets count. A lone pair counts. If you have six candidates, one of them is redundant and it should be leaving your hand before anything else does.'),
          tiles('123m 456m 78p 22s 45s 9s', 'Five blocks: two runs, a two-sided shape, a pair, another two-sided shape. The 9s is spare.'),
          note(
            'Why not six blocks?',
            'You can only use five. A sixth block does nothing but slow the other five down, because every tile you spend feeding it is a tile you did not spend on a block you will actually use.',
          ),
          p('The exception is when one of your five is very weak — an edge shape, or a pair of a tile three of which are already visible. Then a sixth candidate is insurance, and you hold it a little longer while you see whether the weak one improves.'),
        ],
        quizzes: [
          {
            prompt: 'Count the blocks, then choose.',
            hand: '234m 88m 345p 12p 456s 3s',
            options: [
              { tile: '3s', correct: true, why: 'Blocks: 234m, 88m, 345p, 12p, 456s — that is five already. The 3s is a sixth candidate you cannot use.' },
              { tile: '1p', why: 'The 12p penchan is your weakest block, but breaking it while an unused floater sits in the hand loses acceptance for nothing.' },
              { tile: '8m', why: 'That is your only pair. Without a head you are not five blocks, you are four and a problem.' },
              { tile: '2m', why: 'Never break a finished run while a floater is available.' },
            ],
          },
        ],
      },
      {
        id: 'weakest-block',
        title: 'Dropping the weakest block',
        summary: 'When you do have to break something, there is an order.',
        sections: [
          p('Sooner or later you draw a better block than one you are holding, and something has to go. The order is almost always the same, worst first:'),
          list(
            'A pair of a tile that is nearly dead — three copies already visible.',
            'Penchan (12 or 89). Four tiles, and the tile it needs is often held back by others.',
            'Kanchan on a terminal-ish rank (13, 79).',
            'Kanchan in the middle (35, 46, 57).',
            'A plain pair, if you already have a better head.',
            'Ryanmen. You almost never break one of these.',
          ),
          p('The exception is value. A pair of dragons is a worse shape than a two-sided run but a better block, because completing it is a guaranteed yaku and a han. Speed is not the only currency.'),
          tiles('PP', 'A dragon pair: two tiles from a yaku, and every opponent will be reluctant to discard the third.'),
          note(
            'Shape versus value',
            'Break the weaker shape when the hand is cheap and fast. Keep the more valuable block when the hand is slow anyway — a slow hand needs to be worth something when it lands.',
          ),
        ],
        quizzes: [
          {
            prompt: 'You have six blocks. Which one goes?',
            hand: '345m 89m 34p FF 456s 12s',
            options: [
              { tile: '1s', correct: true, why: 'You hold two edge shapes, 89m and 12s, plus a dragon pair. One penchan has to go, and 12s is the one whose tile — 3s — is easiest for opponents to hold. Either penchan is defensible; keeping the dragon pair is the part that matters.' },
              { tile: '9m', why: 'Defensible for the same reason as 1s: you are dropping one of two edge shapes. Slightly worse only because the 7m your 89m needs tends to flow earlier than 3s.' },
              { tile: 'F', correct: false, why: 'This is the mistake. Green dragon is two tiles from a guaranteed yaku and the third copy is the one opponents will not discard late. Breaking it makes the hand fast and worthless.' },
              { tile: '4p', why: 'The 34p two-sided shape is the best block in the hand after the dragons. Breaking it to solve a spare-block problem is the worst of the four.' },
            ],
          },
        ],
      },
      {
        id: 'floaters',
        title: 'Choosing which floater to keep',
        summary: 'When you are short of blocks, keep the tiles that can become one.',
        sections: [
          p('The other half of the five-block method is the case where you have four blocks and need a fifth. Now floaters matter, and they are not equal.'),
          list(
            'A middle tile (3 to 7) can grow into a two-sided shape from either side. Best.',
            'A 2 or an 8 can grow into a two-sided shape from one side only.',
            'A 1 or a 9 can only ever make an edge shape or a triplet. Poor.',
            'An honour can only pair. Poor as a shape — but if it is a yakuhai, it carries value the others do not.',
          ),
          tiles('5m', 'Draw 3m, 4m, 6m or 7m and this becomes a real block. Sixteen useful tiles.'),
          tiles('1m', 'Only 2m and 3m help, and they only make an edge or a closed shape. Six useful tiles, all of them poor.'),
          p('This is why the standard early discard order is honours you cannot use, then terminals, then 2s and 8s — you are shedding tiles in order of how likely they are to become the block you are missing.'),
          note(
            'Keep a yakuhai pair anyway',
            'A lone dragon is a poor shape and a fine hold if your hand has no yaku otherwise. One copy costs you almost nothing; the second copy changes what the hand is worth.',
          ),
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
        sections: [
          p('There are yaku you steer towards and yaku you notice you already have. The second kind is where your points come from.'),
          list(
            'Riichi — any closed tenpai hand. Free, and the biggest single source of value in the game.',
            'Pinfu — all runs, a non-value pair, and a two-sided wait. This is just what an efficient closed hand looks like.',
            'Tanyao — no terminals, no honours. If your hand is already middle tiles, it is already tanyao.',
            'Yakuhai — a triplet of dragons, your seat wind or the round wind. One block, one han, and it lets you open the hand.',
          ),
          p('Notice what these have in common: none of them asks you to hold a worse shape. Pinfu happens when you keep two-sided shapes, which you were doing anyway. Tanyao happens when you shed terminals, which you were doing anyway.'),
          note(
            'The rule of thumb',
            'If a yaku costs you nothing, take it. If it costs you one turn, think. If it costs you a block, it had better be worth several han.',
          ),
          p('Sanshoku (the same run in all three suits) and ittsu (1-2-3, 4-5-6, 7-8-9 in one suit) are the classic traps. They are worth one or two han and they very often cost two or three turns of speed. Take them when the hand was already going that way — when you hold two of the three runs and the third is a shape you would keep regardless.'),
        ],
        quizzes: [
          {
            prompt: 'Sanshoku is one tile away. Is it worth the detour?',
            hand: '234m 234p 22s 34s 678s 9s',
            options: [
              { tile: '9s', correct: true, why: 'Keep 34s: it is a two-sided shape that also completes 234 sanshoku if the 2s lands. The yaku costs nothing here — you were keeping that shape anyway. That is the only kind of sanshoku worth chasing.' },
              { tile: '4s', why: 'Throwing the shape that carries both your acceptance and your yaku, to keep a lone 9s. This is the opposite of the right answer.' },
              { tile: '2s', why: 'The 2s pair is your head and the 2s is also the sanshoku tile. Breaking it gives up both.' },
              { tile: '2m', why: 'Breaking a finished run that is part of the sanshoku, for nothing.' },
            ],
          },
        ],
      },
      {
        id: 'big-hands',
        title: 'Honitsu, toitoi and chiitoitsu',
        summary: 'The three hands worth reshaping for — and the tell they give off.',
        sections: [
          p('Some hands are worth committing to. All three of these change how you discard for the rest of the hand, so decide early and read the signs when an opponent does the same.'),
          p('Honitsu — one suit plus honours. Worth two han open, three closed, and often more because the honour triplets stack yakuhai on top. Commit when you hold seven or eight tiles of one suit by the middle of the hand, especially with a yakuhai pair.'),
          tiles('1123p 789p PP FF', 'A committed honitsu: one suit and honours, two dragon pairs to grow.'),
          note(
            'Honitsu is the loudest hand in mahjong',
            'A player discarding nothing but one suit is telling everyone what they hold. That works both ways: read it in other people, and expect to be read when you do it.',
          ),
          p('Toitoi — all triplets. Two han, and it pairs naturally with yakuhai and honours. Commit when you already hold three pairs by turn six or so. The catch is that pairs complete on two tiles instead of eight, so a toitoi hand is slow and needs the value to justify it.'),
          p('Chiitoitsu — seven distinct pairs. Two han, closed only. It looks like a rescue for a hand that will not come together, and sometimes it is, but the wait at the end is a single tile. Take it when you hold five pairs early, not as a consolation at turn twelve.'),
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
        sections: [
          p('When your hand is closed and tenpai, declaring riichi is almost always right. It is worth far more than the one han on the card: riichi, plus the ippatsu you will sometimes catch, plus the ura dora that only riichi hands see, plus the pressure that makes three opponents stop pushing tiles at you.'),
          note(
            'The honest arithmetic',
            'Riichi turns an average closed tenpai hand from roughly a thousand points into roughly five. That is not a small edge you can take or leave — it is most of your income.',
          ),
          p('The common beginner mistake is holding dama ("silent") because the wait feels bad. A bad wait with riichi is usually still better than a bad wait without it, because the value goes up and the opponents fold, which means your bad wait now faces three players who are throwing safe tiles rather than three players building hands.'),
          p('Declare immediately, too. Riichi on the turn you reach tenpai, not two turns later after you have "improved" it. Every turn you wait is a turn of ippatsu and a turn of draws thrown away, and the improvement you are hoping for usually does not come.'),
        ],
        quizzes: [
          {
            prompt: 'Turn six, closed, nobody else has declared. Discarding 1m gives tenpai on a closed wait. Do you riichi?',
            hand: '1m 234m 567m 44p 234s 78s',
            options: [
              { tile: '1m', correct: true, why: 'Yes — declare. A 6s/9s two-sided wait with riichi on turn six is a textbook insta-riichi. Waiting for a "better" hand costs you draws, ippatsu and the fold pressure.' },
              { tile: '4p', why: 'Breaking your head to reshape a hand that is already tenpai. This is the improvement trap.' },
              { tile: '8s', why: 'You would be discarding out of tenpai to keep a pair you do not need.' },
              { tile: '7m', why: 'Breaking a finished run while tenpai. Never.' },
            ],
          },
        ],
      },
      {
        id: 'no-riichi',
        title: 'When not to riichi',
        summary: 'Four situations, and nothing else.',
        sections: [
          p('The exceptions are real but narrow. Learn them as a list, and treat anything not on the list as a riichi.'),
          list(
            'The hand is already big. If you are holding a mangan-class hand dama, riichi adds less than it costs in flexibility — and you keep the option to fold.',
            'You are furiten. You cannot ron your own discards, so riichi locks you into tsumo-only on a wait you have already passed.',
            'There are no draws left. Riichi in the last go-around buys almost nothing and forfeits your ability to drop out.',
            'You are in the lead in the last hand. Riichi commits you to pushing when what you want is for the hand to end quietly.',
          ),
          p('Notice what is not on the list: "the wait is bad", "somebody else riichi\'d first", "I might deal in". Those feel like reasons and they are usually not. A bad wait still wants the value. A second riichi still wants the pressure. And folding a closed tenpai hand because someone else is tenpai first is how you finish an evening with no points and no wins.'),
          note(
            'A test for the exceptions',
            'If your reason for holding dama is about your hand — its size, its furiten, the wall running out — it is probably a real reason. If it is about your nerves, it is not.',
          ),
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
        sections: [
          p('Somebody declares riichi. You have a hand. The question is not "am I scared" — it is whether what you stand to win beats what you stand to lose, and both sides of that are estimable.'),
          list(
            'How close are you? Tenpai is worth pushing with. Two away almost never is.',
            'How much is your hand worth? Dora and a yaku change the answer. A cheap tenpai hand is much closer to a fold than an expensive one.',
            'How dangerous is the tile? A tile that is genuinely safe costs you nothing to push.',
            'How late is it? Near the end, tenpai is worth money by itself through the noten penalty, and there are fewer draws left for them to win on.',
          ),
          note(
            'The short version',
            'Tenpai with value: push. Tenpai and cheap: push safe tiles, fold to dangerous ones. One away and cheap: fold. Two away: fold, and do it early enough that you still have safe tiles left.',
          ),
          p('That last clause is the part people get wrong. Folding is a plan that needs materials. If you wait until turn fourteen to decide, you will be holding nothing but dangerous tiles and you will deal in anyway. Decide by turn eight or nine and keep one or two safe tiles in reserve.'),
        ],
      },
      {
        id: 'safe-tiles',
        title: 'Finding a safe tile',
        summary: 'Genbutsu, suji, one-chance — in that order of certainty.',
        sections: [
          p('Against a riichi, some tiles are provably safe and others are merely likely to be. Take them in order.'),
          p('Genbutsu — a tile they have already discarded. It is completely safe against that player, because you cannot ron a tile you have discarded yourself. Anything in their own pond is free, and so is anything discarded by anyone after their riichi that they did not claim.'),
          tiles('3p', 'If 3p is in their pond, 3p can never deal into them. This is certainty, not a read.'),
          p('Suji — the tile four away from one they discarded. If they have discarded 4p, then 1p and 7p cannot complete a two-sided wait on 4p. It is not safe against a closed wait or a pair wait, but it removes the most common shape.'),
          tiles('4p', 'Their discard.'),
          tiles('1p 7p', 'Suji: safe against a two-sided wait on 4p, not against 1p or 7p as a closed or pair wait.'),
          note(
            'Suji is a probability, not a promise',
            'About four fifths of riichi waits are two-sided. Suji removes those. The remaining fifth is why people still deal in on suji tiles.',
          ),
          p('One-chance and no-chance — if all four copies of 6s are visible, nobody can be waiting on a 4s-5s shape that needs a 6s. Counting the pond like this is what turns a guess into a read, and it is the skill that most separates players at this level.'),
          p('When you truly have nothing safe, throw the tile that is dangerous to the fewest people, and prefer honours: they are the only tiles that can be completely dead rather than merely unlikely.'),
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
        sections: [
          p('Opening your hand costs you riichi, menzen tsumo, pinfu, ippatsu and ura dora — call it two han of expectation, gone the moment you call. So the call has to buy something at least that big.'),
          note(
            'Ask first, call second',
            'What is my yaku after this call? If you cannot name it, do not call. An open hand with no yaku cannot win, and you will spend the rest of the hand discovering that.',
          ),
          p('The calls that are usually right:'),
          list(
            'A yakuhai triplet. This IS your yaku, and it opens the hand for free.',
            'A call that brings you straight to tenpai, when the hand has a yaku.',
            'Tanyao, when your hand is already all middle tiles and the call speeds it up.',
            'Honitsu, where the value is high enough to pay for the loss.',
          ),
          p('The calls that are usually wrong: taking a chi that gains one step in a hand with no yaku; calling pon on a wind that is not yours; opening a hand that was two turns from riichi anyway. Speed is worth something, but not two han and the ability to fold.'),
          p('One more thing calling costs you: your hand becomes readable. Three tiles face up tell the table what suit you want and often what yaku you are building. A closed hand tells them nothing until you riichi, and by then you have chosen the moment.'),
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
        sections: [
          p('This course follows the chapter structure of Riichi Book I: A Mahjong Strategy Primer for European Players, by Daina Chiba (2016) — chapters 3 onward, which is where the book stops explaining websites and starts explaining mahjong.'),
          list(
            'Chapter 3 — Riichi mahjong basics: building blocks, complex forms, waits.',
            'Chapter 4 — The five-block method.',
            'Chapter 5 — Pursuing yaku.',
            'Chapter 7 — Riichi judgement.',
            'Chapter 8 — Defence judgement.',
            'Chapter 9 — Melding judgement.',
          ),
          p('The book is released under a Creative Commons Attribution Non-Commercial licence and is free to download. The explanations and drills in this course are written for this app rather than copied, but the syllabus is his and the book is far more thorough than a phone screen can be. Read it.'),
          note(
            'Not yet covered here',
            'Chapter 6 (scoring) and Chapter 10 (endgame strategy) are not in this course yet. Chapter 6 in particular is worth reading in the book, because knowing what your hand is worth is what makes every judgement above concrete.',
          ),
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
