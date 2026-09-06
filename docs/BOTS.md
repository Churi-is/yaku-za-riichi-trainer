# Opponents and table setup

The roster has **22 Yakuza / Like a Dragon characters**: 18 regulars (six at
each native level) and four **Special** opponents. These are fan-made mahjong
interpretations, not canonical skill ratings.
A level changes execution, not the wall, the rules, or access to information.

| Easy | Medium | Hard |
| --- | --- | --- |
| Shinji Tanaka — impatient caller | Ichiban Kasuga — momentum and comebacks | Goro Majima — bold kans and varied, sound discards |
| Rikiya Shimabukuro — honors and pairs | Akira Nishikiyama — ambitious flushes | Taiga Saejima — pairs and closed value |
| Yuya — cheap, straightforward speed | Shun Akiyama — efficient profit | Kazuma Kiryu — disciplined all-round play |
| Tatsuo Shinada — dora and long shots | Koichi Adachi — value and position | Ryuji Goda — expensive flush and dora routes |
| Nanba — early retreats | Saeko Mukoda — small wins, safe exits | Daigo Dojima — final-round position |
| Makoto Date — cautious, imperfect execution | Seonhee — quiet closed value | Osamu Kashiwagi — precise defense |

## Special opponents

**Special is a category, not a strength tier.** Their cards, table seats, settings
lineup, and match introduction use the Special badge. Estimated strength is
part of each character's description. Estimates are rough and describe default
execution; changing a practice level never removes the character's special rule.

| Character | Estimated difficulty | Thematic rule |
| --- | --- | --- |
| **Nugget — Fowl play** | Very easy; intentionally terrible | The real-estate chicken maximizes its own shanten, damages acceptance, and throws away dora/red fives. No voluntary calls, riichi, ron, or tsumo. It is genuinely trying to ruin its own hand, not just making random mistakes. |
| **Mr. Shakedown (Hiroya Egashira)** | Medium; very swingy | Demands a visible mangan: at least 8,000 points, or 12,000 as dealer, before sticks/honba. Can sacrifice one shanten tier to protect a stash of at least two dora. Passes cheap wins even after paying for riichi. |
| **Sotaro Komaki — Tiger Drop** | Medium; silent ron traps | Wins by counterattack: takes legal ron but refuses tsumo, all melds, and riichi. Favors live, natural-yaku ron waits; rebuilds when a ready hand is furiten or cannot legally ron. |
| **Pocket Circuit Fighter** | Easy–Medium; readable rhythm | Three full-attack discards, then three safety-first pit-stop discards, repeating. Takes all wins; compulsory riichi discards still apply. His public gear counter appears under his score. |

These are **AI choices within ordinary riichi rules**, not rule changes. Refused
ron is still subject to the engine's temporary/riichi furiten. In particular,
Komaki cannot magically discard a winning self-draw without furiten: he must
reshape on a later draw. Mr. Shakedown counts only what the public scoring view
can establish, not hidden ura or unavailable situational bonuses. Neither bot
can legally override an engine-enforced restriction.

Forced single actions always take precedence over gimmicks; bots never fabricate
a pass or stall the game. Every Special policy has seeded, public-view-only
regression tests. The original regular policies and benchmarks are unchanged.

Regular quick-table presets exclude Specials. Add one manually, or use the
explicit **Special table** preset to seat three distinct Specials. Each special
opponent also has a public rule/status reminder underneath their match score.

## Assigning seats

1. Choose **Right**, **Across**, or **Left** on the miniature table.
2. Choose a character card. Only that seat changes; the target does not advance.
3. Choosing a character already at the table **swaps** the two occupants. Moving
   into an empty seat leaves the source empty.
4. **Clear seat** removes only that opponent. All three seats must be filled
   before proceeding. The human always stays at the bottom.

Cards can also be dragged directly onto the table. Buttons provide the same
operations for touch and keyboard users. The roster's seat shortcuts stay
available while scrolling on small screens. Filters and search never alter the
lineup. Expand **Quick tables & seating tips** for Easy-going, Mixed, Boss, and
Special table, and restore-default options.

**By character** is the default level setting. **Same for all** in Table Settings
lets you choose a uniform Easy, Medium, or Hard practice level while preserving
each character's style. Settings, the match introduction, and the pause reminder
reflect the chosen mode. `normal` remains the internal value for the Medium
label; game rules do not interpret the level.

## Decision model

- `personalities.ts` supplies identities, native levels, learnable tells, and
  tuning at a normal-execution baseline.
- `paramsFor` applies tuning **before** difficulty scaling, so a character's
  override cannot silently cancel the selected execution level.
- For regular opponents, shanten remains the first priority when attacking. Dora/value, a supported
  flush, and viable pair-heavy routes change preferences **within** that tier.
  Difficulty controls actual mistakes; variation chooses only near-equivalent
  same-tier discards with similar risk.
- Safety is assessed per threatening seat. A quiet player's old discard does
  not become safe against somebody else's riichi. Multiple threats require
  safety against all of them. Post-riichi safety excludes unresolved reaction
  windows; suji and visible suited quads are not treated as guaranteed safe.
- Kan appetite varies, but shape preservation and wall/threat checks still
  apply. Added kan upgrades the existing pon, rather than adding another block.
- Placement-aware characters protect a final-round lead and accept more risk
  when chasing a needed comeback. Dealer continuation also matters.
- Valuable dama is checked with the engine's public, pure scorer on hypothetical
  live completions. Dora alone, furiten, and a two-han minimum cannot masquerade
  as a legal ron. No ura or hidden draws are used.
- Discards are ranked within the engine's legal candidates, including kuikae.
  Physical-copy matching preserves a non-red five when one was chosen.

Every bot receives only `PublicView` and the legal actions. All randomness in
bot decisions is seeded; the same seed and sequence of public views reproduce
the same decisions. Strong bots still lose, and aggressive bots still take
risks—difficulty is not a guaranteed placement.

## Regression coverage

`npm test` covers fixed-seat assignment, swapping and clearing, UI filters and
presets, native/uniform level wiring, per-character execution scaling, safety
against multiple threats, kan decisions, value counting, legal dama, and every
named character playing real-engine matches under rule variations. Existing
seeded self-play and benchmark checks continue to cover legal actions,
execution separation, call rates, riichi, and hand completion. Specials additionally
have tests for intentional win refusal, worst-shanten selection, the actual
mangan payout floor, value-over-speed choices, ron-only reshaping, gear changes,
forced actions, category labels/estimates, and full all-Special matches.
