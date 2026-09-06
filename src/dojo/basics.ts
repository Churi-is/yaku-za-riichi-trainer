/**
 * Dojo BASICS track — the on-ramp.
 *
 * Every lesson in the strategy track assumes you already know the game. This
 * track is for the player who has never played any mahjong at all: what the
 * tiles are, what a turn is, what you are trying to build, and the handful of
 * words the rest of the course uses without explanation.
 *
 * It is deliberately gentle and short on judgement. Efficiency and decisions
 * live in the strategy track; here you only need to recognise things. When a
 * basics lesson touches a strategic idea it names it once and moves on, and
 * the graduation lesson hands you over with the vocabulary in place.
 *
 * Notation is the engine's own, identical to the strategy track: "123m" is
 * 1-2-3 man, "0p" is a red five pin, and E S W N P F C are the honours.
 */
import type { Chapter, Step } from './course';

const drills = (steps: Omit<Step, 'kind'>[]): Step[] =>
  steps.map((s) => ({ ...s, kind: 'drill' as const }));

export const BASICS_CHAPTERS: Chapter[] = [
  // =========================================================================
  {
    id: 'first-day',
    book: 0,
    title: 'Your first day at the table',
    kanji: '初日',
    blurb: 'What the game is, what the tiles are, and what you are trying to build.',
    lessons: [
      {
        id: 'game-flow',
        title: 'A hand you build yourself',
        summary: 'Four players, one wall, and the same small decision every few seconds.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Riichi mahjong is a four-player game played with a wall of 136 tiles. You start each hand with thirteen tiles in front of you, hidden from everyone else, and the hand ends when somebody builds a complete hand and claims it.',
              'Do not worry about doing that yet. First, the rhythm of the game, because almost every moment of mahjong is the same moment.',
            ],
            figures: [
              { tiles: '123m 456m 789p 234s 55p', caption: 'A complete hand: four sets of three and one pair. You are not expected to read this yet — it is where every hand is heading.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Play goes clockwise. On your turn you draw one tile from the wall, look at fourteen tiles, and discard one tile face-up into the pond in front of you. Then the next player draws.',
              'That is the whole loop: draw one, throw one, draw one, throw one. Your discarded tiles stay face-up in your pond for the whole hand, and everyone else’s ponds are face-up in front of them. Mahjong is played almost entirely in those public discards.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'You win by arranging your fourteen tiles into four sets of three plus one pair — exactly like the hand in the first picture — AND by holding a yaku, a named pattern that makes the hand count. A complete hand with no yaku is not a win.',
              'You can win in two ways. Draw the finishing tile yourself and it is tsumo, paid by all three opponents. Or claim the finishing tile the moment somebody discards it, and it is ron, paid entirely by the player who threw it.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'Each of the four seats is named after a wind. The player who deals the hand — the dealer — is East, and going clockwise the other seats are South, West and North. The dealer and the deal rotate around the table from hand to hand.',
              'One wind is also named the round wind, East to begin with. A wind that is either the round wind or your own seat wind is valued: holding three copies of it scores points, as you will see when yaku are explained. A wind that is neither round nor seat is worth nothing and is usually among the first tiles you discard.',
            ],
            note: {
              title: 'Whose wind is which',
              text: 'If you sit South in an East round, then East is the round wind (valuable to everyone), South is your seat wind (valuable to you), and West and North are dead weight in your hand. This is why later drills ask which seat you are.',
            },
          },
          {
            kind: 'teach',
            text: [
              'Most of the time you build your thirteen tiles entirely from your own draws and keep them hidden from the other players. A hand you have built yourself and kept private is called a closed (or concealed) hand.',
              'There is also a way to take a tile an opponent has just discarded, out of turn, to finish one of your sets. Taking a tile like that is called making a call, and it lays that set face-up for everyone to see. A hand that contains a call is called open. Closed hands keep all their options; open hands trade some scoring patterns for speed. Calls are taught properly later in this track.',
            ],
            note: {
              title: 'One word you will keep hearing: riichi',
              text: 'When your CLOSED hand gets to one tile from winning, you may make a declaration called riichi — the move the game is named after. It bets a thousand points that you will finish, boosts the hand’s score, and puts pressure on your opponents. A whole lesson is devoted to it; for now just know that a closed, one-tile-from-winning hand is the moment it appears.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'It is your turn. What actually happens, in order?',
              options: [
                { label: 'Draw one tile from the wall, then discard one tile', correct: true, why: 'That is the whole turn. Every turn for the whole game is: take one from the wall, put one in your pond. Everything you ever decide happens in that one discard.' },
                { label: 'Discard one tile, then draw one from the wall', why: 'Backwards. You draw to fourteen first so that you have a choice of fourteen things to throw; you throw back down to thirteen.' },
                { label: 'Draw one tile and keep it unless someone calls it', why: 'You always discard after drawing — your hand always returns to thirteen tiles between your turns. No one keeps fourteen.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'A finished winning hand is made of what?',
              options: [
                { label: 'Four sets of three tiles, plus one pair', correct: true, why: 'Four sets and a pair: 3 + 3 + 3 + 3 + 2 = fourteen tiles. Every set is either a run of three consecutive numbers in one suit or three of the same tile. The next lesson builds these in detail.' },
                { label: 'Seven pairs of tiles', why: 'That is a real but special hand called chiitoitsu, which you meet later. The ordinary hand every game revolves around is four sets and a pair.' },
                { label: 'Fourteen tiles all from one suit', why: 'A flush is a valuable yaku, not the shape of a winning hand. You still need those tiles arranged into sets and a pair.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'Your hand is four sets and a pair but holds no yaku. Someone discards a tile you could finish on. What happens?',
              options: [
                { label: 'Nothing — you cannot claim it', correct: true, why: 'A complete shape is necessary and not sufficient: a winning hand must also contain a yaku. With no yaku you cannot ron, and the game does not even let you declare a win on a hand that scores nothing.' },
                { label: 'You declare ron and they pay the minimum', why: 'There is no minimum payment for a yakuless hand — it is simply not a legal win. Beginners spend whole hands building a beautiful hand that cannot be declared.' },
                { label: 'You may declare tsumo but not ron', why: 'Tsumo and ron are just the two ways to take the finishing tile; both require a yaku. The shape and the yaku are checked at the same moment.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'the-tiles',
        title: 'The tiles in your hand',
        summary: 'Three numbered suits, seven kinds of honour tile, and the red five.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '234m 567m 234p 78s NN',
            draw: 'E',
            text: [
              'There are two families of tile. The numbered tiles come in three suits — man, pin and sou, written m, p and s after the number — and each suit runs from 1 to 9. You have all three suits in your hand right now.',
              'The honour tiles have no numbers. Four winds: East, South, West, North (E S W N). Three dragons: white, green, red (P F C). These pictures show the full set, one copy of every tile you can draw.',
            ],
            figures: [
              { tiles: '123456789m', caption: 'Man — the characters suit.' },
              { tiles: '123456789p', caption: 'Pin — the circles suit.' },
              { tiles: '123456789s', caption: 'Sou — the bamboo suit.' },
              { tiles: 'E S W N P F C', caption: 'The seven honours: four winds and three dragons.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '234m 567m 234p 78s NN',
            draw: 'E',
            focus: 'E NN',
            text: [
              'Every kind of tile has exactly four copies. When you look at a pond and see two of a tile already discarded, only two copies are left for you.',
              'A little vocabulary the rest of the course uses constantly. The 1s and 9s of each suit are terminals; 2 through 8 are simples; terminals and honours together are often called the outside tiles.',
              'Some tables add one red five per suit — an ordinary five coloured bright red that is worth bonus points when it is in a winning hand. You will meet the bonus system properly later, under dora; for now just recognise that a red five is a valuable tile rather than an error on the printing press.',
            ],
            note: {
              title: 'Honours cannot make runs',
              text: 'A run is three consecutive numbers, so only numbered tiles can make one. An honour can only ever be a triplet — three of the same — or a pair. There is no such set as “East, South, West”.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'Which of these is a terminal?',
              options: [
                { label: '1p', correct: true, why: 'Terminals are the two ends of a suit: the 1 and the 9. 1p is a terminal, and terminals matter because a hand of pure 2-through-8 tiles earns the tanyao yaku you will meet shortly.' },
                { label: '5m', why: 'A 5 is the middle of the suit — a simple. Simples are 2 through 8, and they are the tiles that make the flexible two-sided shapes.' },
                { label: 'East', why: 'The winds are honours, not terminals. “Terminal” always means a numbered 1 or 9; terminals and honours together are called the outside tiles.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'A green dragon tile turns up in a hand. What is it?',
              options: [
                { label: 'One of the three dragons — an honour', correct: true, why: 'The three dragons — white, green and red — are honours, and the single easiest yaku in the game is simply holding three of any one dragon. Dragons are never a wind, a seat, or a number.' },
                { label: 'A wind tile', why: 'The winds are East, South, West and North — the other four honours. The dragons are a separate group of three.' },
                { label: 'A sou tile, because bamboo is green', why: 'The green in a green dragon is a dragon, not bamboo. The sou suit is numbered bamboo; the dragons are pictures, and they do not belong to any suit.' },
              ],
            },
            {
              turn: 'Turn 1',
              hand: '234m 567m 234p 78s NN',
              draw: 'E',
              seatWind: 'south',
              prompt: 'You drew the East wind, but you are South seat in an East round and already have a North pair. You are one tile from winning and this East finishes nothing. What leaves?',
              check: 'efficiency',
              options: [
                { tile: 'E', correct: true, why: 'Three finished runs, a two-sided 78s waiting on 6s or 9s, and the North pair as your head: this hand is already one tile from winning. The East you drew is attached to nothing, and it is neither the round wind nor your seat wind, so it is the dead weight you discard to keep the hand intact.' },
                { tile: '8s', why: 'That breaks the two-sided wait and drops you back to one tile from a winning hand, to keep a wind that does no work. Throw the junk, keep the shape.' },
                { tile: 'N', why: 'Your North pair is the pair every hand needs. Breaking it leaves three runs and a wait with no head — a step backwards.' },
                { tile: '2m', why: 'Breaking a finished run while an honour tile sits detached in your hand. Sets are the hardest thing to rebuild.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'sets-and-pair',
        title: 'Sets and the pair',
        summary: 'The run, the triplet, and the pair everything is built from.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '123m 888p 456p FF 78s',
            draw: '1s',
            focus: '123m 888p 456p',
            text: [
              'A set is three tiles, and there are only two kinds. A run is three consecutive numbers in the same suit — the 123m and 456p lit up here. A triplet is three identical tiles, like the 888p.',
              'Runs must stay inside one suit: 1p, 2p, 3p is a run, but 8p, 9p, 1s is not, because it jumps suit. Honours cannot run at all.',
            ],
            figures: [
              { tiles: '345s', caption: 'A run: three consecutive numbers, one suit.' },
              { tiles: 'CCC', caption: 'A triplet: three copies of one tile. Honours can do this.' },
              { tiles: '99m', caption: 'The pair: two copies. You need exactly one.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '123m 888p 456p FF 78s',
            draw: '1s',
            focus: 'FF',
            text: [
              'On top of the four sets, every ordinary hand needs exactly one pair — the head. The green dragon pair lit here is serving that job, and if the third green dragon turns up it becomes a triplet set with a guaranteed yaku.',
              'A half-finished run has names you will hear constantly. Two consecutive tiles waiting on either end, like 78s, are a two-sided shape. Two tiles with a gap, like 46p, are a closed shape. Two at the very edge, like 89m, are an edge shape.',
            ],
            note: {
              title: 'Count the half-finished shapes',
              text: 'A two-sided 78s accepts eight tiles to complete (any 6s or 9s), while a closed 46p or edge 89m accepts only four. That one fact drives the whole strategy track. Here you only need to recognise the shapes.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'Which of these is NOT a legal set?',
              options: [
                { label: '8p, 9p, 1s', correct: true, why: 'It looks like 8-9 plus something, but a run must be three consecutive numbers in ONE suit. The 1s jumps from pin to sou, so this is three unrelated tiles. This is the mistake to watch when you are reading your hand fast.' },
                { label: '2m, 3m, 4m', why: 'That is a textbook run — three consecutive numbers, all man. Legal, and worth keeping whole.' },
                { label: 'Three white dragons', why: 'Three identical honours make a triplet, which is a set — and here it also carries the dragon yaku. Legal and valuable.' },
              ],
            },
            {
              turn: 'Turn 1',
              hand: '345m 789m 456p 88p 78s',
              draw: '2m',
              prompt: 'You drew the 2m. You already have three finished runs, a pair and a two-sided 78s — one tile from winning. What goes?',
              check: 'efficiency',
              options: [
                { tile: '2m', correct: true, why: 'The 2m touches nothing: 345m is already complete and does not extend. Discarding it leaves three runs, the 88p pair and the 78s wait on 6s or 9s — a clean hand one tile from winning.' },
                { tile: '9m', why: 'That breaks the finished 789m run. The hand is still one tile from a win, but you smashed a complete set to keep a detached 2m — pointless destruction.' },
                { tile: '8p', why: 'That is your only pair, the head. Break it and the hand has three runs, a wait, and nothing to act as the pair — a full step back.' },
                { tile: '8s', why: 'That breaks the two-sided 78s wait. The detached 2m was the spare tile; breaking the shape that finishes the hand is the wrong way around.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'How many sets and pairs does an ordinary winning hand contain?',
              options: [
                { label: 'Four sets and one pair', correct: true, why: '4 × 3 + 2 = 14 tiles. While building, your hand is thirteen tiles — four sets and a pair with one tile still missing, which is exactly what “tenpai” means.' },
                { label: 'Three sets and two pairs', why: 'Two pairs are not two sets worth of progress — a pair needs a third copy to become a triplet, and an ordinary hand only has one head.' },
                { label: 'Four sets, and the pair is optional', why: 'The pair is mandatory. Four triplets or runs alone is twelve tiles; without the head there is no complete hand.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'tenpai-and-waits',
        title: 'One tile away: tenpai and waits',
        summary: 'The word for almost-winning, and the shapes you are waiting on.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '234m 567m 123p 44p 78s',
            focus: '78s',
            text: [
              'When your hand is complete except for one tile, you are tenpai — the state that lets you declare riichi and wait for the finish. Two tiles from complete is one-shanten, three tiles is two-shanten, and so on. Fewer is better.',
              'The tiles that finish you are your wait. There are a handful of shapes, and they are very different in size, as the pictures show.',
            ],
            figures: [
              { tiles: '78s', caption: 'Two-sided (ryanmen): waits on 6s and 9s — eight tiles in the wall.' },
              { tiles: '46p', caption: 'Closed (kanchan): waits on 5p only — four tiles.' },
              { tiles: '12m', caption: 'Edge (penchan): waits on 3m only — four tiles.' },
              { tiles: '55s', caption: 'Pair wait (shanpon): waits on a third copy of each of two pairs.' },
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 1',
            hand: '234m 567m 123p 44p 78s',
            text: [
              'A two-sided wait is the best ordinary wait in the game, accepting eight tiles. The closed and edge waits accept four. There is also the single-tile wait, tanki, when you hold thirteen tiles of sets and need any matching tile to make your pair — only three copies left.',
              'The strategy track spends a whole lesson choosing between waits. For now, remember the shape names and that bigger waits win more often.',
            ],
            note: {
              title: 'Count what is actually left',
              text: 'Those tile counts assume all four copies are live. If two 6s are already sitting in ponds, your “eight-tile” wait is really six. Reading the ponds is half the game — the strategy track drills it.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'Which wait accepts the most tiles?',
              options: [
                { label: 'A two-sided wait like 78s', correct: true, why: 'It accepts the tile on either end — 6s and 9s — four copies each, eight tiles live before the ponds are counted. Nothing else ordinary waits come close, which is why efficient play constantly steers toward two-sided shapes.' },
                { label: 'A closed wait like 46p', why: 'Only the 5p fills the gap: four copies, half of a two-sided wait. Better than nothing, worse than ryanmen.' },
                { label: 'An edge wait like 12m', why: 'Only the 3m extends it, because the 0m does not exist. Four copies, and a tile people tend to hold — the weakest of the run waits.' },
              ],
            },
            {
              turn: 'Turn 1',
              hand: '234m 567m 123p 44p 78s',
              draw: 'W',
              seatWind: 'east',
              prompt: 'You drew West as the East seat in an East round, and 78s is already a two-sided wait. What leaves?',
              check: 'efficiency',
              options: [
                { tile: 'W', correct: true, why: 'The hand is tenpai: three runs, the 44p pair, and 78s waiting on 6s or 9s. West is a wind nobody at the table values and it attaches to nothing, so it goes without costing the hand a thing.' },
                { tile: '4p', why: 'Breaking the pair removes the head. Now you have three runs, a wait, and no pair — one step further from winning.' },
                { tile: '8s', why: 'Breaking the 78s wait turns eight finishing tiles into none on that shape. The honour tile was the spare, not the wait.' },
                { tile: '7s', why: 'Same mistake at the other end: you keep a dead wind and smash the very shape the hand is waiting on.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'A friend says their hand is “tenpai”. What do they mean?',
              options: [
                { label: 'They are exactly one tile from a complete hand', correct: true, why: 'Tenpai means complete-but-one: four sets and a pair with the final tile outstanding. It is the state that lets you declare riichi, and the state your opponents fear because any discard from here could be their win.' },
                { label: 'They have won the hand', why: 'Winning is agari or tsumo/ron. Tenpai is the step before — you are waiting, not finished.' },
                { label: 'They have ten pairs', why: 'There are only four copies of any tile, and an ordinary hand never holds more than one pair. Tenpai is a Japanese word for “ready”, unrelated to the number ten.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'name-your-hand',
    book: 0,
    title: 'Naming your hand: yaku',
    kanji: '役',
    blurb: 'The patterns that make a hand count, from the everyday ones to the ones worth seeing.',
    lessons: [
      {
        id: 'everyday-yaku',
        title: 'The four yaku you will see every game',
        summary: 'Riichi, all-simples, value tiles and pinfu — the ones that come to you.',
        steps: [
          {
            kind: 'teach',
            text: [
              'A yaku is a named pattern worth points, and every winning hand needs at least one. You do not have to memorise a list of rare ones — almost all everyday hands win on a small set of easy yaku that tend to appear while you build normally.',
              'Riichi you have met: declare it on any closed tenpai hand for one han, plus the chance of bonus tiles. Han are the units yaku are counted in; more han means a much bigger score.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'Tanyao is a hand containing no terminals and no honours — only the 2-through-8 simples. It earns one han, closed or open, and tends to appear by itself when you build with the flexible middle tiles.',
              'Yakuhai is a triplet of any dragon, of the round wind, or of your own seat wind — one han for one triplet, open or closed. A dragon pair in your hand is often worth keeping for just this reason. Pinfu is one han for a closed hand of all runs, a plain pair, and a two-sided wait: the shape an efficient hand has anyway.',
            ],
            note: {
              title: 'Yaku stack',
              text: 'A hand can hold several yaku at once and adds their han. Riichi with tanyao with a dragon triplet is three han before bonuses — which is why a fast, clean, closed hand is the bread and butter of winning play.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'Which of these hands already has a guaranteed yaku, no matter how it finishes?',
              options: [
                { label: 'Four sets and a pair that include a completed dragon triplet', correct: true, why: 'Three dragons is yakuhai — a guaranteed one han whether the hand is open or closed. You literally cannot forget to include it; as soon as the third dragon lands, the hand has a yaku.' },
                { label: 'A closed hand one tile from winning', why: 'A closed tenpai hand can declare riichi, but it only has the yaku once you actually declare. Until then it has no yaku and cannot win.' },
                { label: 'A hand containing several red fives', why: 'Red fives and the other bonus tiles you will meet under “dora” add points to a hand that already has a yaku, but they are not a yaku themselves. A hand full of bonus tiles and no actual yaku cannot be declared — a painful trap.' },
              ],
            },
            {
              turn: 'Turn 1',
              hand: '234m 567m 345p 34s 55s',
              draw: '1s',
              prompt: 'Every tile in this hand is a simple, and it is one tile from winning on a two-sided wait. You drew a 1s. What goes?',
              check: 'efficiency',
              options: [
                { tile: '1s', correct: true, why: 'Discarding the 1s keeps the whole hand simples, keeps it tenpai on 2s/5s, and secures tanyao — the all-simples yaku — for free. The drawn terminal was the one tile in the hand that could break it.' },
                { tile: '4s', why: 'Breaking the two-sided 34s wait drops the hand out of tenpai, and you keep the terminal that ruins tanyao anyway. Lose on both ends.' },
                { tile: '5s', why: 'That breaks the 55s pair — your head. The hand needs a pair, and this was the only one.' },
                { tile: '4p', why: 'That breaks the finished 345p run. A complete set is worth more than a drawn terminal that should never have stayed.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'Your closed hand finishes on a two-sided wait, every set is a run, the pair is a plain simple tile, and there are no terminals or honours anywhere. Which yaku do you certainly have?',
              options: [
                { label: 'Both pinfu and tanyao', correct: true, why: 'All runs, a plain pair, a two-sided wait and closed is pinfu; no terminals or honours is tanyao. Two yaku for the price of just building the hand the natural way — and declaring riichi on top makes three.' },
                { label: 'Only yakuhai, from the pair', why: 'Yakuhai needs a triplet of a dragon or a valued wind, and a plain simple pair is neither. No yakuhai here at all.' },
                { label: 'None without an explicit declaration', why: 'Pinfu and tanyao are detected from the hand itself; you do not declare them. Riichi is the yaku that requires a declaration.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'hands-worth-knowing',
        title: 'Five more hands worth recognising',
        summary: 'The shapes that change how a hand is built — and how it reads at the table.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Beyond the everyday four, a handful of yaku are common enough that you should recognise them when they appear — in your hand or, just as importantly, in an opponent’s discards.',
              'Seven pairs (chiitoitsu) is seven distinct pairs, closed only. All triplets (toitoi) is four triplets and a pair. A half-flush (honitsu) is one suit plus honours; a full flush (chinitsu) is one suit and nothing else.',
            ],
            figures: [
              { tiles: '11m 33m 55p 77p 99p 22s FF', caption: 'Seven pairs: every tile paired, nothing triplet — a legal hand of fourteen.' },
              { tiles: 'EEE 555m PPP 999p 22s', caption: 'All triplets: four triplets and a pair — and the honours stack yaku on top.' },
              { tiles: '222m 789m 345m EEE FF', caption: 'Half-flush: only man tiles and honours. Nothing pin or sou at all.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Two more you will see. Three-colour runs (sanshoku) is the same number run in all three suits — 234m, 234p, 234s. All-outside (chanta) is a hand where every set and the pair touch a terminal or an honour.',
              'You do not need to chase any of these yet. The strategy track covers when a hand is worth bending for one. What matters now is reading the tell: a player discarding nothing but one suit is building a flush, and a player collecting pairs early may be going for triplets.',
            ],
            note: {
              title: 'Recognition before decisions',
              text: 'The point of this lesson is pattern recognition, not judgement. When the strategy track says “commit to the half-flush”, you will need to know what a half-flush looks like — that is all this page installs.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'Your hand is 11m 33m 55p 77p 99p 22s 66s — seven different pairs, no runs. What is this?',
              options: [
                { label: 'Seven pairs (chiitoitsu) — a legal special hand', correct: true, why: 'Fourteen tiles in seven distinct pairs is its own yaku, worth two han, and it can only be won closed. It is the one ordinary-looking hand that does not follow the four-sets-and-a-pair rule.' },
                { label: 'Seven pairs, worth nothing unless opened', why: 'The opposite: seven pairs cannot be opened at all — a call breaks the pattern. It must stay concealed to be declared.' },
                { label: 'Not a legal hand — hands need sets', why: 'It is legal by explicit exception. Four-sets-and-a-pair is the normal form, but seven pairs is the well-known alternative.' },
              ],
            },
            {
              turn: 'Turn 7',
              rivers: { 0: 'E 4p 7p 2p 5p 8p', 1: 'S W N 3p 6p 9p', 2: 'F C N 3p 6p 4p', 3: 'P C F 2p 5p 8p' },
              table: 'The player across from you has discarded mostly pin and honour tiles.',
              prompt: 'Across the table, a player’s pond contains almost no man tiles — they have kept every man they drew and are calling pin triplets. What are they building?',
              options: [
                { label: 'A half-flush on man tiles', correct: true, why: 'Tiles a player discards are tiles they cannot use. A river full of pin and sou alongside a kept suit says the kept suit plus honours — a half-flush, the loudest tell in riichi. Your man tiles are dangerous against them; the tiles they throw are safe.' },
                { label: 'Tanyao — an all-simples speed hand', why: 'They are keeping a whole suit including its terminals and calling triplets of honours — tanyao forbids both terminals and honours. The pattern points to a flush, not a fast simple hand.' },
                { label: 'Nothing readable yet', why: 'Six turns of one-suit discards plus honour calls is unambiguous. Waiting to be hit is how beginners pay for a big hand they were warned about twice.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'A hand of four triplets and one pair — three Easts, three 5m, three whites, three 9p, and a 2s pair — wins on what yaku?',
              options: [
                { label: 'All triplets (toitoi), with the dragons and winds stacking on top', correct: true, why: 'Four triplets and a pair is toitoi for two han, and every honour triplet — the Easts and the whites — adds its own yakuhai han. This is exactly how toitoi hands quietly become big.' },
                { label: 'Tanyao, because triplets are efficient', why: 'The hand is full of honours and a 9p terminal, so tanyao fails outright. Toitoi is the shape yaku; yakuhai is the value.' },
                { label: 'Nothing — triplets do not form sets', why: 'A triplet is one of the two legal kinds of set. Four of them plus a pair is fourteen tiles and a textbook winning form.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'sitting-down',
    book: 0,
    title: 'Sitting down to play',
    kanji: '実戦',
    blurb: 'Riichi, calling, dora and points, and the one safety rule that stops the bleeding.',
    lessons: [
      {
        id: 'calling-tiles',
        title: 'Calling tiles: chi, pon and kan',
        summary: 'Taking a discard out of turn to finish a set — and why it is not free.',
        steps: [
          {
            kind: 'teach',
            text: [
              'When an opponent discards a tile you can use, you may call it out of turn and lay the finished meld face-up beside your hand. Three calls exist.',
              'Chi takes a tile from the player immediately to your left and only to complete a run. Pon takes a tile from anyone at the table to complete a triplet with your pair. Kan takes the fourth copy of a tile you already have three of. After any call your hand is open and displayed melds stay exposed.',
            ],
            note: {
              title: 'Chi is one-directional',
              text: 'You can only chi the player to your left, because turn order means the tile otherwise never comes to you. Pon beats chi in priority — if two players can claim a discard, the triplet call wins.',
            },
          },
          {
            kind: 'teach',
            text: [
              'Opening your hand is a trade. You finish sets faster and reach tenpai sooner, but you lose riichi and the closed-hand yaku that go with it, and your melds tell the table what you are building.',
              'The golden rule before every call: know your yaku. An open hand still needs a yaku to win, so call only when you can name what the hand will score on — a dragon triplet, tanyao on an all-simples hand, a flush. If you cannot name it, do not call.',
            ],
            note: {
              title: 'Speed costs value',
              text: 'The strategy track has a whole chapter on when a call is worth it. The short version the beginner needs: a yakuhai triplet or a call that brings you straight to tenpai with tanyao already in the hand is almost always right; a call on a hand with no yaku is always wrong.',
            },
          },
          ...drills([
            {
              turn: 'Turn 4',
              prompt: 'The player across from you discards a 3p that would complete your 12p into a 123p run. Can you chi it?',
              options: [
                { label: 'No — you can only chi the player on your left', correct: true, why: 'Chi is a turn-order shortcut: you may only steal the discard of the player directly before you, to your left. The player across is neither before nor after you in the turn sequence you need for a run call. Their tile could only be pounced on by pon or kan.' },
                { label: 'Yes — any discard that completes a run can be chi-ed', why: 'Only the left player’s. The other players’ discards are yours to pon or kan — the triplet calls — but never to chi.' },
                { label: 'Yes, but only if you are the dealer', why: 'Being the dealer — the East seat — never changes call direction. Chi is decided purely by turn order: only the player to your left can be chi-ed, regardless of seat or round.' },
              ],
            },
            {
              turn: 'Turn 5',
              prompt: 'You hold two white dragons. Any opponent discards a third. What call is available?',
              options: [
                { label: 'Pon — take it from whoever discarded it', correct: true, why: 'A pair plus a matching discard is a pon, and unlike chi it can come from any seat. Pon the dragon and you have an exposed triplet carrying a guaranteed yakuhai han — the single safest call a beginner can make.' },
                { label: 'Chi, but only if the left player threw it', why: 'Chi completes a run, and honours cannot form runs. Three white dragons is a triplet, so it is always a pon and never a chi.' },
                { label: 'No call — you must wait to draw it yourself', why: 'A triplet is exactly what pon exists for. Calling it is legal from any seat, and it comes with a yaku.' },
              ],
            },
            {
              turn: 'Turn 4',
              prompt: 'You could call a discard to complete a run, but afterwards your exposed hand would contain no dragon, no valued wind, terminals mixed in, and no other pattern. What is the call?',
              options: [
                { label: 'A bad call — an open hand with no yaku cannot win', correct: true, why: 'Opening costs riichi and the closed-only yaku; if nothing remains, you are paying speed to build a hand that cannot be declared. The golden rule says name your yaku first. With none named, pass and stay closed.' },
                { label: 'A good call — tenpai is tenpai', why: 'Tenpai you cannot legally win is worse than not tenpai: you have given away your closed-hand options for a finish that scores zero. This is the most common beginner calling mistake.' },
                { label: 'A good call, because calling always reaches tenpai faster', why: 'Speed without a yaku just reaches a dead end sooner. The call has to buy at least as much as the closed hand it replaces, and “faster” alone does not.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'dora-and-scoring',
        title: 'Dora and what a hand is worth',
        summary: 'Bonus tiles, the han ladder, and where the points actually come from.',
        steps: [
          {
            kind: 'teach',
            focusCentre: true,
            text: [
              'In the dead wall at the table’s centre sits one face-up tile: the dora indicator. The tile immediately after it — the next number up, wrapping 9 back to 1, and the next wind or dragon in order — is a dora, worth an extra han each if held in the winning hand.',
              'Indicator 4m means 5m is dora; indicator 1p means 2p; indicator 9s means 1s. A red five in your hand counts as a dora too. Dora are pure bonus: they only count alongside a yaku, never as one.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'Every winning hand’s pay is driven by its han count — the total of its yaku plus dora — and it rises steeply: more han means much more than proportionally more points. Most everyday wins land between one and five han; big hands hit named plateaus such as mangan.',
              'On a self-draw (tsumo) all three opponents pay; on a discard win (ron) the one who threw the finishing tile pays the whole amount. Noten — failing to be at least tenpai when the hand runs out — means sharing a small penalty, which is why even a cheap tenpai at the end is worth holding.',
            ],
            note: {
              title: 'Scoring detail lives in the book',
              text: 'Exact point arithmetic — fu and the payment table — is the one chapter this course does not drill; the linked Riichi Book I covers it. You can play perfectly well knowing that more yaku and dora means far more points and that a yaku is mandatory.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'The face-up dora indicator is the 4m. Which tile is worth a bonus han?',
              options: [
                { label: 'The 5m', correct: true, why: 'Dora is the next tile after the indicator: 4m points at 5m, and every 5m in the winning hand adds a han. The indicator itself is not the dora — this catches beginners constantly.' },
                { label: 'The 4m', why: 'The indicator only points; it is the tile one rank after it that is dora. An indicator 4m means you want fives in your hand, not fours.' },
                { label: 'The 3m', why: 'That would be the tile before the indicator. The dora ladder counts forward, never back.' },
              ],
            },
            {
              turn: 'Turn 9',
              prompt: 'You complete a hand holding three dora tiles — but no yaku at all. What is it worth?',
              options: [
                { label: 'Nothing — it cannot even be declared a win', correct: true, why: 'Dora add han to a hand that already wins on a yaku; they are not a yaku themselves. Three dora with no yaku is a legal-shaped hand that scores zero and cannot be declared, which is why keeping at least one route to a yaku matters all game.' },
                { label: 'Three han for the dora', why: 'Only after a yaku exists. No yaku means the hand is not legally won, so its bonus tiles never get counted.' },
                { label: 'One reduced han, since it is open', why: 'There is no consolation prize. Winning requires a pattern; dora are a multiplier on a win, never the base requirement.' },
              ],
            },
            {
              turn: 'Turn 12',
              prompt: 'Someone discards the exact tile you have been waiting on and you declare the win. Who pays you?',
              options: [
                { label: 'Only the player who discarded the finishing tile', correct: true, why: 'That is ron: a win on a discard is paid in full by the player who threw it, which is why learning to throw safe tiles when someone declares riichi matters so much. A win on your own draw — tsumo — is split between all three opponents instead.' },
                { label: 'All three opponents, split equally', why: 'That is tsumo, a self-draw win. A ron win concentrates the entire payment on the one player whose discard fed the hand.' },
                { label: 'The player whose tile it is and the round wind holder', why: 'There is no special extra debtor. Either one player pays on a discard or all three pay on a self-draw; nothing in between.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'declaring-riichi',
        title: 'Riichi: the declaration that defines the game',
        summary: 'When you can declare it, what it costs, and why you almost always should.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Riichi is the move the game is named after. If your hand is tenpai and completely closed — you have called no tiles — you may declare it by placing a thousand-point stick on the table and discarding your tile sideways.',
              'It buys a lot: an automatic han, an extra bonus draw chance on the very next turn, and hidden bonus dora that only a riichi winner gets to reveal. It also tells the table you are one tile from winning, which itself makes opponents stop discarding freely.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'The price is that you lock your hand. After declaring, you cannot change it — every tile you draw must simply be discarded unless it is the winning tile — and folding is no longer possible. Staying silent is called dama.',
              'The beginner rule is simple: closed and tenpai means declare. The handful of genuine exceptions — a hand already at its value ceiling, or no draws left — are judgement calls the strategy track drills. For now, declaring is the default.',
            ],
            note: {
              title: 'Even a poor wait declares',
              text: 'Beginners stay silent because their wait feels bad. The math disagrees: riichi roughly multiplies the hand’s value and pressures all three opponents, and a wait that wins less often is still worth far more when it lands. The strategy chapter proves it.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              prompt: 'What must be true of your hand to declare riichi?',
              options: [
                { label: 'You are tenpai and your hand is completely closed', correct: true, why: 'Tenpai (one tile from winning) and concealed (no calls this hand) are the two requirements, full stop. You do not need a good wait, a dora, or a big hand — closed and ready is enough.' },
                { label: 'You are tenpai, open or closed', why: 'Calling opens your hand and riichi belongs to closed hands only. An open tenpai hand can still win on a yaku such as tanyao or yakuhai, but it cannot declare riichi.' },
                { label: 'You hold at least one yaku already', why: 'Riichi is itself the yaku. A closed hand with no other pattern but riichi is perfectly legal — that is the most common declaration there is.' },
              ],
            },
            {
              turn: 'Turn 6',
              prompt: 'You declare riichi and the very next tile you draw is a spare tile that would reshape your hand. What may you do?',
              options: [
                { label: 'Discard it — after riichi your hand is fixed', correct: true, why: 'Riichi locks the hand: every non-winning draw goes straight to the pond, sideways, until you win or draw the hand. That inability to adapt is exactly what the thousand-point stick and the bonuses pay you for.' },
                { label: 'Keep it and discard something better', why: 'Not allowed once declared. Changing your hand after riichi invalidates the declaration and is treated as a mistake at the table.' },
                { label: 'Withdraw the riichi and keep building', why: 'Riichi cannot be cancelled — the stick is spent, the declaration stands, and the side-ways tile in your pond tells the whole table so.' },
              ],
            },
            {
              turn: 'Turn 6',
              prompt: 'Why is declaring riichi on a closed tenpai hand usually right, even with a small wait?',
              options: [
                { label: 'It adds a han, bonus chances, and makes opponents play safely', correct: true, why: 'The han multiplies the score, the next-turn and hidden-dora bonuses add free chances, and opponents under riichi pressure discard proven-safe tiles — which sometimes hands you exactly your wait. Silent tenpai gives away most of that.' },
                { label: 'It guarantees you will win the hand', why: 'Nothing guarantees a win. Riichi raises the value and applies pressure; it does not change which tiles the wall holds.' },
                { label: 'It refunds your stick if anyone else wins', why: 'The thousand-point stick stays in the pool until someone wins a hand, and it goes to that winner. You are betting it, not depositing it for later.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'furiten-and-safety',
        title: 'Furiten and the first rule of safety',
        summary: 'When your own pond stops you winning — and the tile you can always throw.',
        steps: [
          {
            kind: 'teach',
            turn: 'Turn 10',
            hand: '234m 567m 234p 55s 78s',
            rivers: { 0: '6s 1m 9m 1p 5p 6p 7p 8p 9p', 1: '1p 5p 6p 7p 8p 9p 1s 2s 3s', 2: '7p 8p 9p 1s 2s 3s 4s 5s E', 3: '2s 3s 4s 5s E S W N P' },
            focusPond: '6s',
            cardAt: 'top',
            text: [
              'Say you are waiting on 6s and 9s — and earlier in the hand you discarded a 6s yourself, the tile lit in your own pond. You are now furiten: you may not win on anybody else’s discard, because a tile you are waiting on has already passed through your own hand.',
              'Furiten prevents dumping a dangerous wait and then claiming it. You can still win on your own draw, and furiten lifts once your wait changes. But while it stands, ron is forbidden — a major reason to watch which of your waits you have already thrown.',
            ],
          },
          {
            kind: 'teach',
            turn: 'Turn 10',
            hand: '234m 567m 234p 55s 78s',
            rivers: { 0: '6s 1m 9m 1p 5p 6p 7p 8p 9p', 1: '1p 5p 6p 7p 8p 9p 1s 2s 3s', 2: 'E 7p 8p 9p 1s 2s 3s 4s 5s', 3: '3s 4s 5s S W N P F C' },
            riichi: [2],
            focusPond: 'E',
            cardAt: 'bottom',
            table: 'The player across from you has declared riichi — their last discard, the East, lies sideways in their pond.',
            text: [
              'The same ponds that hold your own furiten also protect you. The player across has declared riichi, and the safest tile in the game against them is one already sitting in their own pond — the lit East: they have proven they do not need it. Tiles a riichi player has discarded are called genbutsu and can never deal into their hand.',
              'Beyond that, the ponds give weaker safety reads — tiles a few ranks away from their discards, or tiles all four copies of which are gone. The strategy track’s defence chapter turns those into a system; this lesson is only the first lever.',
            ],
            note: {
              title: 'When someone declares, decide fast',
              text: 'A riichi means a live threat. The beginner rule: if your own hand is far from ready, stop building and start discarding tiles from their pond. Fold early while safe tiles still reach your hand — waiting leaves you holding nothing but danger.',
            },
          },
          ...drills([
            {
              turn: 'Turn 10',
              prompt: 'You are waiting on 6s and 9s, then you notice you discarded a 6s earlier yourself. What does that mean?',
              options: [
                { label: 'You are furiten: you cannot win on anyone else’s discard', correct: true, why: 'A wait whose tile you have previously discarded cannot be claimed by ron — the game will not let you win a hand on a tile you already refused once. You can still finish on your own draw, and you should avoid declaring riichi into permanent furiten carelessly.' },
                { label: 'Nothing — discards do not affect your wait', why: 'They absolutely do: your pond is public record, and a matching wait turns ron off. This is the furiten rule that turns up constantly at high level.' },
                { label: 'Your hand is instantly disqualified from winning', why: 'You are not disqualified. Self-draw still wins, and once your wait changes the furiten clears. It blocks ron, not the hand itself.' },
              ],
            },
            {
              turn: 'Turn 11',
              prompt: 'While you are furiten, in which way can you still legitimately win the hand?',
              options: [
                { label: 'By drawing the finishing tile yourself (tsumo)', correct: true, why: 'Furiten only forbids claiming another player’s discard. Drawing into your own wait is your own tile, and tsumo still scores. This is also why declaring riichi while furiten is playable but risky: you can no longer fold and may only self-draw.' },
                { label: 'By claiming the finishing tile from any player as usual', why: 'That ron is exactly what furiten blocks. The rule exists so players cannot wait on a tile after already throwing it away.' },
                { label: 'By calling chi or pon to change the hand', why: 'If you are tenpai and waiting, calls are not available on your wait, and opening would not clear the furiten on a tenpai hand. Only a drawn win or a genuinely changed wait helps.' },
              ],
            },
            {
              turn: 'Turn 12',
              prompt: 'A player across the table declares riichi and you have decided not to contest the hand. You hold a tile that is already in their pond. What is it?',
              options: [
                { label: 'The safest possible discard — it can never win their hand', correct: true, why: 'A tile they discarded themselves cannot complete their wait; players never wait on their own discards. Such proven-safe tiles are called genbutsu, and a fold that discards from the riichi player’s pond cannot deal into them. Always check their pond before anything else.' },
                { label: 'Dangerous — discards show what they are collecting', why: 'The reverse: a pond shows what they have refused, not what they collect. The tiles they hold are the ones that never appeared.' },
                { label: 'Irrelevant — only your own pond matters for safety', why: 'Your own pond governs your furiten; their pond governs what you can safely throw at them. For folding, their pond is exactly the place to look.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'graduation',
        title: 'Ready for the strategy dojo',
        summary: 'Everything you now know, and what the next track does with it.',
        steps: [
          {
            kind: 'teach',
            text: [
              'You now have the full vocabulary: draw and discard; runs, triplets and the pair; tenpai and the waits; the everyday yaku and the worth-recognising shapes; riichi, calling and dora; and furiten and the one safe tile.',
              'Everything so far has been about recognition. The strategy track changes the question: not “what is this?”, but “what should I do?”. It assumes all of the above and never re-teaches it.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'The first strategy lessons are the method behind the early discards: counting the five blocks your hand is built from, keeping the shapes that accept eight tiles, and letting go of the ones that accept four.',
              'From there it moves to pursuing yaku on purpose, the judgement of when to declare riichi, when to push a hand through danger and when to fold, and when a call is worth the price. Every lesson is three guided screens and three drills on positions you could have dealt yourself.',
            ],
            note: {
              title: 'Or go straight to a match',
              text: 'You already know enough to sit down against the AI and stumble through — that is how the vocabulary sticks. The dojo is not a gate; the table in the Play a Match screen uses exactly these rules, with coach-free decisions end to end.',
            },
          },
          ...drills([
            {
              turn: 'Turn 1',
              hand: '234m 567m 234p 22s 78s',
              draw: '9p',
              prompt: 'Last turn: three runs, a pair and a two-sided wait — one tile from winning, and the 9p you drew touches nothing. What leaves?',
              check: 'efficiency',
              options: [
                { tile: '9p', correct: true, why: 'The detached terminal attaches to nothing — 9p cannot extend a complete hand that already has three runs — and discarding it leaves the closed tenpai wait on 6s/9s, ready to declare riichi. This is the exact situation the strategy track opens on: a clean hand begging for the standard discard.' },
                { tile: '8s', why: 'Breaking the two-sided wait hands away eight finishing tiles to protect a stray terminal. The spare tile was the 9p, not the shape.' },
                { tile: '2s', why: 'That is the pair, the head. Break it and three runs and a wait remain with no head — a step away from winning.' },
                { tile: '4p', why: 'Breaking the finished 234p run. Completed sets are the last thing a tenpai hand should ever throw.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'The strategy dojo opens by teaching you to answer which core question?',
              options: [
                { label: 'Which tiles form your blocks, and which of them is weakest', correct: true, why: 'The five-block method is the engine room of early play: a hand is four sets and a pair, so five blocks, and most discards are about keeping five strong blocks and shedding what does not earn its place. From there the course adds value, riichi, calls and defence.' },
                { label: 'The exact point value of every possible yaku table', why: 'Point arithmetic is reference material, not strategy. The course teaches judgement from the shapes and the ponds; the scoring table lives in the linked book.' },
                { label: 'How to force rare seven-figure special hands', why: 'Special hands are rare and chasing them is usually a trap the course teaches you to avoid. Everyday value from efficient, riichi-ready hands is where the points are.' },
              ],
            },
            {
              turn: 'Turn 1',
              prompt: 'You finish the basics. What is the best next move?',
              options: [
                { label: 'Either open the strategy dojo or play a match — both reinforce it', correct: true, why: 'The strategy track turns recognition into decisions lesson by lesson, while a match forces you through whole hands with the same vocabulary. Neither requires the other first; doing them in alternation is ideal.' },
                { label: 'Memorise the full yaku list before playing again', why: 'You have already met the yaku that decide nearly every hand. The rare ones will arrive as curiosity later; drilling a table is not how this game is learned.' },
                { label: 'Avoid matches until the whole dojo is perfect', why: 'The dojo is a training room, not an exam — the AI table exists to lose to while the vocabulary settles. Time at the table is part of the course.' },
              ],
            },
          ]),
        ],
      },
    ],
  },
];
