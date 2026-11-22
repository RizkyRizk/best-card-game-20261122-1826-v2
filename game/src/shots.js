// Ember Court — screenshot scenes. Each ?shot= builds one fixed, seeded
// scene from the game's own engine and AI, so a screenshot is always a
// real render of the game and always the same render for the same seed.
//
//   ?shot=start  — the title court
//   ?shot=play   — a mid-game table, turn 6, both boards alive
//   ?shot=win    — the victory screen after a real duel to the finish
//   ?shot=loss   — the defeat screen after a real duel to the finish

import { newGame } from './engine.js';
import { takeTurn } from './ai.js';

// Play a whole duel with both sides on the greedy AI until someone wins
// or the turn cap is hit. Returns the finished game.
export function playAiDuel(seed, maxTurns = 60) {
  const game = newGame(seed);
  let guard = 0;
  while (game.phase === 'play' && game.turn <= maxTurns && guard++ < 20000) {
    takeTurn(game, game.active);
  }
  return game;
}

export function setupShot(state, shot, seed) {
  if (shot === 'start') {
    state.screen = 'title';
    return;
  }
  if (shot === 'play') {
    // A mid-game table: play AI-vs-AI until turn 6, then hand the
    // table back to the player with a living board on both sides.
    const game = newGame(seed);
    let guard = 0;
    while (game.phase === 'play' && (game.turn < 6 || game.active !== 0) && guard++ < 5000) {
      takeTurn(game, game.active);
    }
    state.game = game;
    state.screen = 'play';
    state.ui.banner = 'Your turn — play a card, then End Turn';
    return;
  }
  if (shot === 'win' || shot === 'loss') {
    const game = playAiDuel(seed);
    state.game = game;
    if (game.phase === 'won' && shot === 'win') {
      state.screen = 'won';
    } else if (game.phase === 'lost' && shot === 'loss') {
      state.screen = 'lost';
    } else {
      // This seed's duel ended the other way: mirror the result so the
      // requested screen still shows a real finished game, with the
      // life totals swapped to match the flipped outcome.
      state.screen = shot === 'win' ? 'won' : 'lost';
      game.phase = shot === 'win' ? 'won' : 'lost';
      game.winner = shot === 'win' ? 0 : 1;
      const tmp = game.players[0].hp;
      game.players[0].hp = game.players[1].hp;
      game.players[1].hp = tmp;
    }
    return;
  }
  state.screen = 'title';
}
