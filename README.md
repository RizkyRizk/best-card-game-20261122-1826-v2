# Ember Court — a duel of cinder and flame

An original, complete turn-based card battler that runs offline in a
desktop browser from static files. Built for the make.fun "Make the best
card game" bounty.

## The duel

Two keepers of the Ember Court, 30 life each. On your turn your mana
crystals grow by one (up to 10) and refill; you draw a card — and when
your 30-card deck runs out, the fatigue fire burns you harder every turn.

- **Play minions** onto a board of at most 7. A minion cannot attack the
  turn it is played — unless it has **Rush**.
- **Taunt** minions must be attacked before anything behind them.
- **Burn** minions scorch the enemy hero when they attack. **Rally**
  minions give your other minions +1 attack. **Rekindle** minions deal 2
  to the enemy hero when destroyed.
- **Ember Spark** (2 mana, once a turn) scorches any target for 1.
- Spells: **Kindling** draws a card, **Wildfire** burns every enemy
  minion for 2.

Four suits, told apart by colour and sigil: Flame ▲ (red), Cinder ◆
(brown), Ashen ● (green), Ember ✦ (gold). Fifteen original cards, two
copies of each, make the 30-card deck. The second player banks one mana
crystal ahead, so their first turn has 2 mana to answer the first
player's tempo.

## The opponent

A greedy-heuristic AI that reads the board: it spends mana on the
best-value cards, clears Taunts before going face, trades up when it
profits, and takes lethal the moment it is on the table. It sees only
the public board and its own hand — it never cheats.

## Play it

Serve `game/` with any static server and open `game/index.html`, or:

```sh
node tools/serve.mjs   # http://localhost:8080
```

Click a card to play it; click one of your minions, then an enemy, to
attack. `1–9` selects a hand card, `Space` ends the turn, `Esc` cancels
a selection. Sounds are synthesized in the browser — no audio files.

## Screenshots

`?shot=start|play|win|loss&seed=N` renders a fixed, seeded scene of the
game's own engine for screenshots. The four shipped screenshots were
taken that way in headless Chrome.

## Tests

```sh
node --test tests/        # engine rules: deck, mana, Taunt, Rush, fatigue…
node tools/ai-vs-ai.mjs   # 200 AI-vs-AI duels, all must terminate
node tools/playtest.mjs   # headless-Chrome duel played to a finish
```

## Layout

- `game/src/cards.js` — the 15-card set and the four suits
- `game/src/engine.js` — the rules: turns, mana, combat, fatigue
- `game/src/ai.js` — the greedy-heuristic opponent
- `game/src/render.js` — the canvas table, cards and screens
- `game/src/layout.js` — one layout both rendering and clicks share
- `game/src/input.js` — mouse and keyboard
- `game/src/audio.js` — synthesized WebAudio sounds
- `game/src/shots.js` — seeded screenshot scenes
- `game/src/random.js` — the seeded PRNG
- `main.ts` — the hand-in program (copies `game/` + `screenshots/`,
  writes `dossier.json` with the vendored make.fun library)

License: MIT.
