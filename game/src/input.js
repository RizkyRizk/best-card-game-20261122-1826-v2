// Ember Court — input. Mouse clicks and keyboard drive the duel; every
// click is resolved through render.js's hitTest so a click always means
// what the player sees. Keyboard: 1-9 plays a hand card, Space ends the
// turn, Esc cancels a selection.

import { hitTest } from './render.js';
import { playCard, attack, heroPower, endTurn } from './engine.js';

export function attachInput(canvas, state, sfx) {
  function toStage(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  canvas.addEventListener('mousemove', (event) => {
    const { x, y } = toStage(event);
    const hit = state.screen === 'play' ? hitTest(state.game, x, y) : null;
    state.ui.hoverHand = hit && hit.type === 'hand' ? hit.index : null;
    state.ui.hoverMinion = hit && hit.type === 'minion' ? hit.minion.uid : null;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  canvas.addEventListener('click', (event) => {
    const { x, y } = toStage(event);
    handleClick(state, x, y, sfx);
  });

  window.addEventListener('keydown', (event) => {
    if (state.screen === 'title' && (event.key === 'Enter' || event.key === ' ')) {
      state.startDuel();
      return;
    }
    if (state.screen === 'play') {
      if (event.key === 'Escape') {
        state.ui.selectedHand = null;
        state.ui.selectedAttacker = null;
        state.ui.usingPower = false;
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        if (state.game.active === 0 && state.game.phase === 'play') state.finishTurn();
        return;
      }
      const n = Number(event.key);
      if (n >= 1 && n <= 9) {
        const idx = n - 1;
        if (state.game.players[0].hand[idx]) state.ui.selectedHand = idx;
      }
    }
    if ((state.screen === 'won' || state.screen === 'lost') && event.key === 'Enter') {
      state.toTitle();
    }
  });
}

function handleClick(state, x, y, sfx) {
  if (state.screen === 'title') {
    state.startDuel();
    sfx.play('click');
    return;
  }
  if (state.screen === 'won' || state.screen === 'lost') {
    state.toTitle();
    return;
  }
  if (state.screen !== 'play') return;
  const game = state.game;
  if (game.phase !== 'play' || game.active !== 0) return;

  const hit = hitTest(game, x, y);
  const ui = state.ui;

  // A pending target (card, attacker or hero power) resolves first.
  if (ui.selectedHand !== null || ui.selectedAttacker !== null || ui.usingPower) {
    const target = hit && hit.type === 'hero'
      ? { kind: 'hero', player: hit.player }
      : hit && hit.type === 'minion'
        ? { kind: 'minion', minion: hit.minion }
        : null;
    if (target) {
      if (ui.selectedHand !== null) {
        const res = playCard(game, 0, ui.selectedHand, target);
        state.afterAction(res, 'play');
      } else if (ui.selectedAttacker !== null) {
        const res = attack(game, 0, ui.selectedAttacker, target);
        state.afterAction(res, 'attack');
      } else if (ui.usingPower) {
        const res = heroPower(game, 0, target);
        state.afterAction(res, 'power');
      }
      ui.selectedHand = null;
      ui.selectedAttacker = null;
      ui.usingPower = false;
      return;
    }
    // Clicked empty space: cancel the selection.
    ui.selectedHand = null;
    ui.selectedAttacker = null;
    ui.usingPower = false;
    return;
  }

  if (!hit) return;
  if (hit.type === 'endTurn') {
    state.finishTurn();
    return;
  }
  if (hit.type === 'heroPower') {
    const me = game.players[0];
    if (!me.heroPowerUsed && me.mana >= 2) {
      ui.usingPower = true;
      sfx.play('click');
    }
    return;
  }
  if (hit.type === 'hand') {
    const card = game.players[0].hand[hit.index];
    const def = card.def;
    const needsTarget = def.keywords.some((k) => k.startsWith('deal ')) && !def.keywords.includes('deal 2 all');
    const needsNoTarget = def.spell && (def.keywords.includes('deal 2 all') || def.keywords.some((k) => k.startsWith('draw')));
    const isMinionNoTarget = !def.spell && !def.keywords.some((k) => k.startsWith('scorch'));
    if (needsTarget || def.keywords.some((k) => k.startsWith('scorch'))) {
      // Spark Mage needs a target; Acolyte auto-scorches, so play at once.
      if (def.keywords.some((k) => k.startsWith('scorch'))) {
        const res = playCard(game, 0, hit.index, null);
        state.afterAction(res, 'play');
      } else {
        ui.selectedHand = hit.index;
        sfx.play('click');
      }
      return;
    }
    if (needsNoTarget || isMinionNoTarget) {
      const res = playCard(game, 0, hit.index, null);
      state.afterAction(res, 'play');
      return;
    }
    ui.selectedHand = hit.index;
    return;
  }
  if (hit.type === 'minion' && hit.minion.owner === 0) {
    if (hit.minion.canAttack) {
      ui.selectedAttacker = hit.minion.uid;
      sfx.play('click');
    }
    return;
  }
}
