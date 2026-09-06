/**
 * Dojo YAKU CODEX track — the reference catalogue.
 *
 * The basics track introduces the handful of yaku you see every game; the
 * strategy track teaches when to chase them. This track names every yaku the
 * engine recognises, one lesson per pattern (family), so you can look a hand
 * up and recognise it at the table.
 *
 * The drills are recognition, not judgement: here is a complete winning hand,
 * which pattern does it score? Each lesson is two short teach screens then
 * three drills. The figures are complete, legal winning hands written in the
 * engine's own tile notation — "123m" is 1-2-3 man, E S W N P F C are the
 * winds and dragons — so what you see is a hand you could actually declare.
 *
 * Han values are printed as closed / open where they differ.
 */
import type { Chapter, Step } from './course';

const drills = (steps: Omit<Step, 'kind'>[]): Step[] =>
  steps.map((s) => ({ ...s, kind: 'drill' as const }));

export const YAKU_CODEX_CHAPTERS: Chapter[] = [
  // =========================================================================
  {
    id: 'yaku-luck',
    book: 0,
    title: 'Context yaku and the one-han luck yaku',
    kanji: '偶然',
    blurb: 'Yaku decided by how or when you win, not how the tiles are arranged.',
    lessons: [
      {
        id: 'menzen-tsumo',
        title: 'Menzen tsumo',
        summary: 'Drawing the winning tile yourself with a closed hand — the free han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'The cheapest yaku in the game is also the one you never plan for. If your hand is completely closed and you draw the winning tile yourself, menzen tsumo is worth one han on top of everything else your hand scores.',
              'It needs no particular shape, no particular wait, and no declaration. It simply arrives the moment you self-draw a closed hand. Open the hand with any call and it disappears.',
            ],
            figures: [
              { tiles: '123m 456m 234p 234s 55s', caption: 'A closed hand that self-draws its winning tile scores pinfu, tanyao and menzen tsumo — the self-draw is the one that costs you nothing.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Tsumo wins are paid a little by each of the three opponents, instead of all by one. So a self-draw with a closed hand both scores an extra han and splits the bill — which is why riichi players are always delighted to draw out.',
              'The only time you do not get it is after a call: an open tsumo is still a legal win, but it carries no menzen tsumo han.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Closed hand + you drew the finishing tile = menzen tsumo. It stacks with pinfu, tanyou, riichi and every shape yaku; it never stands alone.',
            },
          },
          ...drills([
            {
              prompt: 'You hold a fully closed hand and draw the very tile you are waiting on. Besides the shape of your hand, which yaku have you certainly earned?',
              figures: [{ tiles: '234m 345m 345p 234s 88p', caption: 'Closed, and you drew the winning tile yourself.' }],
              options: [
                { label: 'Menzen tsumo — one han for drawing it yourself', correct: true, why: 'A closed hand that wins on its own draw always carries menzen tsumo, one han, on top of whatever shapes it holds. This figure also has pinfu and tanyao, but the thing the question asks about is the self-draw.' },
                { label: 'Rinshan kaihou — the self-draw bonus', why: 'Rinshan is only a draw from the dead wall made to replace a kan. An ordinary wall draw is just an ordinary tsumo.' },
                { label: 'Haitei raoyue — the last-tile bonus', why: 'Haitei needs the winning tile to be the very last tile of the live wall. Nothing here says the wall has run out.' },
              ],
            },
            {
              prompt: 'You called a pon early on, then later draw your own winning tile. The menzen tsumo bonus is NOT added to your score. Why not?',
              options: [
                { label: 'The bonus belongs to closed hands — calling a pon opened the hand, so the self-draw bonus is gone', correct: true, why: '“Menzen” means concealed. The extra han is the reward for building the whole hand yourself and drawing the win; once you take any call, the hand is open and that bonus no longer applies, even though the win itself was self-drawn.' },
                { label: 'An open hand cannot win on a self-draw at all', why: 'Open hands win on self-draws all the time — tsumo has nothing to do with being open. You lost only the menzen bonus, not the win.' },
                { label: 'Self-draw bonuses only count in the first few turns', why: 'There is no turn limit on menzen tsumo; it depends solely on the hand being closed when it wins, not on timing.' },
              ],
            },
            {
              prompt: 'Your hand is fully closed and tenpai, and the player on your right throws the exact tile you are waiting on. You declare ron. Do you also get menzen tsumo?',
              options: [
                { label: 'No — you won on a discard, and menzen tsumo requires drawing the tile yourself', correct: true, why: 'Menzen tsumo rewards a SELF-drawn win with a closed hand. The hand here is closed, but the winning tile came from another player, so it is a ron: riichi and pinfu survive, but the self-draw han does not.' },
                { label: 'Yes — a completely closed hand is all that menzen tsumo requires', why: 'Being closed is necessary but not sufficient; the win must also be a self-draw. “Closed” and “self-drawn” are two separate conditions and this hand meets only one.' },
                { label: 'No — discards from the player on your right cannot be won on', why: 'You absolutely can ron the player on your right (only chi is limited to the left player). The reason there is no menzen tsumo is that the win was a discard, not whose discard it was.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'riichi-family',
        title: 'Riichi, double riichi and ippatsu',
        summary: 'The declaration yaku, the first-turn version, and the next-draw bonus.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Riichi (1 han) you have met: declare on any closed tenpai hand. Double riichi (2 han) is the same declaration made on your very first discard — before the hand has really started — if you are dealt a tenpai opening hand.',
              'Ippatsu (1 han) is a bonus that rides on a riichi: win on your very next draw, or on a discard before your next draw, with no calls in between, and ippatsu is added.',
            ],
            figures: [
              { tiles: '123m 456m 234p 234s 88p', caption: 'A hand that is tenpai on the opening deal can be declared double riichi for two han.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'These stack. A double riichi that wins on its very first draw is double riichi plus ippatsu plus menzen tsumo, before you even count the hand’s shapes and any dora.',
              'A single call by anyone at the table between your riichi and your win cancels ippatsu, because the win no longer happens immediately. Furiten riichi can still ippatsu on a self-draw.',
            ],
            note: {
              title: 'Recognition cues',
              text: 'Declare on turn one = double riichi. Win the very first draw/discard after declaring (no calls) = ippatsu. Declare later = ordinary riichi. All require a closed tenpai hand.',
            },
          },
          ...drills([
            {
              prompt: 'You are dealt a hand that is already tenpai. You declare before making your very first discard. Which yaku is that declaration?',
              options: [
                { label: 'Double riichi (2 han)', correct: true, why: 'Riichi declared on the very first turn of the hand — your opening discard — is double riichi, worth two han instead of one. Being dealt a tenpai hand is rare, which is exactly why it pays double.' },
                { label: 'Ordinary riichi (1 han)', why: 'Ordinary riichi is declared after the first turn. A declaration on the opening discard, before anyone has drawn, is the upgraded double riichi.' },
                { label: 'Tenhou, the dealer yakuman', why: 'Tenhou is the dealer self-drawing the winning tile from the opening deal — an actual completed hand, not a declaration on a merely tenpai one. Here you only declare, then continue the hand.' },
              ],
            },
            {
              prompt: 'You declare riichi. Your very next draw is the winning tile, and nobody called in between. What extra han do you gain?',
              options: [
                { label: 'Ippatsu, plus menzen tsumo', correct: true, why: 'Winning on the immediate next draw after declaring — with no intervening call — is ippatsu, one han, and because it was a self-draw on a closed hand menzen tsumo stacks too. This is the best small sequence in the game.' },
                { label: 'Double riichi', why: 'Double riichi is about WHEN you declare (the first turn), not about winning quickly. A normal-turn riichi that wins fast is still ordinary riichi plus ippatsu.' },
                { label: 'Rinshan kaihou', why: 'Rinshan is a win on the dead-wall draw after a kan. This was a normal draw from the live wall.' },
              ],
            },
            {
              prompt: 'You declare riichi. The player after you pons a tile, and then on your next turn you draw your winning tile. Do you get ippatsu?',
              options: [
                { label: 'No — the opponent’s pon broke the immediate-win window before your draw', correct: true, why: 'Ippatsu rewards a win on the very next turn with nothing interrupting it. A call by anyone resets that clock, so even though you drew the win yourself on the following turn, the pon in between means there is no ippatsu.' },
                { label: 'Yes — you drew the win on your first draw after declaring, which is exactly ippatsu', why: 'It would be ippatsu if that draw truly followed the declaration uninterrupted. But an opponent’s call counts as an interruption, so “my first draw” after a call is not the clean first draw the bonus requires.' },
                { label: 'Yes — calls by other players do not affect your own ippatsu', why: 'Ippatsu reads the whole table, not just your hand. A pon or chi by anyone between your declaration and your win cancels the one-shot bonus; only riichi itself is unaffected by their call.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'last-tile',
        title: 'Haitei and houtei: the last tile',
        summary: 'Winning on the final tile of the wall — by draw or by discard.',
        steps: [
          {
            kind: 'teach',
            text: [
              'The live wall does not run dry quietly. If you win on the very last tile available, you earn a bonus yaku regardless of the hand’s shapes.',
              'There are two, depending on the source. Haitei raoyue is drawing the last wall tile yourself and winning on it. Houtei raoyui is winning on a player’s discard that is the very last discard before the wall exhausts.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'If the winning tile is the last one of the hand, there is a bonus: self-draw = haitei (a tsumo), discard = houtei (a ron). Each is one han and stacks with everything else.',
            },
          },
          {
            kind: 'teach',
            text: [
              'You cannot aim for these in the ordinary way — they depend on the wall count — but they matter for strategy: near the end, reaching tenpai keeps you in the game for the noten payment, and a last-tile win occasionally pays a bonus you were not expecting.',
              'Haitei and rinshan interact: a kan near the end can change which tile is literally last, so the dead-wall replacement draw is the only place these definitions get fiddly.',
            ],
          },
          ...drills([
            {
              prompt: 'You draw the final tile left in the live wall and it completes your hand. Which yaku applies?',
              options: [
                { label: 'Haitei raoyue — the last-tile self-draw', correct: true, why: 'Haitei is winning by drawing the very last tile of the live wall yourself. It is a tsumo win, so menzen tsumo can stack with it on a closed hand, and it adds one han no matter the shapes.' },
                { label: 'Houtei raoyui — the last-tile discard', why: 'Houtei is the ron version: winning on a discard that is the final discard before the wall runs out. You drew this tile, so it is haitei.' },
                { label: 'Rinshan kaihou', why: 'Rinshan is a dead-wall replacement tile after a kan, not the last tile of the live wall.' },
              ],
            },
            {
              prompt: 'The wall is down to its last discard cycle. An opponent throws a tile and you ron on it — the game would have ended in a draw had you not. What is the bonus?',
              options: [
                { label: 'Houtei raoyui — the last-tile discard', correct: true, why: 'Winning on the very last discard before exhaustion is houtei raoyui, the ron counterpart to haitei. One bonus han on top of the hand’s ordinary yaku.' },
                { label: 'Haitei raoyue', why: 'Haitei is specifically a self-draw. A win on an opponent’s discard is a ron and takes the discard-based last-tile yaku, houtei.' },
                { label: 'Chankan', why: 'Chankan is robbing the kan — winning on a tile an opponent adds as a kan. This was an ordinary discard, not a kan-added tile.' },
              ],
            },
            {
              prompt: 'Your plain hand has tanyao for one han, and you draw the very last tile of the wall to win. What does winning on that last tile add?',
              options: [
                { label: 'One more han (haitei) — last-tile timing is a bonus on top of whatever yaku you already have', correct: true, why: 'Haitei and houtei are timing yaku worth one han, with no shape requirement of their own. The hand still needs an ordinary yaku to be legal — here tanyao provides it — and the last-tile bonus simply adds on.' },
                { label: 'Nothing — the last tile only matters for a limit hand', why: 'The last tile carries its own one-han bonus on any winning hand, not just a big one. Timing, not size, triggers it.' },
                { label: 'It turns the tanyao into a limit hand', why: 'A timing bonus never inflates a one-han hand to yakuman; it adds a single han and leaves the hand’s other yaku exactly as they were.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'kan-draws',
        title: 'Rinshan and chankan: the kan yaku',
        summary: 'Winning on the tile a kan produces, or on the tile someone adds to a kan.',
        steps: [
          {
            kind: 'teach',
            text: [
              'A closed or promoted kan pulls a replacement tile from the dead wall so you keep fourteen. Win on that replacement draw and you score rinshan kaihou — the “flower after the mountain” — one han.',
              'Chankan goes the other way: when an opponent adds a fourth tile to make a kan, if that very tile is the one you are waiting on, you may claim it as your winning tile. Robbing the kan, one han.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'Both are rare because both need a kan to happen. Rinshan is a self-draw (a tsumo), chankan is a ron on the kan-adding tile.',
              'Note the interaction: rinshan draws are dead-wall tiles, so they are never also ippatsu draws in the ordinary sense, and a chankan win on a promoted (open) kan does not disturb your own closed status.',
            ],
            note: {
              title: 'Recognition cues',
              text: 'Win on the replacement tile after YOUR kan = rinshan (a tsumo). Win on the tile an opponent flips to make THEIR kan = chankan (a ron). Each one han.',
            },
          },
          ...drills([
            {
              prompt: 'You declare a kan, draw the replacement tile from the dead wall, and it completes your hand. Which yaku?',
              options: [
                { label: 'Rinshan kaihou — winning on the kan replacement', correct: true, why: 'The dead-wall tile drawn to replace the one used in your kan is a rinshan draw, and winning on it scores rinshan kaihou, one han. It is a self-draw, so on a closed hand menzen tsumo stacks.' },
                { label: 'Chankan', why: 'Chankan is winning on the tile an OPPONENT adds to their kan. Here the kan and the draw are yours, which is rinshan.' },
                { label: 'Haitei raoyue', why: 'Haitei is the last tile of the LIVE wall. A kan replacement comes from the dead wall and is rinshan, even if it happens late.' },
              ],
            },
            {
              prompt: 'Your hand is closed and tenpai. You declare a closed kan, draw the replacement from the dead wall — and that replacement tile completes your hand. Which yaku do you score together?',
              options: [
                { label: 'Rinshan kaihou plus menzen tsumo — the replacement is a self-draw, and the hand stayed closed', correct: true, why: 'Winning on the dead-wall tile drawn after your own kan is rinshan kaihou, one han. Because that tile is self-drawn and your hand was never opened (a closed kan keeps it concealed), menzen tsumo stacks too — a kan win can quietly carry two luck han.' },
                { label: 'Chankan plus rinshan — winning near a kan always scores both', why: 'Chankan is a RON on an OPPONENT’s newly added kan tile, not on your own draw. You won on your own replacement tile, so there is no chankan here at all.' },
                { label: 'Haitei raoyue — any draw late in the wall is the last-tile yaku', why: 'Haitei is the final tile of the LIVE wall. A dead-wall replacement after a kan is rinshan, even when it happens near the end, and the two do not coincide.' },
              ],
            },
            {
              prompt: 'You are tenpai. Your left opponent adds a fourth tile and promotes an open triplet to a kan — and that exact tile is the one your hand is waiting on. What are you entitled to?',
              options: [
                { label: 'Call chankan: that newly exposed kan tile is your winning ron tile, for one han', correct: true, why: 'The fourth tile added to make a kan is momentarily exposed, and if it is your wait you may claim it as a chankan win — a ron on the kan tile. (Had YOU declared a kan and then won on your own dead-wall replacement, that would instead be rinshan.)' },
                { label: 'Call rinshan, because a kan was declared', why: 'Rinshan applies to the player who declared the kan winning on THEIR OWN dead-wall replacement draw. Here you are winning on the opponent’s exposed tile, which is chankan.' },
                { label: 'Nothing — a tile turned into a kan can no longer be won on', why: 'That is the opposite of the chankan rule: the added kan tile is precisely the moment a tenpai hand can steal it. The call is legal and scores.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'renhou',
        title: 'Renhou: the hand of man',
        summary: 'Winning on an opponent’s discard before making a single call or draw of your own.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Tenhou and chiihou cover the self-drawn perfect hand. Renhou is the ron equivalent: you win on another player’s discard during your very first visit to the table — before you have made any draw or call of your own.',
              'This app values renhou at five han, which is exactly mangan, and it still stacks with any other yaku the hand happens to contain. It is the non-dealer’s perfect-timing win.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'It is essentially a “win before you have touched the wall” achievement: your hand stays completely as dealt, and the opponent feeds you before you ever draw. In practice you almost never chase it — it is recognised after the fact.',
              'The closed requirement and the timing make it rarer than an ordinary win, which is why it carries a fixed mangan value here.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'You win on a discard, having never yet drawn or called — your hand is exactly as dealt. That is renhou, valued at mangan (5 han) in this game.',
            },
          },
          ...drills([
            {
              prompt: 'Before your very first draw, an opponent discards a tile that completes your dealt hand and you ron. Which yaku is this?',
              options: [
                { label: 'Renhou — the hand of man, valued at mangan', correct: true, why: 'Winning on a discard before you have made any draw or call of your own is renhou, the non-self-draw counterpart to chiihou. This app sets it at five han — a guaranteed mangan — and it stacks with the hand’s other yaku.' },
                { label: 'Chiihou', why: 'Chiihou is a non-dealer SELF-drawing the winning tile from their first draw. This is a win on a discard before you draw at all, which is renhou.' },
                { label: 'Tenhou', why: 'Tenhou is the dealer self-drawing the win on the opening draw. You are not the dealer and you won on a discard, so it is renhou.' },
              ],
            },
            {
              prompt: 'How is renhou handled in this app’s scoring?',
              options: [
                { label: 'As five han — a mangan floor that still stacks', correct: true, why: 'Renhou is set to five han, which lands exactly on mangan, so it guarantees a solid payout on its own while still combining naturally with pinfu, yakuhai or anything else the dealt hand holds.' },
                { label: 'As a full yakuman', why: 'It is not counted as yakuman here. Five han (mangan) is the chosen value; tenhou and chiihou are the self-draw yakuman.' },
                { label: 'As a single ordinary han', why: 'One han would underprice a hand that requires you to win before touching the wall. It is fixed at mangan strength instead.' },
              ],
            },
            {
              prompt: 'What condition must hold for a win to be renhou rather than an ordinary ron?',
              options: [
                { label: 'You have not yet drawn or called — the hand is exactly as dealt', correct: true, why: 'Renhou is all about timing: the winning discard arrives during your very first turn, before any draw or call of your own. Once you have discarded or drawn, a later ron is just an ordinary win.' },
                { label: 'The hand contains only terminals', why: 'The hand’s tiles are irrelevant — renhou is a timing yaku like haitei, and the hand is whatever you were dealt. Only the “win before you act” condition matters.' },
                { label: 'You are the dealer', why: 'The dealer’s self-draw is tenhou; the dealer cannot be on the receiving end of renhou in the same way. Renhou is the non-dealer being fed before acting.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'yaku-everyday',
    book: 0,
    title: 'The everyday shape yaku',
    kanji: '常用',
    blurb: 'Pinfu, tanyao, yakuhai, chiitoitsu and toitoi — the hands that pay most bills.',
    lessons: [
      {
        id: 'pinfu-codex',
        title: 'Pinfu',
        summary: 'All runs, a plain pair, a two-sided wait — the clean closed hand, one han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Pinfu is what an efficient closed hand looks like for free. Four runs, a pair that is neither a dragon nor a valued wind, and a winning wait that is two-sided — nothing that earns fu. Closed only, one han.',
              'The pair must be “plain”: not a dragon, not the round wind, not your seat wind. The wait must be a ryanmen (two-sided), never a pair wait or an edge or closed wait.',
            ],
            figures: [
              { tiles: '123m 456m 234p 234s 55s', caption: 'Four runs, a simple pair of 5s, won on the two-sided 1s/4s wait — textbook pinfu.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Because pinfu hands are made entirely of runs with a two-sided wait, they almost always also have tanyao when they avoid terminals — pinfu and tanyao together are the classic fast two-han closed hand.',
              'It vanishes the moment you open the hand: no pinfu after a call, which is why a clean pinfu hand usually goes in via riichi rather than via melding.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Closed, four runs, simple/non-yakuhai pair, winning on a two-sided wait = pinfu. It deliberately excludes triplets, valued pairs and narrow waits.',
            },
          },
          ...drills([
            {
              prompt: 'Which of these complete hands scores pinfu?',
              options: [
                { label: '123m 456m 234p 234s with a 55s pair, won on 1s/4s', correct: true, why: 'Four runs, a plain simple pair, a two-sided winning wait and fully closed: every pinfu condition is met, with tanyao stacked on top. This is the defining shape.' },
                { label: '123m 456m 234p 234s with a PP (white dragon) pair', why: 'The dragon pair is a valued pair — it earns fu for being yakuhai adjacent — so the hand is not “no-fu”, which is what pinfu requires. A dragon pair breaks pinfu.' },
                { label: 'Three runs and a triplet of Easts, with a simple pair', why: 'Pinfu requires four RUNS; any triplet (koutsu) earns fu and disqualifies the no-fu shape. A triplet hand is not pinfu.' },
              ],
            },
            {
              prompt: 'You complete a closed pinfu hand by drawing the tile yourself. Which yaku does it score beyond pinfu itself?',
              options: [
                { label: 'Menzen tsumo (and tanyao if all simples)', correct: true, why: 'A closed self-draw always adds menzen tsumo, and when the runs and pair avoid terminals and honours — as pinfu hands usually do — tanyao stacks too. Pinfu + tanyao + menzen tsumo is the bread-and-butter three-han hand.' },
                { label: 'Nothing else can stack with pinfu', why: 'Pinfu stacks freely with tanyao, menzen tsumo, riichi, ippatsu and the run-based yaku. It is only open hands that lose it.' },
                { label: 'Yakuhai for the pair', why: 'A plain pinfu pair is by definition not a dragon or valued wind, so it carries no yakuhai. A yakuhai pair is exactly what pinfu forbids.' },
              ],
            },
            {
              prompt: 'You melded an early chi and your hand is now four runs and a plain 55s pair, with a two-sided wait. You expected pinfu, but your score has none. What happened?',
              options: [
                { label: 'Pinfu is closed-only — that one chi opened the hand and forfeited it', correct: true, why: 'Pinfu rewards a perfectly concealed, zero-fu hand. The very first meld breaks that: even though the four runs, plain pair and two-sided wait are all still there, the chi introduced fu and an open hand can never be pinfu. The same hand closed would score it.' },
                { label: 'An open hand can no longer hold four runs and a pair', why: 'Open four-runs-and-a-pair hands are common — a chi just supplies one of the runs. The shape survived; it is the closed/no-fu condition that the meld violated, not the arrangement of sets.' },
                { label: 'The chi turned the pair into a valued pair', why: 'Melding does not change which tile the pair is made of, and a 5s pair was never valued anyway. The disqualifier is openness itself, not any change to the pair.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'tanyao-codex',
        title: 'Tanyao',
        summary: 'All simples — no terminals, no honours. One han, open or closed when kuitan is on.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Tanyao is a hand with no 1s, no 9s and no honours anywhere: only the middle tiles 2 through 8. One han, and unlike pinfu it can be scored on an open hand when the table allows open tanyao (kuitan, which this app uses by default).',
              'It is the yaku that appears by itself while you build with the flexible middle tiles, which is exactly why the discard order sheds terminals and honours first.',
            ],
            figures: [
              { tiles: '234m 456m 345p 345s 66p', caption: 'Every tile is a simple (2–8). No 1, no 9, no wind or dragon — tanyao, one han, open or closed.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'A single terminal or honour anywhere in the winning hand breaks it. The pair must be a simple too — a hand that is all runs of simples but pairs its East is not tanyao.',
              'Closed tanyao stacks naturally with pinfu and riichi; open tanyao is the cheapest legal yaku, which makes it the standard fast melding hand.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Every tile is a 2-through-8 simple = tanyao. One stray terminal or honour tile kills it. It is the easiest yaku to spot and the easiest to break by accident.',
            },
          },
          ...drills([
            {
              prompt: 'Which of these complete hands scores tanyao?',
              options: [
                { label: '234m 456m 345p 345s with a 66p pair', correct: true, why: 'Every tile in the four sets and the pair is a simple between 2 and 8 — no terminal, no honour. That is tanyao, and because the shape is closed it stacks with pinfu and riichi too.' },
                { label: '789m 456m 345p 345s with a 66p pair', why: 'The 789m run ends in a 9m terminal. Any single terminal or honour anywhere disqualifies tanyao; this hand has none of its free han.' },
                { label: '234m 456m 345p 345s with an EE pair', why: 'The East pair is an honour. Tanyao forbids honours as well as terminals, so a valued-wind pair breaks it even though all four runs are simples.' },
              ],
            },
            {
              prompt: 'You call a chi to finish a hand made entirely of 2-through-8 tiles, and you have no dragon or wind triplet. Does the hand still win?',
              options: [
                { label: 'Yes — all simples is tanyao, and tanyao is the yaku that survives being open', correct: true, why: 'Tanyao is the main shape yaku that works after a call. On a table with open tanyao (kuitan), an all-simples hand can call its way to a win with no dragon or wind needed — that is exactly the standard cheap, fast melded hand.' },
                { label: 'No — an open hand must contain a dragon or wind triplet or it is illegal', why: 'Open hands need a yaku, but tanyao itself is that yaku; it does not have to be yakuhai. An all-simples open hand is legal precisely because tanyao survives melding.' },
                { label: 'No — tanyao is closed-only like pinfu and riichi', why: 'Pinfu and riichi are the closed-only ones; tanyao is the exception that scores open. The chi is fine here because every tile is still a simple.' },
              ],
            },
            {
              prompt: 'A hand is all simple runs except one 9p used in a run. Does it score tanyao?',
              options: [
                { label: 'No — one terminal tile anywhere breaks the yaku', correct: true, why: 'Tanyao is unforgiving: every one of the fourteen tiles must be a simple. A single 9p in a run makes the hand contain a terminal, so it cannot be tanyao and must find its yaku elsewhere (often riichi).' },
                { label: 'Yes — terminals are allowed in runs', why: 'Terminals are never allowed in tanyao, in runs or otherwise. The rule is about the tiles present, not their role.' },
                { label: 'Yes if the pair is a simple', why: 'The pair being simple does not rescue the 9p. The condition applies to every tile in the hand, not just the head.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'yakuhai-codex',
        title: 'Yakuhai: dragons and valued winds',
        summary: 'A triplet of any dragon, the round wind, or your seat wind — one han each.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Yakuhai is the easiest value in the game: a triplet of any dragon, or of the wind that matches the round or your seat. Each such triplet is one han, open or closed, and several of them stack.',
              'The three dragons — white (P), green (F), red (C) — always count. The round wind always counts. Your own seat wind counts. A wind that is neither the round nor yours does nothing.',
            ],
            figures: [
              { tiles: 'PPP 123m 456m 234p 789p', caption: 'A triplet of white dragons is yakuhai haku — one guaranteed han, open or closed.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'A yakuhai pair in your starting hand is worth holding: the third copy turns it into a triplet that gives you a yaku you can open the hand around. That single block is often what makes a call legal.',
              'The seat-and-round combination matters. Sitting South in an East round, an East triplet counts (round wind) and a South triplet counts (seat wind), but a West or North triplet counts for nothing.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Any dragon triplet = always yaku. A wind triplet = yaku if it is the round wind or your seat wind. Each qualifying triplet adds one han and works on an open hand.',
            },
          },
          ...drills([
            {
              prompt: 'Which triplet ALWAYS gives a yakuhai han, no matter the seat or round?',
              options: [
                { label: 'A triplet of any dragon — white, green or red', correct: true, why: 'The three dragons are valuable to everyone at the table, every round. A white, green or red dragon triplet is always one han, open or closed — which is why a dragon pair is kept early.' },
                { label: 'A triplet of the South wind', why: 'South counts only if it is the round wind or your own seat wind. At a West-round North seat a South triplet scores nothing, so it is not an always-on yaku.' },
                { label: 'A triplet of the seat wind only', why: 'The seat wind counts, but the dragon triplets and the round wind count too — and the dragons are the ones that are independent of seating entirely.' },
              ],
            },
            {
              prompt: 'You are the South seat in an East round. Which wind triplet scores yakuhai for you?',
              options: [
                { label: 'Both the East triplet (round wind) and the South triplet (seat wind)', correct: true, why: 'The round wind (East) always counts, and your own seat wind (South) counts — each as its own han. A West or North triplet, being neither round nor seat, is worthless; and if the round wind equals your seat wind, that one triplet is worth two han.' },
                { label: 'Only the East triplet', why: 'The East triplet counts as the round wind, but your own seat wind South counts too. Two different valued winds are not limited to one.' },
                { label: 'Only the South triplet', why: 'South counts as your seat wind, but the round wind East is also valuable to you — both are yaku.' },
              ],
            },
            {
              prompt: 'Why is a single dragon pair in your opening hand often worth keeping?',
              options: [
                { label: 'The third dragon makes a triplet that is a guaranteed yaku you can call around', correct: true, why: 'A dragon pair is one copy away from a yakuhai triplet that works even on an open hand. When the third dragon appears you can pon it and instantly hold a legal yaku, which frees you to call the rest of the hand toward tenpai.' },
                { label: 'A dragon pair itself is a yaku', why: 'A pair is not a triplet and scores no han by itself. It is the future triplet that matters; hold the pair as a block waiting for the third.' },
                { label: 'Dragons can form a run', why: 'Honours cannot form runs at all — only triplets and pairs. The dragon pair’s value is the coming triplet, not a run.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'chiitoitsu-codex',
        title: 'Chiitoitsu: seven pairs',
        summary: 'Fourteen tiles in seven distinct pairs. Closed only, two han, single-tile wait.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Chiitoitsu is the great exception to four-sets-and-a-pair: fourteen tiles arranged as seven DIFFERENT pairs. No runs, no triplets, no sets at all — just pairs. Closed only, two han.',
              'The pairs must be distinct: you cannot use four copies of one tile to make “two pairs” of the same kind. Each pair contributes its own kind.',
            ],
            figures: [
              { tiles: '11m 33m 55p 77p 99p 22s FF', caption: 'Seven pairs of seven different kinds — chiitoitsu, two han. It waits on one tile to make the seventh pair.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Chiitoitsu always waits on a single tile (a tanki wait), so its wait is small — three live copies — and it cannot be opened. Its strength is that it ignores shape entirely: a hand full of disconnected pairs is hopeless for a standard hand but may already be chiitoitsu.',
              'It is decided early: with five pairs by the mid-game, switch to seven-pairs; discovering it at turn twelve is too late.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Fourteen tiles as seven distinct pairs = chiitoitsu, closed, two han. Four of one tile does not count, and the wait is always a single-tile tanki.',
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is chiitoitsu?',
              options: [
                { label: '11m 33m 55p 77p 99p 22s and an FF pair', correct: true, why: 'Fourteen tiles as seven pairs, each pair of a different tile kind, no sets anywhere — that is chiitoitsu. It scores two han and must stay closed.' },
                { label: '123m 456m 789p 234s and a 55s pair', why: 'That is an ordinary four-runs-and-a-pair hand (pinfu-shaped), not seven pairs. Chiitoitsu has no runs at all.' },
                { label: '1111m 55p 77p 99p 22s 44s FF', why: 'Four copies of the 1m cannot be split into two pairs — pairs must be distinct kinds. Four of a tile is a quad, not two pairs, so this is not chiitoitsu.' },
              ],
            },
            {
              prompt: 'You are collecting six pairs toward chiitoitsu, then an opponent discards a tile that would let you pon a triplet. If you take it, can you still finish the seven-pairs hand?',
              options: [
                { label: 'No — the pon opens the hand and chiitoitsu is closed-only, so that path is gone', correct: true, why: 'Chiitoitsu cannot be melded: a single call breaks the concealed seven-pairs structure. Once you pon, the hand is open and the two-han seven-pairs yaku is no longer available; you would have to rebuild toward an open hand like toitoi or tanyao.' },
                { label: 'Yes — the pon just turns one pair into a triplet and the hand keeps scoring seven pairs', why: 'A seven-pairs hand cannot contain a triplet at all, and a call opens the hand besides. Poning does not simply upgrade a pair; it destroys the chiitoitsu shape.' },
                { label: 'Yes — tanyao survives being open, so chiitoitsu does too', why: 'Tanyao is unusual in staying valid on an open hand; chiitoitsu is not. Each yaku has its own rules, and seven pairs strictly requires a concealed hand.' },
              ],
            },
            {
              prompt: 'What does a tenpai chiitoitsu hand always wait on?',
              options: [
                { label: 'A single tile — the seventh pair (a tanki wait)', correct: true, why: 'One tile from seven pairs means six pairs plus one lone tile; you are waiting on the mate of that lone tile. Only three copies are live, so the wait is small — chiitoitsu’s main weakness.' },
                { label: 'A two-sided run tile', why: 'There are no runs in chiitoitsu, so there is nothing to be two-sided on. Its only possible wait is pairing the lone tile.' },
                { label: 'A third copy of one of the pairs', why: 'A third copy makes a triplet, which is not a set in chiitoitsu and would break the seven-pairs count. You need a mate for the single unpaired tile.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'toitoi-codex',
        title: 'Toitoi: all triplets',
        summary: 'Four triplets and a pair — and every honour triplet stacks yakuhai on top.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Toitoi is the mirror of pinfu: four triplets and one pair, with no runs anywhere. Two han, open or closed, and the triplets love honours and terminals because those are tiles opponents discard.',
              'It is built on pairs: every pair that ponned becomes a triplet is one block of the hand, so a start with several pairs is the tell.',
            ],
            figures: [
              { tiles: 'EEE 555m PPP 999p 22s', caption: 'Four triplets and a 2s pair — toitoi, two han, and the East and white triplets each add yakuhai on top.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Toitoi’s hidden value is the stacking: when the triplets are dragons or valued winds, each adds a yakuhai han, so a toitoi hand with two dragon triplets is already four han before dora.',
              'It is slower than a run hand because a pair waits on two tiles to complete, not eight — which is why it needs the value to justify the calls.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Four triplets (or kans) and one pair = toitoi, two han. Each honour triplet inside it is its own yakuhai, so read a pons-heavy opponent for toitoi plus yakuhai.',
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is toitoi?',
              options: [
                { label: 'EEE 555m PPP 999p with a 22s pair', correct: true, why: 'Four triplets and a pair with no runs is toitoi, two han. The East and white-dragon triplets each add yakuhai too, which is how toitoi grows quietly large.' },
                { label: '123m 456m 789p 234s with a 55s pair', why: 'That is four runs — the opposite shape. All-run hands are pinfu-shaped; toitoi has no shuntsu at all.' },
                { label: '11m 33m 55p 77p 99p 22s FF', why: 'Seven pairs is chiitoitsu, not toitoi. Toitoi requires the pairs to have become triplets: four koutsu and one head.' },
              ],
            },
            {
              prompt: 'Your toitoi hand contains a white-dragon triplet, a green-dragon triplet and a round-wind East triplet. Before counting dora, how big is it?',
              options: [
                { label: 'Five han — two for toitoi plus one yakuhai han for each of the three valued triplets', correct: true, why: 'Toitoi gives two han, and every dragon or valued-wind triplet inside it is independently yakuhai for another han. Here that is two plus three, so the open hand is already five han before dora — the stacking is why honour-heavy toitoi grows quietly large.' },
                { label: 'Two han — toitoi is a flat bonus and the triplets add nothing on top', why: 'Toitoi’s two han is only the shape; each valued honour triplet carries its own yakuhai han regardless of the surrounding yaku, so they are counted separately.' },
                { label: 'One han — an open hand can only ever hold a single yaku', why: 'Open hands may stack as many yaku as they contain; yakuhai and toitoi coexist and add together. Opening a hand never collapses multiple yaku into one.' },
              ],
            },
            {
              prompt: 'Toitoi hands are usually built by which kind of call?',
              options: [
                { label: 'Pon — turning each pair into a triplet', correct: true, why: 'Toitoi grows triplets, and pon is the call that completes a triplet from a pair and an opponent’s discard. A player pons repeatedly, especially honours and terminals, is the classic toitoi tell.' },
                { label: 'Chi — chaining runs together', why: 'Chi builds runs, and toitoi has no runs. A player who only chis is pursuing a run hand, exactly the opposite shape.' },
                { label: 'No calls — it is closed-only', why: 'Toitoi scores two han open or closed; it is commonly built by pons. Unlike chiitoitsu, it is not restricted to a concealed hand.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'yaku-twohan',
    book: 0,
    title: 'The two-han shape yaku',
    kanji: '二翻',
    blurb: 'Sanshoku, ittsu, the outside hands, and the triplet-based two-han patterns.',
    lessons: [
      {
        id: 'sanshoku-doujun',
        title: 'Sanshoku doujun: three-colour runs',
        summary: 'The same numbered run in all three suits. Two han closed, one open.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Sanshoku doujun is the same run — same starting number — made once in each suit: 234m, 234p and 234s. Two han closed, one open.',
              'It is the yaku that can appear for free in an efficient run hand, because the middle runs you wanted for speed are exactly what lines up into three colours.',
            ],
            figures: [
              { tiles: '234m 234p 234s 567m 88s', caption: '234 in man, pin and sou — the matching run across all three suits is sanshoku doujun.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'The runs must share the exact same number span. 234 in all three suits counts; 234m with 345p and 456s is three runs but not sanshoku, because the numbers do not match.',
              'It survives a call for a reduced han, so it is one of the two-han yaku worth melding toward when the shape is close.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Find a run; if the same-number run exists in both other suits, that is sanshoku doujun. Matching ranks across all three suits — two han closed, one open.',
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand scores sanshoku doujun?',
              options: [
                { label: '234m 234p 234s plus a 567m run and an 88s pair', correct: true, why: 'The identical 2-3-4 run in all three suits is the definition of sanshoku doujun. The fourth set and pair fill the hand; this is two han closed.' },
                { label: '234m 345p 456s plus a 789m run and a pair', why: 'Three runs in three suits, but each starts at a different number. Sanshoku needs the SAME number span in each suit, not merely one run per suit.' },
                { label: '234m 234p with two triplets and a pair', why: 'The matching 234 appears in only two suits. The run must be present in man, pin AND sou — all three colours — for the yaku.' },
              ],
            },
            {
              prompt: 'You complete the matching 234 run in all three suits, but one of the three runs was taken by chi, so the hand is open. What does the three-colour pattern score?',
              options: [
                { label: 'One han — sanshoku survives calls but drops from two han to one', correct: true, why: 'Sanshoku doujun is worth two closed and one open. Because you melded a run, the hand is open, so the pattern pays one han. That still matters: a single han can both legalise and pay a melded hand.' },
                { label: 'Nothing — once you chi, a run-coordination yaku is lost like pinfu', why: 'Pinfu is the closed-only pattern; sanshoku is not. It remains a valid yaku after a call and is deliberately built by meld when the shapes line up.' },
                { label: 'Two han — the han value of the pattern does not change after a call', why: 'Most two-han shape yaku lose a han when the hand is opened, and sanshoku does: it pays two closed and one open, so the melded version scores less.' },
              ],
            },
            {
              prompt: 'You hold 234m and 234p, with a two-sided shape that could become 234s. What are you aiming at?',
              options: [
                { label: 'Completing sanshoku doujun by drawing the third matching run', correct: true, why: 'The third same-number run in sou completes the three-colour yaku — 234 across m, p and s. This is the “free sanshoku” the strategy course prizes: speed-building happens to line the colours up.' },
                { label: 'Ittsu, the straight', why: 'Ittsu is 1-2-3, 4-5-6, 7-8-9 within ONE suit. This spans three different suits with the same run, which is sanshoku.' },
                { label: 'Chanta, the outside hand', why: 'Chanta requires every set to touch a terminal or honour. A 234 run is all simples, so this has nothing to do with chanta.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'ittsu-codex',
        title: 'Ittsu: the straight',
        summary: '1-2-3, 4-5-6 and 7-8-9 all in one suit. Two han closed, one open.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Ittsu (sometimes called ikkitsuukan) is the full-length straight: the runs 123, 456 and 789 all within a single suit — every number 1 through 9. Two han closed, one open.',
              'Where sanshoku spreads one run across three suits, ittsu stacks three runs end-to-end inside one suit. They are the two “run coordination” yaku and are easy to confuse.',
            ],
            figures: [
              { tiles: '123m 456m 789m 234p 55s', caption: 'Man 1 through 9 as three consecutive runs, 123-456-789 — ittsu, two han closed.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'The three runs must connect: a gap (123, 456, 999 say) is not a straight, and the runs must be in the same suit. It pulls toward the terminals, since it needs the 1 and the 9 of the suit.',
              'Like sanshoku it survives a call for one fewer han, and a half-finished 123-789 looking for 456 is the common way it declares itself.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Three runs in ONE suit whose ranks are 1-2-3, 4-5-6 and 7-8-9 — an unbroken ladder from the 1 to the 9 — is ittsu.',
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is ittsu?',
              options: [
                { label: '123m 456m 789m plus a 234p run and a 55s pair', correct: true, why: '1-2-3, 4-5-6 and 7-8-9 all in man covers every rank 1 through 9 in one suit — the full straight, ittsu, two han closed. The fourth run and pair round out the hand.' },
                { label: '123m 123p 123s plus a 456m run and a pair', why: 'That is the same run across three suits — sanshoku doujun. Ittsu runs three spans up ONE suit; sanshoku runs one span across three suits.' },
                { label: '123m 456m 789p plus a 234s run and a pair', why: 'The 789 is in pin, not man, so the man ladder breaks between 456 and 789. The straight must stay in a single suit end to end.' },
              ],
            },
            {
              prompt: 'You are tenpai waiting on 456p. Your hand already holds 123p and 789p, and your pair and fourth set are in sou. Which run-coordination yaku are you one tile from?',
              options: [
                { label: 'Ittsu — drawing the 456p run completes the 1-to-9 straight inside pin', correct: true, why: '123p, 456p and 789p cover ranks 1 through 9 of a single suit, which is the ittsu straight. The give-away is two completed end runs (123 and 789) in the SAME suit waiting for the middle.' },
                { label: 'Sanshoku doujun — the 456 run links the three suits', why: 'Sanshoku would want the same-numbered run repeated across man, pin and sou. Here all the runs climb one suit, which is the straight, not the three-colour match.' },
                { label: 'Chanta — the 123 and 789 runs touch terminals', why: 'Chanta needs EVERY set and the pair to touch a terminal or honour, not just two runs. The hand is aimed at the 1–9 ladder (ittsu); one plain pair and sou set would not satisfy chanta.' },
              ],
            },
            {
              prompt: 'You hold 123m and 789m complete, with a shape that could fill in 456m. Which yaku are you building?',
              options: [
                { label: 'Ittsu — the middle run completes the 1-to-9 man straight', correct: true, why: '123m and 789m are the two ends of the straight; adding 456m bridges them into 1-9 of man, which is ittsu. The two terminal-heavy end runs are the classic early tell.' },
                { label: 'Honitsu, a flush', why: 'A flush uses one suit plus honours and is about tile SUIT composition, not run ladders. Here the target is the specific connected runs.' },
                { label: 'Sanshoku doujun', why: 'Sanshoku would want 123 (or 789) matched in pin and sou. Here all three runs are in man at different spans — the straight.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'chanta-junchan',
        title: 'Chanta and junchan: the outside hands',
        summary: 'Every set and the pair touch a terminal — honours allowed (chanta) or none (junchan).',
        steps: [
          {
            kind: 'teach',
            text: [
              'Chanta is an “outside” hand: every set and the pair must touch a terminal (a 1 or 9) or an honour. Runs have to be edge runs (123 or 789), triplets must be terminal or honour, and the pair is terminal/honour too. Two han closed, one open.',
              'Junchan (“pure” chanta) is the stricter version — every set and pair touches a terminal but there are no honours at all. That makes it three han closed, two open.',
            ],
            figures: [
              { tiles: '123m 789m 123p 789p EE', caption: 'Every run is an edge run and the pair is a wind — chanta, two han. Replace the East pair with 11s and the edge runs kept terminal-only, and it is junchan.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'The condition is ruthless: one middle run in the hand destroys both. These hands are built out of edge shapes and value-tile pairs, so they are slow and tend to rely on the bonus han to be worthwhile.',
              'Junchan suppresses chanta — when there are no honours the pure version scores — and all-terminals-or-honours is honroutou, a different (and higher) yaku covered next.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Every set touches a terminal/honour and the pair does too = chanta; the same with terminals but zero honours = junchan (higher). One interior run breaks it.',
            },
          },
          ...drills([
            {
              prompt: 'A hand of 123m, 789m, 123p, 789p and an East pair — every set touches a terminal, the pair is an honour. What is it?',
              options: [
                { label: 'Chanta — the outside hand, two han', correct: true, why: 'All four runs are edge runs touching a terminal, and the head is an honour — every group touches a terminal or honour, which is chanta, two han closed (one open). The honour pair is precisely what keeps it from being junchan.' },
                { label: 'Junchan', why: 'Junchan forbids honours entirely. The East pair is an honour, so the hand qualifies for chanta, not the pure outside version.' },
                { label: 'Honroutou', why: 'Honroutou requires ALL tiles to be terminals or honours — no simples at all. This hand uses middle tiles (2,3,7,8) inside its edge runs, so it is chanta.' },
              ],
            },
            {
              prompt: 'The same structure but the East pair is replaced by a 1s pair, so every set and pair touches a terminal with no honours anywhere. What does it become?',
              options: [
                { label: 'Junchan — three han closed, the pure outside hand', correct: true, why: 'Remove the honours while keeping every group anchored to a terminal and chanta upgrades to junchan, worth three han closed (two open). Junchan suppresses chanta, so the hand scores the higher yaku only.' },
                { label: 'Still chanta, same han', why: 'Removing the last honour changes the yaku: the honour-free outside hand meets the stricter junchan definition and pays more.' },
                { label: 'Tanyao', why: 'Tanyao wants only middle tiles with no terminals. This hand is the opposite — built around terminals — so it cannot be tanyao.' },
              ],
            },
            {
              prompt: 'A chanta-shaped hand contains one ordinary middle run, 345p. Can it still score chanta or junchan?',
              options: [
                { label: 'No — a single interior run that touches no terminal breaks both', correct: true, why: 'Both outside yaku require EVERY set to touch a terminal (or honour). A 345p run of pure simples sits entirely in the middle and anchors to nothing, so neither chanta nor junchan applies; the hand must find its value elsewhere.' },
                { label: 'Yes, chanta tolerates one middle run', why: 'Chanta tolerates honours; it does not tolerate interior runs. The “every set touches an outside tile” rule has no exception.' },
                { label: 'Yes as junchan if the pair is a terminal', why: 'Junchan is stricter, not more lenient. The middle run fails chanta already, and adding a terminal pair cannot make it meet junchan.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'honroutou',
        title: 'Honroutou: all terminals and honours',
        summary: 'Fourteen tiles that are only terminals or honours — no simples at all. Two han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Honroutou is a hand containing no middle tiles whatsoever: every tile is a terminal (a 1 or 9) or an honour. Two han, open or closed. With nothing to make runs from, it is effectively all triplets or pairs in practice.',
              'It stacks ferociously: toitoi fits it naturally, and every honour triplet is yakuhai, so a honroutou-toitoi with value tiles often clears mangan without trying.',
            ],
            figures: [
              { tiles: '111m 999m PPP FFF 11p', caption: 'Terminals (1m, 9m, 1p) and honours (dragons) only — not a single simple. Honroutou, two han, plus toitoi and yakuhai.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Because 1s and 9s cannot make ordinary runs with middle tiles, a honroutou hand is triplets (toitoi) or seven pairs (chiitoitsu) in shape — it never looks like a run hand.',
              'It suppresses chanta and junchan: being all-terminal-or-honour is the stronger claim. Read a player who keeps and pons terminals and honours early as a possible honroutou, and treat middle tiles as safe against them.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Every tile is a 1, a 9 or an honour — zero simples — = honroutou, two han. Expect toitoi and yakuhai stacked on top.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is honroutou?',
              options: [
                { label: '111m 999m PPP FFF with a 11p pair', correct: true, why: 'Every tile is a terminal or an honour — there is not one simple (2–8) in the hand. That is honroutou, two han; the all-triplet shape also makes it toitoi and the dragons add yakuhai.' },
                { label: '123m 789m 123p 789p with an EE pair', why: 'That hand contains middle tiles (the 2,3,7,8 in the edge runs). Every group touches a terminal, but simples are present — that is chanta, not honroutou.' },
                { label: '234m 456m 789p 234s with a 55s pair', why: 'Full of middle tiles and only one terminal run — neither honroutou nor chanta. This is a plain run hand.' },
              ],
            },
            {
              prompt: 'Why are honroutou hands almost always worth much more than two han?',
              options: [
                { label: 'They stack toitoi plus multiple yakuhai automatically', correct: true, why: 'With no simples to make runs, the hand is triplets (toitoi, another two han) and the honour triplets within it are each yakuhai. Two or three dragon/wind triplets plus toitoi routinely reaches mangan on top of honroutou itself.' },
                { label: 'Honroutou is secretly a yakuman', why: 'It is a two-han yaku, not a yakuman. (The all-terminals NO-honour version, chinroutou, is the yakuman.)' },
                { label: 'It earns a multiplier for using terminals', why: 'There is no terminal multiplier. The extra value comes from the yaku that naturally co-occur: toitoi and yakuhai.' },
              ],
            },
            {
              prompt: 'A player keeps pons on 1s, 9s and dragons and discards every middle tile. Which yaku should you read?',
              options: [
                { label: 'Honroutou (possibly with toitoi) — middle tiles are safe against them', correct: true, why: 'Collecting only terminals and honours and rejecting all simples is the honroutou tell. It is built from triplets, so toitoi likely stacks; and because they cannot use 2–8 tiles, your middle discards are safe while your terminals and honours are live ammunition.' },
                { label: 'A tanyao speed hand', why: 'Tanyao is all simples — the exact opposite. A player discarding middle tiles is certainly not on tanyao.' },
                { label: 'Ittsu, the straight', why: 'Ittsu needs connected middle runs in one suit, which a terminal-and-honour collector cannot form. The discard pattern points to honroutou.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'sanankou',
        title: 'Sanankou: three concealed triplets',
        summary: 'Three of your four triplets formed without a pon. Two han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Ankou is a concealed triplet — three of a tile that you drew yourself rather than ponned from a discard. Sanankou is exactly three concealed triplets in the winning hand. Two han, open or closed overall (the triplets themselves are the concealed part).',
              'The fourth set can be anything — a run, a pair wait, or a fourth triplet. Three self-made triplets is the whole condition.',
            ],
            figures: [
              { tiles: '111m 555p 999s 234p 88m', caption: 'Three triplets formed from your own draws plus a run and a pair — sanankou, two han. Ponned triplets would not count.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'It usually arises in a toitoi-ish hand that happens to draw its third copies rather than pons them. A win by self-draw makes the completing triplet count as concealed; a win on a ron can still keep the three triplets concealed depending on the wait.',
              'Four concealed triplets is suuankou, a yakuman — sanankou is the three-triplet, two-han stop just below it.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Three triplets in the hand that you drew (not ponned) = sanankou, two han. Count how the triplets were formed, not just how many exist.'
            },
          },
          ...drills([
            {
              prompt: 'Your hand has four triplets. Two of them were completed by ponning an opponent’s discard; the other two came together entirely from tiles you drew. How many concealed triplets (ankou) do you have?',
              options: [
                { label: 'Two — only the triplets whose third copy you drew yourself count as ankou', correct: true, why: 'A triplet is concealed only if all three copies came from your own draws. Completing it by pon from a discard makes it an open meld, so the two ponned triplets do not count. With just two ankou the hand is one short of sanankou (three), though it may still be toitoi.' },
                { label: 'Four — a triplet is the same in the finished hand however you built it', why: 'How a triplet was formed matters: sanankou specifically counts concealed ones. A ponned triplet is exposed and can never become an ankou, even though it is still a triplet for toitoi.' },
                { label: 'Three — sanankou always finds three concealed triplets once you have four triplets', why: 'There is no automatic upgrade. Here exactly two triplets are self-drawn; you cannot round two up to three, so sanankou is not satisfied.' },
              ],
            },
            {
              prompt: 'You hold four triplets in your hand, but you ponned two of them from opponents and drew two. Do you score sanankou?',
              options: [
                { label: 'No — only two triplets are concealed; sanankou needs three', correct: true, why: 'The two ponned triplets are open melds, not ankou. With only two self-drawn triplets the hand falls one short of sanankou (three concealed); it likely scores toitoi for its four triplets instead.' },
                { label: 'Yes — any three of the four triplets count', why: 'Open pons do not count as concealed triplets. You cannot simply count any three; three must specifically be self-drawn ankou.' },
                { label: 'Yes, and it upgrades to suuankou', why: 'Suuankou requires FOUR concealed triplets (a yakuman), and you have only two. Opening any triplet moves the hand firmly away from suuankou.' },
              ],
            },
            {
              prompt: 'Four self-drawn triplets in a closed hand win on a single-tile wait. How does that relate to sanankou?',
              options: [
                { label: 'It is suuankou, the four-concealed-triplet yakuman — beyond sanankou', correct: true, why: 'Four ankou is the yakuman suuankou, which supersedes the two-han sanankou just as four triplets overshoot three. The three-triplet pattern is the ordinary stopping point; the four-self-drawn version is a limit hand.' },
                { label: 'It scores sanankou at two han', why: 'The engine awards the stronger yakuman, not the lesser two-han yaku, when four concealed triplets are present. Sanankou is what you get with three.' },
                { label: 'It cannot be a win because there is no pair', why: 'A single-tile (tanki) wait on the fourth triplet is exactly how suuankou wins; the four triplets plus the completed pair are fourteen legal tiles.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'sankantsu',
        title: 'Sankantsu: three kans',
        summary: 'Three quads declared in one hand. Two han — rare, because kans are rare.',
        steps: [
          {
            kind: 'teach',
            text: [
              'A kan uses all four copies of a tile and pulls a replacement from the dead wall. Sankantsu is simply three declared kans in a single hand. Two han, open or closed — the three quads are the condition, however you formed them.',
              'It is the quad cousin of sanankou: three of a kind of meld that is itself uncommon, which makes sankantsu one of the rarer two-han yaku.',
            ],
            figures: [
              { tiles: '1111m 5555p 9999s 234p', caption: 'Three declared quads plus a run and a pair across the hand — sankantsu, two han. (Each kan also takes a dead-wall replacement tile.)' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Because a kan needs all four copies of a tile, declaring three of them in one hand is a long-odds affair — each kan also exposes information and changes the dora, so players do not call them casually.',
              'Four kans in one hand is suukantsu, a yakuman. Sankantsu is the three-quad stop before it.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Three declared kans (closed or promoted) in the winning hand = sankantsu, two han. The fourth kan would escalate it to the suukantsu yakuman.'
            },
          },
          ...drills([
            {
              prompt: 'A hand reaches the finish with three four-of-a-kind melds, each formed by declaring a kan and taking a replacement from the dead wall. What is it?',
              options: [
                { label: 'Sankantsu — three quads', correct: true, why: 'Three declared kans in one hand, however they were formed, is sankantsu for two han. Each kan pulls its own dead-wall replacement, which is part of why reaching three is so unusual.' },
                { label: 'Sanankou — three concealed triplets', why: 'Sanankou counts self-drawn TRIPLETS; this hand has three full four-of-a-kind KAN declarations, which is a different pattern entirely.' },
                { label: 'Toitoi — all triplets', why: 'Three pons alone would lean toward toitoi, but three four-of-a-kind quads satisfy the specific sankantsu count, which scores separately.' },
              ],
            },
            {
              prompt: 'Why do players almost never actually score sankantsu, even though the rule is simple?',
              options: [
                { label: 'Each kan uses all four copies of a tile, so three quads in one hand means collecting twelve specific tiles — and players avoid declaring kans', correct: true, why: 'A kan consumes all four copies of one kind and pulls a dead-wall replacement. Three of them in a single hand is a long statistical shot, and declaring a kan also flips extra dora indicators that can help your opponents, so experienced players call kans sparingly.' },
                { label: 'Calling three kans ends the round early as a draw', why: 'Multiple kans do not cancel the round. The game tolerates up to four kans in a hand (the fourth completing suukantsu); rarity comes from gathering the tiles, not from the round aborting.' },
                { label: 'Only the dealer may score a kan-based yaku', why: 'Sankantsu and suukantsu are available to every seat. Kan yaku have no dealer restriction; they are simply unlikely to occur.' },
              ],
            },
            {
              prompt: 'You have three kans declared and form a fourth. What happens to the yaku?',
              options: [
                { label: 'It becomes suukantsu — the four-kan yakuman, supersedes sankantsu', correct: true, why: 'Four declared kans is suukantsu, a yakuman limit hand. The engine awards that instead of the two-han sankantsu; three quads is the ordinary stopping point and four is a rare limit.' },
                { label: 'It stays sankantsu, still two han', why: 'The fourth kan crosses into a yakuman, which supersedes the lesser count. Three quads score two han; four score the limit hand.' },
                { label: 'A fourth kan is illegal', why: 'A fourth kan is legal (the game tracks up to four); declaring it completes suukantsu and, as the last kan, exhausts the dead-wall supply.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'sanshoku-doukou',
        title: 'Sanshoku doukou: three-colour triplets',
        summary: 'The same-numbered triplet in all three suits. Two han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'The triplet counterpart to sanshoku doujun: three triplets of the same number, one in each suit — 333m, 333p, 333s. Two han, open or closed, because triplets are just as valid when ponned.',
              'Where the run version lines up shuntsu across suits, this lines up koutsu across suits.',
            ],
            figures: [
              { tiles: '333m 333p 333s 123m 55s', caption: 'Triplets of the 3 in man, pin and sou — three matching triplets across the three suits, sanshoku doukou.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'It is usually found inside a toitoi hand: a player triplet-heavy enough to have three matching triplets nearly always has the fourth triplet and pair for toitoi on top.',
              'Honours cannot participate because they have no suit or number — the three triplets must be numbered tiles sharing a rank.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'A triplet of number N in man, plus N in pin, plus N in sou = sanshoku doukou, two han. It is the triplet twin of three-colour runs and stacks with toitoi.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand scores sanshoku doukou?',
              options: [
                { label: '333m 333p 333s plus a 123m run and a 55s pair', correct: true, why: 'A triplet of the 3 in each of the three suits — matching number, all three colours — is sanshoku doukou, two han. The fourth set and pair complete the hand; this pairs naturally with toitoi when the fourth set is a triplet too.' },
                { label: '234m 234p 234s plus a 567m run and a pair', why: 'Matching runs across three suits is sanshoku DOUJUN (runs). Doukou specifically means the triplets (koutsu) line up — same number, three-of-a-kind each.' },
                { label: '333m 333m (six 3m) with two triplets and a pair', why: 'Two triplets cannot both be 333m — there are only four copies of the 3m. Doukou needs one triplet of the same rank in EACH suit, not two in one suit.' },
              ],
            },
            {
              prompt: 'Why does sanshoku doukou so often appear together with toitoi?',
              options: [
                { label: 'It is built from three triplets, which a toitoi-shaped hand is already collecting', correct: true, why: 'Sanshoku doukou contributes three koutsu; a hand with three triplets needs only one more triplet (or triplet-equivalent) and a pair to be all-triplets. The same pairs-and-pons approach produces both yaku at once.' },
                { label: 'They are the same yaku', why: 'They are distinct: doukou is about matching triplet ranks across suits, toitoi is about having four triplets total. They stack because a three-triplet hand is close to four.' },
                { label: 'Toitoi is required for doukou to count', why: 'There is no such requirement — three matching suit triplets plus a run and pair already scores doukou. They merely co-occur often.' },
              ],
            },
            {
              prompt: 'Can a dragon triplet be part of sanshoku doukou?',
              options: [
                { label: 'No — the three triplets must be numbered tiles with a shared rank', correct: true, why: '“Doukou” lines up the same NUMBER across the three numbered suits; honours have no suit and no rank, so a dragon triplet cannot be one of the three. It can still be its own yakuhai triplet elsewhere in the hand.' },
                { label: 'Yes, three dragon triplets count', why: 'Three dragon triplets is daisangen, a yakuman — a completely different (and vastly bigger) hand, not sanshoku doukou.' },
                { label: 'Yes, a dragon stands in for any one suit', why: 'Honours sit outside the suit system. The doukou yaku needs 333m/333p/333s-style matching triplets, not a dragon substitute.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'shousangen',
        title: 'Shousangen: the little three dragons',
        summary: 'Two dragon triplets and a pair of the third dragon. Two han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Shousangen (“little three dragons”) is two dragon triplets plus a pair of the third dragon — all three dragons present, with two completed as triplets and one as the head. Two han, on top of the yakuhai the two triplets carry.',
              'It is the near-miss of daisangen (three full dragon triplets), which is a yakuman.',
            ],
            figures: [
              { tiles: 'PPP FFF CC 123m 456m', caption: 'White and green triplets with a red-dragon pair — all three dragons accounted for. Shousangen, two han, plus two yakuhai.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Because the two dragon triplets are each yakuhai in their own right, shousangen already includes two dragon yaku plus its own two han — typically four han and up, even open.',
              'It forms when you collect all three dragons but only complete triplets of two of them. Draw the third copy of the paired dragon and it becomes the yakuman daisangen instead.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Two dragon triplets + a pair of the remaining dragon = shousangen, two han (with yakuhai stacked). Three dragon triplets = daisangen yakuman.'
            },
          },
          ...drills([
            {
              prompt: 'A hand has white-dragon and green-dragon triplets and a pair of red dragons (plus two ordinary sets). What is it?',
              options: [
                { label: 'Shousangen — little three dragons, two han', correct: true, why: 'All three dragons appear: two as triplets (white and green) and one as the pair (red). That is shousangen, two han, and the two triplets each carry their own yakuhai han on top.' },
                { label: 'Daisangen yakuman', why: 'Daisangen needs all three dragons as completed TRIPLETS. Here the red dragon is only a pair, so it is the lesser shousangen.' },
                { label: 'Just two yakuhai triplets', why: 'The two triplets are yakuhai, but a third dragon present as the pair also completes the shousangen pattern — an extra two han beyond the yakuhai.' },
              ],
            },
            {
              prompt: 'In that shousangen hand, you draw the third red dragon and make it a triplet. What does the hand become?',
              options: [
                { label: 'Daisangen — the three-dragon yakuman', correct: true, why: 'The red-dragon pair becomes a triplet, giving white, green and red all as triplets. Three dragon triplets is daisangen, a yakuman that supersedes shousangen — the rare upgrade from the “little” to the full dragon hand.' },
                { label: 'Stays shousangen', why: 'Completing the third dragon triplet crosses into the yakuman definition; the hand is re-valued as daisangen, not left as shousangen.' },
                { label: 'Toitoi only', why: 'It may be toitoi-shaped as well, but three dragon triplets is daisangen — the engine awards the yakuman and drops the lesser yaku.' },
              ],
            },
            {
              prompt: 'Your hand has white and green dragon triplets plus a red-dragon pair, with two ordinary runs. A friend says “that’s only the two-han little dragons, nothing special.” What is the hand actually worth before dora?',
              options: [
                { label: 'Around four han — two for shousangen plus one yakuhai han for each dragon triplet', correct: true, why: 'The two completed dragon triplets are each independently yakuhai, so they add two han on top of shousangen’s own two. That is four han before dora even on an open hand, which is why the “little” dragons are rarely small in payout.' },
                { label: 'Exactly two han — shousangen is a single flat yaku and the triplets count for nothing extra', why: 'Dragon triplets always carry their own yakuhai han, inside shousangen or out. The pattern does not swallow them; the yaku are counted and added together.' },
                { label: 'It is the yakuman daisangen because all three dragons are in the hand', why: 'Daisangen needs all three dragons as completed TRIPLETS. Here red is only a pair, so it stays shousangen — big, but not a limit hand.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'yaku-flushes',
    book: 0,
    title: 'Flushes and the three-han hands',
    kanji: '大物手',
    blurb: 'Half-flush, full flush and repeated runs — the hands worth reshaping for.',
    lessons: [
      {
        id: 'honitsu-codex',
        title: 'Honitsu: the half-flush',
        summary: 'One numbered suit plus honours, nothing of the other two suits. Three han closed, two open.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Honitsu is a hand built from one numbered suit plus honours — man tiles and dragons/winds, with not a single pin or sou anywhere. Three han closed, two open, and the honour triplets inside it add yakuhai on top.',
              'It is the loudest hand in mahjong: a player discarding whole suits tells the table exactly what they hold.',
            ],
            figures: [
              { tiles: '222m 789m 345m EEE FF', caption: 'Only man tiles and honours — no pin or sou at all. Honitsu, three han closed, plus the East and dragon yakuhai triplets.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Commit when you hold seven or eight tiles of one suit early, especially with a value-tile pair: the shape already points one way and the honour triplets pay for the reshaping.',
              'It is open-friendly (two han still, plus yakuhai) and is one of the handful of yaku worth melding toward. The discarded suits are the tell — and the tiles you can safely throw against them.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'One suit + honours, with the other two suits absent entirely = honitsu, three han closed / two open. A one-suit river is the tell in opponents.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is honitsu?',
              options: [
                { label: '222m 789m 345m with EEE and an FF pair', correct: true, why: 'Every numbered tile is man, and the only non-suit tiles are honours (East, dragon). Zero pin or sou — that is the half-flush, three han closed, with the two honour triplets stacking yakuhai.' },
                { label: '234m 456m 234p 234s with a pair', why: 'All three suits are present, so it cannot be a flush. That is a sanshoku run hand instead.' },
                { label: '222m 345m 789m with a 11m pair, no honours', why: 'All man and NO honours at all is the stricter full flush, chinitsu (six han), not honitsu. Honitsu keeps the option of honours.' },
              ],
            },
            {
              prompt: 'Across the table, an opponent discards only pin and sou and has ponned an East. What are they building — and what is safe to throw them?',
              options: [
                { label: 'A man honitsu — your pin and sou tiles are safe against them', correct: true, why: 'A river of the two suits they are not using, plus an honour pon, is the textbook honitsu tell. They can only win on man or honours, so pin and sou are live-safe for you; man tiles and value winds are the dangerous feed.' },
                { label: 'Tanyao — throw them man tiles', why: 'Tanyao would collect simples of any suit and avoid honours; this player rejects two whole suits and pons winds, which is a flush, and feeding man tiles is the worst thing to do.' },
                { label: 'Nothing readable yet', why: 'Rejecting two suits plus an honour call by the mid-game is unambiguous. The half-flush is the most readable yaku at the table.' },
              ],
            },
            {
              prompt: 'Your man honitsu includes an East triplet (the round wind) and a white-dragon triplet, with two dora, and you win open. The flush alone would be two han open. Why is the payout much larger than that?',
              options: [
                { label: 'Each honour triplet adds its own yakuhai han, and your dora tend to sit in the one suit you kept', correct: true, why: 'The East and white triplets are each yakuhai for another han, and because the hand is all man, man dora you picked up count directly. Flush plus two yakuhai plus two dora is six han — that stacking is how a “two-han open” hand clears mangan.' },
                { label: 'Opening a half-flush upgrades it to a limit hand', why: 'Honitsu is three han closed and only two open — opening never escalates a flush to yakuman. The size here comes from the yaku stacked on it, not from any limit bonus for being melded.' },
                { label: 'The flush multiplies the value of every run it contains', why: 'There is no per-run multiplier. Mahjong adds yaku han together rather than multiplying sets; the extra value is the stacked yakuhai and dora on top of the flush’s own han.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'chinitsu-codex',
        title: 'Chinitsu: the full flush',
        summary: 'Every tile from a single suit — no honours at all. Six han closed, five open.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Chinitsu is the pure flush: fourteen tiles all from one numbered suit, with not a single honour. Six han closed, five open — a mangan on its own before anything else stacks.',
              'It is honitsu with the honours removed. Because it commits you to one suit so completely, it is usually a deliberate early decision off a suit-heavy deal.',
            ],
            figures: [
              { tiles: '222m 345m 789m 123m 11m', caption: 'Every tile is man — no pin, no sou, no winds or dragons. Chinitsu, six han closed.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'The same one-suit river that signals honitsu signals chinitsu when no honour appears at all — and against both, the other two suits are safe to discard.',
              'It suppresses honitsu: when the hand is one suit with no honours, the higher flush scores. It pairs with ittsu naturally, since a flush often contains the 1-to-9 runs within the suit.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'One suit and absolutely nothing else — no honours — = chinitsu, six/five han. One suit plus honours is the smaller honitsu; ittsu often stacks inside.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is chinitsu?',
              options: [
                { label: '222m 345m 789m 123m with an 11m pair', correct: true, why: 'Every tile is man: four groups and a pair all in one suit with zero honours. That is chinitsu, six han closed — a guaranteed mangan on its own, and the 123-789 within it may also make ittsu.' },
                { label: '222m 789m 345m with EEE and an FF pair', why: 'One suit but with honour triplets is honitsu, the half-flush (three han). Chinitsu requires NO honours anywhere in the hand.' },
                { label: '123m 456m 789p 234s with a pair', why: 'Three suits are present, so this is not any flush. The pure flush demands all fourteen tiles share a single suit.' },
              ],
            },
            {
              prompt: 'Your opponent is visibly discarding only pin and sou. At first a dragon is visible in their hand, so you read half-flush. Later the dragon is gone and no honour appears at all. How does your read — and the danger — change?',
              options: [
                { label: 'They have tightened into a full flush, chinitsu: same safe suits for you, but a much bigger hand to avoid feeding', correct: true, why: 'A one-suit hand with honours is honitsu (three han); the moment no honour remains anywhere it becomes the pure chinitsu (six han). The tiles that are safe to discard do not change — pin and sou are still dead against them — but the penalty for feeding a man tile roughly doubles.' },
                { label: 'Losing the dragon means the flush has broken and they are no longer dangerous', why: 'Discarding the dragon is a sign the hand committed harder to one suit, not that it fell apart. A flush needs no honours, so shedding them points to the higher chinitsu rather than to giving up.' },
                { label: 'Honitsu and chinitsu both score, so the dragon they discarded cost them nothing', why: 'The two flushes are the same suit-commitment at two strictness levels and do not stack; the pure flush replaces the half-flush. Which yaku applies depends entirely on whether honours remain.' },
              ],
            },
            {
              prompt: 'A flush-leaning hand has only man tiles except one green dragon triplet. What is it, and could drawing dragons change that?',
              options: [
                { label: 'It is honitsu now; losing the honours would not apply, but the dragon yakuhai stacks', correct: true, why: 'One suit plus an honour triplet is honitsu (three han), and the green-dragon triplet adds a yakuhai han — the flush cannot become chinitsu while a dragon remains, but the yakuhai compensates. Chinitsu needs the hand to shed every honour.' },
                { label: 'It is chinitsu, six han', why: 'Chinitsu excludes honours entirely. The green dragon makes this a half-flush, honitsu, regardless of how many man tiles there are.' },
                { label: 'The dragon triplet breaks the flush completely', why: 'A flush happily coexists with honours — that is what honitsu IS. The dragon triplet does not invalidate the flush; it adds yakuhai.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'ryanpeikou',
        title: 'Ryanpeikou: twice the identical run',
        summary: 'Two pairs of the exact same run (four runs, two duplicated). Closed only, three han.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Peikou is two identical runs — 345m twice, which needs 345m and another 345m. Ryanpeikou is that done twice: four runs made up as two pairs of duplicates, such as 345m twice and 234p twice. Three han, closed only.',
              'It requires the copies: a duplicated run uses six tiles of three adjacent kinds, and there are only four copies of each tile, so the pattern is specific.',
            ],
            figures: [
              { tiles: '345m 345m 234p 234p 55s', caption: 'The 345m run twice and the 234p run twice — two duplicated run-pairs, ryanpeikou, three han closed.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Ryanpeikou and chiitoitsu are mutually exclusive: two duplicated runs could be misread as pairs, but the hand is decomposed as runs here. A single pair of identical runs (one peikou) deliberately scores nothing in this ruleset; only the doubled ryanpeikou counts.',
              'It only works on a closed, four-run hand, so it tends to be recognised rather than chased.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Four runs consisting of two pairs of identical runs (the same run twice, twice) = ryanpeikou, three han, closed. One duplicated run alone scores nothing here.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand scores ryanpeikou?',
              options: [
                { label: '345m 345m 234p 234p with a 55s pair', correct: true, why: 'The hand is four runs, and they form two duplicated pairs: 345 twice in man and 234 twice in pin. That is ryanpeikou, three han closed — the runs themselves are pinfu-shaped as well.' },
                { label: '11m 33m 55p 77p 99p 22s FF', why: 'Seven pairs is chiitoitsu. Ryanpeikou duplicates RUNS (sequences), not isolated pairs; seven pairs of single tiles is the other pattern.' },
                { label: '345m 234p 234p 789s with a pair', why: 'Only one run is duplicated (the 234p twice), with two other different runs. A single duplicated run (one peikou) scores nothing in this ruleset; ryanpeikou needs TWO duplicated pairs.' },
              ],
            },
            {
              prompt: 'A hand contains the run 234s twice and otherwise three unrelated runs and a pair. Does it score ryanpeikou?',
              options: [
                { label: 'No — one duplicated run is a single peikou, which scores nothing here', correct: true, why: 'Ryanpeikou means “two peikou”: two SEPARATE pairs of identical runs. One duplicated run (234s twice) is just iipeiko, deliberately not counted in this yaku set; you need another duplicated pair of runs as well.' },
                { label: 'Yes, three han', why: 'A lone duplicated run would be iipeiko, not ryanpeikou, and this ruleset awards only the doubled ryanpeikou — so it scores nothing for that one duplication.' },
                { label: 'Yes, but one han', why: 'There is no half-credit here: single peikou is intentionally absent from the yaku list, and ryanpeikou is a three-han closed yaku that requires both duplications.' },
              ],
            },
            {
              prompt: 'Can an open hand score ryanpeikou after a call?',
              options: [
                { label: 'No — ryanpeikou, like pinfu, is closed-only', correct: true, why: 'The repeated-run pattern is a concealed-hand yaku; melding opens the hand and forfeits it. It is recognised in a closed four-run hand, not built by calling.' },
                { label: 'Yes, for two han', why: 'Ryanpeikou does not survive a call — it is three han closed and not available open at all, unlike sanshoku or ittsu.' },
                { label: 'Yes, if the duplicated runs are melded', why: 'Melded runs are open melds; the concealed ryanpeikou pattern requires the runs to be in the closed hand. Calling disqualifies it.' },
              ],
            },
          ]),
        ],
      },
    ],
  },

  // =========================================================================
  {
    id: 'yaku-yakuman',
    book: 0,
    title: 'The yakuman: limit hands',
    kanji: '役満',
    blurb: 'The rarest, highest-value patterns — each worth the limit, and a yakuman suppresses all other yaku.',
    lessons: [
      {
        id: 'kokushi',
        title: 'Kokushi musou: the thirteen orphans',
        summary: 'One of each terminal and honour, plus a duplicate of one of them. Closed yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Kokushi musou is a special closed hand that ignores the usual structure: one copy of all thirteen terminal and honour kinds — the 1 and 9 of each suit plus the seven winds and dragons — with a duplicate of one of those thirteen as the fourteenth tile.',
              'It waits on thirteen tiles at tenpai (twelve singles plus the duplicated one’s mates), one of the broadest waits in the game.',
            ],
            figures: [
              { tiles: '19m 19p 19s E S W N P F C 1m', caption: 'The thirteen orphans, each terminal and honour once, with a second 1m — a completed kokushi musou, closed yakuman.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'It is the only “all outside tiles” path that uses honours and terminals singly rather than as triplets, and it is strictly closed. The thirteen-way wait is the consolation for a hand that discards almost everything it draws.',
              'Like all yakuman it suppresses every ordinary yaku — a kokushi win pays the limit and the other patterns are moot.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'All thirteen terminal/honour kinds present once, plus a duplicate of one = kokushi musou. At tenpai it waits on up to thirteen different tiles.'
            },
          },
          ...drills([
            {
              prompt: 'Which winning hand is kokushi musou?',
              options: [
                { label: 'One each of 1m 9m 1p 9p 1s 9s E S W N P F C, with a second 1m', correct: true, why: 'All thirteen terminal-and-honour kinds once, with one of them duplicated to fourteen tiles, is the thirteen orphans — kokushi musou, a closed yakuman. It cannot contain any middle tile (2–8).' },
                { label: '111m 999m PPP FFF with a 11p pair', why: 'Terminals and honours, but only five kinds arranged as triplets — that is honroutou (and toitoi). Kokushi needs all THIRTEEN terminal/honour kinds present.' },
                { label: '123m 456m 789p 234s with a pair', why: 'Full of middle simples and missing almost all the honour/terminal kinds. That is an ordinary run hand, nowhere near the orphans.' },
              ],
            },
            {
              prompt: 'How many tiles can a tenpai kokushi hand be waiting on?',
              options: [
                { label: 'Up to thirteen — any of the terminal/honour kinds it is missing or pairing', correct: true, why: 'A kokushi one tile out is waiting to complete its set of thirteen orphans; with twelve kinds held it can draw the missing kind, and the duplicated slot gives additional mates. That thirteen-way wait is famously broad even though the hand is rigid.' },
                { label: 'Exactly one', why: 'A single-tile wait describes a tanki in a normal hand. Kokushi’s wait spans the whole set of terminal and honour tiles it still needs.' },
                { label: 'None — it cannot be tenpai', why: 'It can be tenpai like any hand; the thirteen-orphans wait is legal and is one reason the hand, though rigid, occasionally gets there.' },
              ],
            },
            {
              prompt: 'You are one tile from the thirteen orphans, then you pon a discarded terminal to speed it up. What effect does that call have on kokushi musou?',
              options: [
                { label: 'It destroys the yaku — kokushi is strictly closed, like chiitoitsu', correct: true, why: 'Kokushi must be completely concealed; a single pon or chi breaks it. The orphans also have no triplet structure to build by calling, so the hand is meant to be assembled tile by tile from your own draws.' },
                { label: 'None — ponned terminals count toward the thirteen kinds', why: 'An open meld can never be part of kokushi. The winning hand has to be concealed, and a pon marks the hand as open regardless of which tile was called.' },
                { label: 'It still wins but only as an ordinary limit hand, not yakuman', why: 'There is no partial kokushi. A hand with any call simply has no orphan yaku at all; it must find its value in ordinary open-hand patterns instead.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'suuankou',
        title: 'Suuankou: four concealed triplets',
        summary: 'All four triplets drawn by yourself, won on the single-tile wait. Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Suuankou is four CONCEALED triplets — every triplet completed from your own draws, none ponned — with the hand won on a single-tile wait. It is the yakuman one notch above sanankou.',
              'Closed triplets are hard because a triplet naturally wants to pon the third copy; suuankou refuses every such call and draws its own way there.',
            ],
            figures: [
              { tiles: '111m 555p 999s 777s 22m', caption: 'Four self-drawn triplets and a 2m pair, every triplet formed without a pon — suuankou yakuman on a single-tile wait.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'The wait matters: winning the four-concealed-triplet hand by completing a triplet off your own draw on a tanki (or the specific sanctioned waits) makes it suuankou; winning it on a discard can leave it as the lesser pattern depending on the wait.',
              'It is the all-triplet closed hand that never calls — the rarest way to a four-triplet finish.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Four triplets, every one self-drawn (zero pons), won on the single-tile wait = suuankou. Pon any triplet and it falls to sanankou/toitoi territory.'
            },
          },
          ...drills([
            {
              prompt: 'What makes a four-triplet hand suuankou rather than a big toitoi?',
              options: [
                { label: 'All four triplets are concealed — formed by your own draws, none ponned', correct: true, why: 'Toitoi and suuankou share the four-triplet shape, but suuankou requires every triplet to be an ankou (self-drawn). A hand that ponned even one triplet cannot be suuankou and falls back to the ordinary two-han toitoi.' },
                { label: 'It contains a dragon triplet', why: 'Dragon triplets add yakuhai but do not create suuankou. The distinction is purely how the triplets were formed — concealed vs. called.' },
                { label: 'It is won on a two-sided wait', why: 'A triplet hand has no runs and therefore no two-sided wait. Suuankou wins on a single-tile (tanki) type wait after drawing its triplets.' },
              ],
            },
            {
              prompt: 'You have four triplets but ponned one of them from an opponent. What can it score?',
              options: [
                { label: 'Not suuankou — at most toitoi (and sanankou if three triplets are self-drawn)', correct: true, why: 'One pon means only three concealed triplets, so the yakuman suuankou is impossible. The hand scores toitoi (four triplets, two han) and, because three triplets are still self-drawn, sanankou (two han) as well.' },
                { label: 'Suuankou as long as three triplets are yours', why: 'Suuankou needs all FOUR triplets concealed. A single pon removes it from yakuman contention, regardless of the other three.' },
                { label: 'Nothing — ponned triplets invalidate wins', why: 'Ponned triplets are perfectly legal and the hand still wins; it just earns ordinary yaku (toitoi/sanankou) rather than the limit hand.' },
              ],
            },
            {
              prompt: 'You hold three triplets you drew yourself, plus a pair, and you are waiting to draw the third copy that makes your fourth self-made triplet. A rival points out you could just pon the next matching discard and win faster. Why might you decline and keep drawing?',
              options: [
                { label: 'Poning the last triplet caps the hand at toitoi/sanankou; drawing it keeps the four-concealed-triplet yakuman (suuankou) alive', correct: true, why: 'Suuankou needs all four triplets formed from your own draws. A single pon makes one triplet open, dropping the hand to ordinary two-han toitoi (plus sanankou at most). Refusing the call is slow, but it is the only way to preserve the limit hand.' },
                { label: 'Poning is illegal once you already have three triplets', why: 'Poning remains legal throughout; three triplets does not lock the hand. The cost of the pon is strategic — it gives up suuankou — not a rule against calling.' },
                { label: 'A pon would make the hand worth less because called triplets score fewer fu', why: 'The fu difference is minor; the decisive loss is the yakuman itself. One pon changes the hand from a limit suuankou to an ordinary toitoi, which is far more than a fu adjustment.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'daisangen',
        title: 'Daisangen: the great three dragons',
        summary: 'Triplets of all three dragons — white, green and red. Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Daisangen is a completed triplet of every dragon — white (P), green (F) and red (C). Three dragon koutsu plus any fourth set and pair. Yakuman, and one of the most recognisable limit hands.',
              'Every dragon triplet is yakuhai on its own, so the hand is already enormous before it reaches the full three.',
            ],
            figures: [
              { tiles: 'PPP FFF CCC 123m 55m', caption: 'Triplets of white, green and red dragons — daisangen, a yakuman — with a run and a pair rounding it out.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Shousangen (two dragon triplets plus the third as a pair) is the two-han stepping stone; completing that pair into the third triplet crosses into daisangen. Opponents who see two dragons ponned learn to stop feeding the third.',
              'Because dragons are honours that never appear in runs, a dragon collector is easy to read — and extremely dangerous late.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Three completed dragon triplets = daisangen yakuman. Two dragon triplets plus a dragon pair is the lesser shousangen.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is daisangen?',
              options: [
                { label: 'PPP FFF CCC plus a 123m run and a 55m pair', correct: true, why: 'Triplets of white, green and red dragons — all three dragons as koutsu — is daisangen, a yakuman. The fourth set and pair can be anything; the three dragon triplets are the condition.' },
                { label: 'PPP FFF CC plus two ordinary sets', why: 'Two dragon triplets and a red-dragon PAIR is shousangen, the two-han “little” version. Daisangen needs the red dragon as a third triplet.' },
                { label: 'EEE SSS WWW plus a set and pair', why: 'Three wind triplets may point toward daisuushii/shousuushi territory, not dragons. Daisangen is specifically the three DRAGONS.' },
              ],
            },
            {
              prompt: 'Your hand has white and green triplets and a red-dragon pair. Someone discards a red dragon. What is at stake?',
              options: [
                { label: 'Ponning it turns shousangen into the daisangen yakuman', correct: true, why: 'Completing the red-dragon pair into a triplet gives all three dragon triplets — crossing from two-han shousangen to the limit hand daisangen. This is why opponents stop discarding dragons once two are ponned.' },
                { label: 'Nothing changes — it stays shousangen', why: 'The third dragon triplet escalates the hand to a yakuman. The discard is the difference between a good hand and a limit hand.' },
                { label: 'You should never pon a dragon', why: 'The dragon pon is the highest-value call in the game here: it completes a yakuman. Passing would be the error.' },
              ],
            },
            {
              prompt: 'How do opponents typically read a daisangen in progress?',
              options: [
                { label: 'Two dragon pons make it obvious — dragons are honours that never appear in runs', correct: true, why: 'Two exposed dragon triplets can only mean a dragon hand, and there is no run-making reason to hold dragons. Alert players stop discarding any dragon and play the third dragon safe once shousangen/daisangen becomes possible.' },
                { label: 'It is completely invisible until the win', why: 'Dragon pons are public melds; two of them shout the yaku. Dragon-heavy hands are among the most readable at the table.' },
                { label: 'A one-suit discard river hides it', why: 'The tell is the dragon melds themselves, not the river. Dragons are not tiles you would keep for a flush, so two dragon triplets point straight at daisangen/shousangen.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'four-winds',
        title: 'Shousuushi and daisuushii: the four winds',
        summary: 'Three wind triplets plus a wind pair (small) or four wind triplets (great). Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'The winds form two limit hands. Shousuushi (“small four winds”) is three wind triplets plus a pair of the fourth wind. Daisuushii (“great four winds”) is four wind triplets. Both are yakuman.',
              'Because the winds are exactly E, S, W, N, these hands require holding most of the wind tiles in play — extremely rare.',
            ],
            figures: [
              { tiles: 'EEE SSS WWW NN 123m', caption: 'East, South and West triplets with a North pair — shousuushi, a yakuman. Turn that North pair into a triplet and it is daisuushii.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Each wind triplet is yakuhai when it matches the round or seat, so a wind-collecting hand stacks value long before it reaches the limit. A single wind used only as the head keeps it at shousuushi; four full wind triplets is the great version.',
              'They are the wind analogues of shousangen/daisangen, but rarer because there are four winds rather than three dragons.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Three wind triplets + the fourth wind as the pair = shousuushi. Four wind triplets = daisuushii. Both yakuman; the valued winds also carry yakuhai.'
            },
          },
          ...drills([
            {
              prompt: 'Which hand is shousuushi (small four winds)?',
              options: [
                { label: 'EEE SSS WWW triplets with an NN pair and a 123m run', correct: true, why: 'Three wind triplets (East, South, West) and the fourth wind (North) held as the pair is shousuushi — a yakuman. The head being the remaining wind is exactly the “small” form.' },
                { label: 'EEE SSS WWW NNN four wind triplets', why: 'All four winds as triplets is daisuushii, the great four winds — also a yakuman, but the strictly larger pattern.' },
                { label: 'PPP FFF CCC with a run and pair', why: 'Three dragon triplets is daisangen. The wind yaku use East/South/West/North, not the dragons.' },
              ],
            },
            {
              prompt: 'What upgrades shousuushi into daisuushii?',
              options: [
                { label: 'Completing the fourth wind pair into a triplet', correct: true, why: 'Shousuushi has three wind triplets and one wind pair; drawing or ponning the fourth copy to make that pair a triplet yields four wind triplets — daisuushii, the greater limit hand.' },
                { label: 'Adding a dragon triplet', why: 'Dragons do not affect the four-wind yaku, which is defined entirely by E/S/W/N. The upgrade comes from the fourth WIND triplet.' },
                { label: 'Winning on a self-draw', why: 'Both wind hands are yakuman regardless of draw or discard source. Only the number of completed wind triplets separates them.' },
              ],
            },
            {
              prompt: 'Aiming at a four-wind hand, you notice your three opponents each seem to be keeping a different wind — one holds East as their seat wind, one South, and so on. Why does that make the wind yakuman even harder to complete than daisangen?',
              options: [
                { label: 'You need four wind triplets rather than three dragon ones, and each wind is someone’s valued seat/round tile, so copies rarely reach the discards you can pon', correct: true, why: 'Daisangen gathers three kinds nobody else has a personal reason to hold; the winds are each valuable to a particular seat, so players cling to them. Collecting all four wind triplets (or three plus a pair) means pulling tiles that opponents are least likely to throw.' },
                { label: 'Wind tiles cannot be ponned the way dragons can', why: 'Winds are ponned exactly like dragons — triplets of honours are all called the same way. The scarcity comes from how tightly the other players hold their valued winds, not from any rule on calling.' },
                { label: 'Wind triplets score nothing until the full yakuman forms', why: 'A valued wind triplet is yakuhai for a han just like a dragon triplet, long before any yakuman. The hand stacks value while it grows; the difficulty is the number and supply of wind tiles.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'tsuuiisou',
        title: 'Tsuuiisou: all honours',
        summary: 'Fourteen tiles that are only winds and dragons — no numbered tile at all. Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Tsuuiisou is a hand made entirely of honour tiles — winds and dragons, zero numbered tiles. It is honroutou with the terminals removed: every group is an honour triplet or pair, so it is always toitoi or seven-pairs in shape. Yakuman.',
              'A pure-honour hand has no possible runs and very few kinds (only seven), which makes it rigid but unmistakable.',
            ],
            figures: [
              { tiles: 'PPP FFF CCC EEE SS', caption: 'Three dragon triplets, an East triplet and a South pair — every tile an honour. Tsuuiisou yakuman (and it also contains daisangen).' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'It absorbs several smaller patterns — daisangen and the wind yaku frequently sit inside it — but tsuuiisou as a yakuman supersedes them. An opponent who only ever keeps and pons honours is building it.',
              'Against it, every numbered tile is perfectly safe; the only danger is discarding a wind or dragon.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Not a single numbered tile — winds and dragons only = tsuuiisou yakuman. Numbers are safe to throw against a pure-honour collector.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is tsuuiisou?',
              options: [
                { label: 'PPP FFF CCC EEE with an SS pair', correct: true, why: 'Every tile is a dragon or a wind — there are no numbered tiles at all. That all-honour hand is tsuuiisou, a yakuman (and the three dragon triplets inside also make daisangen, which the yakuman supersedes).' },
                { label: '111m 999m PPP FFF with a 11p pair', why: 'Terminals are present (1m, 9m, 1p), so it is honroutou, not tsuuiisou. Tsuuiisou excludes ALL numbered tiles, terminals included.' },
                { label: '123m 456m 789p 234s with a pair', why: 'Entirely numbered with middle tiles — an ordinary run hand, nowhere near the all-honour requirement.' },
              ],
            },
            {
              prompt: 'An opponent repeatedly pons dragons and winds and discards every number tile. What can you safely discard?',
              options: [
                { label: 'Any numbered tile — they cannot win on numbers', correct: true, why: 'A pure-honour (tsuuiisou) collector only completes winds and dragons, so every numbered tile — even the most dangerous-looking middle tile — is safe against them. Hold back your dragons and valued winds; the numbers are free to throw.' },
                { label: 'Dragons and winds — they have enough already', why: 'Exactly backwards: honours are the only tiles that can complete their hand, so feeding a dragon or wind risks the yakuman. Numbers are what they cannot use.' },
                { label: 'Only terminals are safe', why: 'Terminals are NUMBERED tiles and are safe, but so are every middle tile and run tile. The safe class is “all numbers”, not just terminals.' },
              ],
            },
            {
              prompt: 'A beginner looks at a completed tsuuiisou and asks why the player never formed a “run” of winds like East-South-West. What is the correct answer?',
              options: [
                { label: 'A run needs three consecutive NUMBERED ranks of one suit; winds and dragons have no rank at all, so honours can only make triplets and pairs', correct: true, why: 'Runs (sequences) exist only within a numbered suit — e.g. 2-3-4 of sou. The winds are not ordered numbers; East, South, West do not form a sequence any more than three different dragons do. That is why an all-honour hand is always triplets (toitoi) or pairs (chiitoitsu).' },
                { label: 'Honour sequences are allowed but they are worth too little to bother with', why: 'There is no such meld as an honour run — the game offers no set for sequenced winds or dragons. It is not a matter of value; the combination simply is not a legal set.' },
                { label: 'Yakuman hands are banned from containing runs by the limit rules', why: 'The absence of runs is structural to honours, not a yakuman restriction. Any all-honour hand — even before it becomes tsuuiisou — can only be built from triplets and pairs.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'chinroutou',
        title: 'Chinroutou: all terminals',
        summary: 'Fourteen tiles that are only 1s and 9s — no simples, no honours. Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Chinroutou is the all-terminal hand: every tile is a 1 or a 9, with no middle simples and no honours. Like the all-honour hand it can only be triplets or pairs in shape, since terminals cannot make ordinary runs. Yakuman.',
              'It is honroutou with the honours stripped out — and because only six kinds exist (the 1 and 9 of three suits), it is exceptionally rigid.',
            ],
            figures: [
              { tiles: '111m 999m 111p 999s 11s', caption: 'Only 1s and 9s across all three suits — chinroutou yakuman. (Any single middle tile or honour would move it down to honroutou.)' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'It is rarer than tsuuiisou because there are no value triplets (yakuhai) to attract the tiles; the hand is made purely from the six terminal kinds. As with all-honour, an opponent collecting only 1s and 9s telegraphs it.',
              'The one-tile middle tiles are completely safe against it; only the terminals can feed.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Every tile a 1 or a 9 — terminals only, no honours = chinroutou yakuman. Mix in honours (and terminals) and it drops to honroutou.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is chinroutou?',
              options: [
                { label: '111m 999m 111p 999p with an 11s pair', correct: true, why: 'Every tile is a terminal — 1m, 9m, 1p, 9p and a 1s pair — with no middle tile and no honour. That all-terminal hand is chinroutou, a yakuman, and toitoi in shape.' },
                { label: '111m 999m PPP FFF with a 11p pair', why: 'Contains dragon honours alongside terminals. All terminals-or-honours is honroutou (two han); chinroutou requires terminals with no honours at all.' },
                { label: '123m 789m 123p 789p with an EE pair', why: 'Holds middle tiles (2,3,7,8) in edge runs and an honour pair — that is chanta, not chinroutou. The all-terminal yaku permits no simples.' },
              ],
            },
            {
              prompt: 'An opponent discards all their middle tiles early and holds only 1s and 9s. Against a possible chinroutou, which of your tiles is DANGEROUS?',
              options: [
                { label: 'Only your terminals — the 1s and 9s', correct: true, why: 'Chinroutou can only complete triplets or pairs of terminal tiles. Every middle tile (2–8) is useless to that hand and safe to discard; a stray 1 or 9 is the feed that could pay the yakuman, so keep those back.' },
                { label: 'Your dragon and wind tiles', why: 'Honours cannot appear in chinroutou (no honours allowed), so dragons and winds are safe against this hand. Those would matter against tsuuiisou instead.' },
                { label: 'Middle simples like 4s and 5s', why: 'Middle tiles are precisely what the all-terminal hand rejects. They are the safest discards available against chinroutou.' },
              ],
            },
            {
              prompt: 'You see one player pons dragons and winds into honroutou while another silently gathers only 1s and 9s. Both avoid middle tiles, but why is the second player chasing something far rarer?',
              options: [
                { label: 'The all-terminal hand can use just six kinds (the 1 and 9 of each suit) with no valued honour triplets to attract tiles, while honroutou also has seven honour kinds', correct: true, why: 'Honroutou leans on dragons and winds that get ponned freely and carry yakuhai value; chinroutou must assemble fourteen tiles from only six terminal kinds with no value triplets to anchor them. That narrow pool with no “draw” for the tiles is exactly why the pure-terminal version is a yakuman and the terminal-or-honour one is only two han.' },
                { label: 'Terminal tiles are rarer in the wall than honour tiles', why: 'Every tile kind — terminal, honour or simple — has four copies in the wall. The difference is how many kinds the hand may use and whether other players discard them, not the count per kind.' },
                { label: 'Honroutou is the yakuman and chinroutou is the smaller hand', why: 'It is the reverse: restricting to terminals only (chinroutou) is the stricter, rarer yakuman; allowing honours as well (honroutou) is the easier two-han hand.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'ryuuiisou',
        title: 'Ryuuiisou: the all-green hand',
        summary: 'Only the green tiles — 2s 3s 4s 6s 8s and the green dragon. Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Ryuuiisou is the “green” hand, built exclusively from the tiles that print entirely in green bamboo and the green dragon: the 2s, 3s, 4s, 6s and 8s of sou, plus Hatsu (F). No other tile may appear. Yakuman.',
              'It is a colour-themed restriction rather than a shape one, so it can include runs (345-style runs are impossible across the gaps, but 234s works) as well as green-dragon triplets.',
            ],
            figures: [
              { tiles: '234s 234s 888s 666s FF', caption: 'Green sou tiles (2,3,4,6,8) and the green dragon only — ryuuiisou yakuman. The two 234s runs sit among the green triplets and pair.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'The set of legal tiles is small and specific, so the hand is recognised from a deal that is heavy on sou 2-3-4-6-8 and Hatsu. It frequently carries a F triplet (yakuhai) and a honitsu-like single-suit lean.',
              'Every non-green tile — including the red and white dragons, the 1s 5s 7s 9s, and all man/pin — is safe against it.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Only sou 2, 3, 4, 6, 8 and the green dragon = ryuuiisou yakuman. The 5s and the man/pin suits are excluded, so they are safe discards against it.'
            },
          },
          ...drills([
            {
              prompt: 'Which tiles may a ryuuiisou hand contain?',
              options: [
                { label: 'Only 2s 3s 4s 6s 8s and the green dragon (Hatsu)', correct: true, why: 'The all-green hand is limited to the tiles that print fully green: the 2, 3, 4, 6 and 8 of sou plus the green dragon F. Any other tile — including 5s and the red/white dragons — breaks the yaku.' },
                { label: 'All sou tiles 1 through 9', why: 'The 1s, 5s, 7s and 9s are not in the green-tile set. Only the five green sou ranks plus Hatsu qualify; this is a specific colour restriction.' },
                { label: 'Any simple tiles plus the green dragon', why: 'It is not an all-simples hand. Tanyao allows every 2–8 tile; ryuuiisou allows only the specific green-printing tiles, mainly in sou.' },
              ],
            },
            {
              prompt: 'A hand of green sou tiles with a triplet of green dragons also forms 234s twice. Does it qualify?',
              options: [
                { label: 'Yes — 234s uses green tiles and the F triplet is green too; that is ryuuiisou', correct: true, why: 'The runs 234s use 2s/3s/4s (all green), and the green dragon is the permitted honour. As long as every tile is in the green set — which duplicated 234s and F triplets are — the hand scores ryuuiisou.' },
                { label: 'No, runs are forbidden in colour yaku', why: 'Unlike all-honour or all-terminal, ryuuiisou can include runs, because some green tiles are consecutive (234s). The green-dragon triplet is allowed as the honour.' },
                { label: 'No, duplicated runs make it chiitoitsu', why: 'Duplicated runs are still runs; the hand is scored as ryuuiisou from its tile set. Chiitoitsu requires pairs, which is not what 234s duplicated runs are here.' },
              ],
            },
            {
              prompt: 'Against an opponent who keeps only green sou and Hatsu, which tile is completely safe?',
              options: [
                { label: 'A 5m — any tile outside the green set is un-winnable for them', correct: true, why: 'Ryuuiisou can only finish on 2s/3s/4s/6s/8s/F. A 5m is nowhere near that set and cannot be part of their win; the same goes for 1s/5s/7s/9s, all man/pin, and the red/white dragons. Non-green tiles are safe.' },
                { label: 'An 8s', why: '8s is one of the five green sou tiles and can complete their triplets or pair — it is live ammunition against ryuuiisou, not safe.' },
                { label: 'A green dragon', why: 'Hatsu is the one honour ryuuiisou explicitly includes and is often its yakuhai triplet; feeding it is dangerous.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'chuuren',
        title: 'Chuuren poutou: the nine-lantern hand',
        summary: '111-2345678-999 of one suit plus one spare of that suit. Closed yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Chuuren poutou is a closed single-suit hand with the fixed skeleton 111, then 2-3-4-5-6-7-8 once each, then 999 — thirteen tiles covering the suit — plus a fourteenth tile that is any extra tile of that same suit.',
              'The canonical thirteen-way wait (waiting on any of the suit’s nine tiles to be the spare) is the famous version.',
            ],
            figures: [
              { tiles: '111m 2345678m 999m 5m', caption: 'The nine-lantern base in man — three 1s, one of each 2 through 8, three 9s — with a spare 5m. Chuuren poutou, a closed yakuman.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'It is like an extreme chinitsu that demands the terminal triplets and every middle rank, all in one suit and all closed. The nine-sided wait on the thirteen-tile base is one of the broadest in the game.',
              'It must be concealed; opening the hand disqualifies it. It stacks with nothing as a yakuman, but it is among the most celebrated hands in mahjong.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'One suit: three 1s, one each of 2–8, three 9s, plus one extra tile of that suit = chuuren poutou, closed yakuman. The base waits on nine different tiles.'
            },
          },
          ...drills([
            {
              prompt: 'Which complete hand is chuuren poutou?',
              options: [
                { label: '111m, one each of 2m through 8m, 999m, plus a spare 5m', correct: true, why: 'The nine-lantern base in one suit — terminal triplets at both ends (111 and 999), every middle rank once, and one extra same-suit tile (the 5m) — is chuuren poutou, a closed yakuman.' },
                { label: '222m 345m 789m with EEE and an FF pair', why: 'One suit plus honours is honitsu, and it lacks the 111-2..8-999 skeleton. Chuuren has a fixed, much stricter single-suit shape and no honours.' },
                { label: '123m 456m 789m 234p with a pair', why: 'Multiple suits present and no terminal triplets — an ordinary run hand (perhaps ittsu in man). Chuuren stays within one suit with both 111 and 999.' },
              ],
            },
            {
              prompt: 'The thirteen-tile chuuren base (111-2345678-999 of one suit) is tenpai. What is its wait?',
              options: [
                { label: 'Potentially any tile of that suit — a nine-sided wait', correct: true, why: 'With three 1s, three 9s and one of each middle rank held, drawing ANY rank 1 through 9 of the suit gives a valid fourteenth spare that completes the pattern. That nine-way wait is the signature “nine gates” of the hand.' },
                { label: 'Only the 5 of the suit', why: 'The spare can be any rank of the suit; you do not have to wait specifically for the middle tile. The base already contains one of every rank.' },
                { label: 'A wind or dragon', why: 'Chuuren is single-suit with no honours; a wind or dragon can never be the spare and would only break the flush.' },
              ],
            },
            {
              prompt: 'Your hand is building the nine-lantern shape in man — three 1s, three 9s and the middle ranks — when an opponent discards a 1m that would complete one of your terminal triplets. You could pon it. What happens to chuuren poutou if you do?',
              options: [
                { label: 'The pon opens the hand and destroys the yaku — chuuren must be drawn entirely concealed, so you would have to abandon the limit hand', correct: true, why: 'Chuuren poutou is a closed-only yakuman like kokushi and suuankou. Even a single meld disqualifies it; the all-one-suit tiles would then be worth at most a flush (and a flush with ponned triplets cannot be chinitsu closed anyway). Players chasing chuuren decline calls precisely for this reason.' },
                { label: 'It still scores, because a pon keeps the same fourteen tiles in place', why: 'Yaku look at how the hand was formed, not just its finished tiles. A pon is an open meld, and this pattern requires a concealed hand, so the identical tiles reached via a call do not qualify.' },
                { label: 'It scores as a smaller but still valid nine-lantern hand', why: 'There is no open or reduced version of chuuren. After a call the hand is simply not the yakuman and must earn its value from ordinary open-hand yaku.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'suukantsu',
        title: 'Suukantsu: four kans',
        summary: 'Four declared quads in a single hand. Yakuman — each kan is a rare event on its own.',
        steps: [
          {
            kind: 'teach',
            text: [
              'Suukantsu is four declared kans in one hand — the quad maximum, and a yakuman. Each kan uses all four copies of a tile and draws a replacement from the dead wall, so the hand keeps fourteen across the four quads.',
              'It is the end of the line that sankantsu (three kans, two han) leads toward, and it is rare to the point of being a table-stopping event.',
            ],
            figures: [
              { tiles: '1111m 5555p 9999s 3333p', caption: 'Four declared quads — suukantsu yakuman. Each quad consumes all four copies of a kind and pulls a dead-wall replacement.' },
            ],
          },
          {
            kind: 'teach',
            text: [
              'Four kans also flip a new dora indicator each time (kan dora), so a suukantsu hand tends to be surrounded by revealed dora even though the quads alone pay the limit.',
              'The pattern needs sixteen specific tiles in four complete sets; forming it almost always involves open kans as the rare copies surface.',
            ],
            note: {
              title: 'Recognition cue',
              text: 'Four declared kans (closed or promoted) = suukantsu yakuman. Three kans is the two-han sankantsu; the fourth quad crosses to the limit.'
            },
          },
          ...drills([
            {
              prompt: 'A player’s hand finishes with four separate declared quads. The table has had to draw a replacement tile after each one. Which limit hand is this?',
              options: [
                { label: 'Suukantsu — four kans', correct: true, why: 'Four different kinds each held as a four-of-a-kind, each declared as a kan with its dead-wall replacement, is suukantsu — a yakuman. Quads that numerous in one hand are a table-stopping event.' },
                { label: 'Suuankou — four concealed triplets', why: 'Suuankou is about self-drawn TRIPLETS; suukantsu is about declared KAN quads. Four full four-of-a-kind melds point to suukantsu instead.' },
                { label: 'Sankantsu — three kans', why: 'Sankantsu stops at three quads and is worth two han. The fourth quad pushes the hand past it into the yakuman.' },
              ],
            },
            {
              prompt: 'A rival across the table declares their third kan of the hand. Beyond moving toward suukantsu, what practical effect on the game should you be aware of after each kan?',
              options: [
                { label: 'Each kan flips an additional dora indicator and draws a dead-wall replacement, so more dora are now live and the hand’s values can jump', correct: true, why: 'Every kan reveals a kan dora from the dead wall (and the player draws a replacement tile to stay at fourteen). By the third or fourth kan several extra dora indicators are showing, which can swell every winning hand — meaning a rival’s kans raise the stakes for the whole table, not just for them.' },
                { label: 'A kan ends the declaring player’s turn, so they cannot win on that hand', why: 'Declaring a kan does not forfeit anything: the player draws a replacement tile and then discards as usual, remaining fully in play. The meld even counts as a strong block toward their win.' },
                { label: 'Kans only expose tiles and have no effect on dora or the wall', why: 'A kan specifically consumes all four copies, pulls a replacement from the dead wall, and flips a new dora indicator — it changes both the wall and the live dora every time.' },
              ],
            },
            {
              prompt: 'Three kans down and a possible fourth is forming. What does the fourth kan achieve?',
              options: [
                { label: 'It escalates sankantsu (two han) into the suukantsu yakuman', correct: true, why: 'Three quads is the two-han sankantsu; completing the fourth quad reaches suukantsu, a limit hand. That jump is why a player on three kans is treated as a live yakuman threat by the whole table.' },
                { label: 'Nothing — three is the maximum legal', why: 'A fourth kan is legal and is exactly what completes suukantsu. The dead-wall replacement mechanism supports the fourth quad.' },
                { label: 'It downgrades the hand', why: 'More kans only add value: the fourth crosses from a two-han yaku to a yakuman, with extra dora revealed along the way.' },
              ],
            },
          ]),
        ],
      },
      {
        id: 'tenhou-chiihou',
        title: 'Tenhou and chiihou: the perfect-deal wins',
        summary: 'The dealer self-drawing on turn zero (tenhou) or a non-dealer on their first draw (chiihou). Yakuman.',
        steps: [
          {
            kind: 'teach',
            text: [
              'The two rarest wins in the game need no special tile arrangement at all — only timing. Tenhou is the DEALER drawing a winning hand immediately on the opening deal, before any discard. Chiihou is a NON-dealer self-drawing the winning tile on their very first draw, before they have discarded.',
              'Both are closed self-draws achieved before the hand really starts, and both are yakuman purely by luck.',
            ],
          },
          {
            kind: 'teach',
            text: [
              'They cannot be planned for: the condition is the round and the draw count, not the tiles. Tenhou happens (or not) on the deal the dealer receives; chiihou on the non-dealer’s first self-draw, before any call or discard has occurred.',
              'Renhou is the discard-fed, mangan-valued cousin for a non-dealer winning before acting; tenhou and chiihou are the self-drawn yakuman.',
            ],
            note: {
              title: 'Recognition cues',
              text: 'Dealer self-draws a win from the opening deal = tenhou. Non-dealer self-draws a win on their very first draw (no prior call/discard) = chiihou. Both closed tsumo yakuman of pure timing.'
            },
          },
          ...drills([
            {
              prompt: 'The dealer (East) is dealt a complete winning hand and declares immediately, before any discard. Which yakuman is this?',
              options: [
                { label: 'Tenhou — the heavenly hand, dealer’s opening-deal win', correct: true, why: 'Tenhou belongs to the dealer only: the starting deal itself is a complete hand and the dealer wins before play begins (a closed self-draw on turn zero). It is purely a matter of being dealt the win as East.' },
                { label: 'Chiihou', why: 'Chiihou is the non-dealer counterpart: a player other than the dealer self-drawing the win on their first draw. The dealer’s opening-deal win has its own name, tenhou.' },
                { label: 'Renhou', why: 'Renhou is winning on a DISCARD before your first action and is valued at mangan here. The dealer self-drawing on the deal is tenhou, a yakuman.' },
              ],
            },
            {
              prompt: 'A non-dealer draws the winning tile on their very first draw, with no calls or discards yet. Which yakuman?',
              options: [
                { label: 'Chiihou — the earthly hand, non-dealer’s first-draw win', correct: true, why: 'Chiihou is the non-dealer self-drawing a complete hand on their opening draw before taking any other action (closed tsumo). It is the non-dealer equivalent of the dealer’s tenhou and, like it, a timing yakuman.' },
                { label: 'Tenhou', why: 'Tenhou is exclusive to the dealer’s opening deal. A non-dealer cannot score tenhou; their opening first-draw win is chiihou.' },
                { label: 'Double riichi', why: 'Double riichi is declaring on your first discard of a hand that is merely tenpai; chiihou is actually WINNING on the first draw, which is far rarer and a yakuman.' },
              ],
            },
            {
              prompt: 'What do tenhou and chiihou require that ordinary yaku do not?',
              options: [
                { label: 'Nothing about the tiles — only the round/seat and the perfect first-draw timing', correct: true, why: 'They are pure timing yakuman: tenhou for the dealer dealt a win, chiihou for a non-dealer whose first draw wins. The tile arrangement must simply be a legal winning hand; the rarity is entirely in the deal and draw order, which is why no strategy can produce them.' },
                { label: 'A special all-dragons shape', why: 'Any legal closed winning hand qualifies regardless of shape; these yaku add a yakuman purely on timing, not on a required pattern like daisangen.' },
                { label: 'Winning on an opponent’s discard', why: 'Both are SELF-DRAWS (tsumo). The discard-fed timing hand is renhou; tenhou and chiihou are the self-draw equivalents.' },
              ],
            },
          ]),
        ],
      },
    ],
  },
];
