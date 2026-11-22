// Ember Court — the game shell. Owns the screen state (title / play /
// won / lost), the animation loop, the AI's turn (played out one move at
// a time so the player can watch it), and the ?shot= scenes the maker
// uses for screenshots. The rules live in engine.js; this file only
// stages them.

import { newGame, endTurn } from './engine.js';
import { takeTurn } from './ai.js';
import { drawTitle, drawTable, drawEnd } from './render.js';
import { attachInput } from './input.js';
import { createSfx } from './audio.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam ? Number(seedParam) || 1 : (Date.now() % 100000) + 1;

const state = {
  screen: 'title',
  game: newGame(seed),
  ui: {
    selectedHand: null,
    selectedAttacker: null,
    selectedTarget: null,
    usingPower: false,
    hoverHand: null,
    hoverMinion: null,
    banner: null,
    effects: [],
  },
  aiTimer: null,
  aiMoves: [],
};

const sfx = createSfx();

function resize() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.width = `${1280 * scale}px`;
  canvas.style.height = `${720 * scale}px`;
}
window.addEventListener('resize', resize);
resize();

function addEffect(x, y, text, color) {
  state.ui.effects.push({ x, y, text, color, life: 1 });
}

state.startDuel = function startDuel() {
  state.game = newGame((Date.now() % 100000) + 1);
  state.screen = 'play';
  state.ui.selectedHand = null;
  state.ui.selectedAttacker = null;
  state.ui.usingPower = false;
  state.ui.banner = 'Your turn — play a card, then End Turn';
  setTimeout(() => { state.ui.banner = null; }, 2600);
  sfx.play('turn');
};

state.toTitle = function toTitle() {
  state.screen = 'title';
  state.game = newGame(seed);
};

state.afterAction = function afterAction(res, kind) {
  if (!res.ok) {
    state.ui.banner = res.error || 'That move is not legal';
    setTimeout(() => { state.ui.banner = null; }, 1800);
    return;
  }
  sfx.play(kind === 'attack' ? 'attack' : 'play');
  if (state.game.phase === 'won') {
    state.screen = 'won';
    sfx.play('win');
  } else if (state.game.phase === 'lost') {
    state.screen = 'lost';
    sfx.play('lose');
  }
};

state.finishTurn = function finishTurn() {
  if (state.game.phase !== 'play' || state.game.active !== 0) return;
  state.ui.selectedHand = null;
  state.ui.selectedAttacker = null;
  state.ui.usingPower = false;
  endTurn(state.game);
  state.ui.banner = 'Rival is thinking…';
  runAiTurn();
};

function runAiTurn() {
  const moves = takeTurn(state.game, 1);
  state.aiMoves = moves;
  // The AI's moves already happened in the engine; reveal them with a
  // short beat so the board does not jump all at once.
  state.ui.banner = moves.length > 0 ? `Rival: ${moves.map((m) => m.name).join(', ')}` : 'Rival passes';
  setTimeout(() => {
    state.ui.banner = null;
    if (state.game.phase === 'won') {
      state.screen = 'won';
      sfx.play('win');
    } else if (state.game.phase === 'lost') {
      state.screen = 'lost';
      sfx.play('lose');
    } else {
      state.ui.banner = 'Your turn';
      setTimeout(() => { state.ui.banner = null; }, 1400);
      sfx.play('turn');
    }
  }, 900);
}

// --- Screenshot scenes -----------------------------------------------------
// ?shot=start|play|win|loss&seed=N renders a fixed scene for the maker's
// screenshots. The scenes are built from the game's own engine and AI,
// with a pinned seed, so every render of the same shot is identical.
const shot = params.get('shot');
if (shot) {
  setupShot(state, shot, seed);
}

attachInput(canvas, state, sfx);

function frame() {
  ctx.clearRect(0, 0, 1280, 720);
  if (state.screen === 'title') drawTitle(ctx, seed);
  else if (state.screen === 'won') drawEnd(ctx, state.game, true);
  else if (state.screen === 'lost') drawEnd(ctx, state.game, false);
  else drawTable(ctx, state.game, state.ui);
  for (const fx of state.ui.effects) fx.life -= 0.012;
  state.ui.effects = state.ui.effects.filter((fx) => fx.life > 0);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for the headless playtest: lets the test drive the game and
// read its state without clicking pixels.
window.__emberCourt = {
  state,
  addEffect,
};
