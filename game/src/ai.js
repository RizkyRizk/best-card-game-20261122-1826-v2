// Ember Court — the AI opponent. A greedy heuristic that reads the board
// the way a decent player would: spend mana on the best-value cards, clear
// Taunts before going face, trade up when it is profitable, and take the
// win the moment it is on the table. It never cheats — it only sees the
// public board and its own hand, and it only makes legal moves.
//
// Value of a card: attack + health, weighted by cost and keywords, so a
// Rush minion is worth more on a board it can strike at once, and a Taunt
// is worth more when the AI is low on life.

import { effectiveAttack, hasTaunt, playCard, attack, heroPower, endTurn } from './engine.js';

export function cardValue(game, me, card) {
  const def = card.def;
  let v = def.attack + def.health + def.cost * 0.5;
  if (def.keywords.includes('rush')) v += 2;
  if (def.keywords.includes('taunt')) v += me.hp <= 12 ? 3 : 1.5;
  if (def.keywords.includes('rally')) v += 2;
  if (def.keywords.includes('rekindle')) v += 1;
  if (def.keywords.some((k) => k.startsWith('burn'))) v += 1;
  if (def.keywords.includes('deal 2 all')) v += game.players[1 - me.index].board.length * 1.5;
  if (def.keywords.some((k) => k.startsWith('draw'))) v += 2;
  if (def.spell) v += 1;
  return v;
}

// Pick the best affordable card to play right now, or null.
export function chooseCard(game, me) {
  let best = null;
  let bestScore = 0;
  me.hand.forEach((card, i) => {
    if (card.def.cost > me.mana) return;
    if (!card.def.spell && me.board.length >= 7) return;
    const score = cardValue(game, me, card) / Math.max(1, card.def.cost);
    if (score > bestScore) {
      bestScore = score;
      best = { handIndex: i, card };
    }
  });
  return best;
}

// Where should this card's targeted effect go? Spark Mage burns the
// biggest enemy minion it can kill, or the hero when the board is empty.
export function chooseTarget(game, me, card) {
  const foe = game.players[1 - me.index];
  if (card.def.keywords.includes('deal 2 all')) return null;
  if (card.def.keywords.some((k) => k.startsWith('draw'))) return null;
  if (card.def.keywords.some((k) => k.startsWith('scorch'))) return null;
  const killable = foe.board
    .filter((m) => m.health <= 2)
    .sort((a, b) => effectiveAttack(game, b) - effectiveAttack(game, a))[0];
  if (killable) return { kind: 'minion', minion: killable };
  const biggest = foe.board.slice().sort((a, b) => b.health - a.health)[0];
  if (biggest) return { kind: 'minion', minion: biggest };
  return { kind: 'hero', player: 1 - me.index };
}

// One attack decision: returns { attackerUid, target } or null.
export function chooseAttack(game, me) {
  const foe = game.players[1 - me.index];
  const attackers = me.board.filter((m) => m.canAttack);
  if (attackers.length === 0) return null;

  // Lethal first: if everything going face wins, do it.
  const faceDamage = attackers.reduce((sum, m) => sum + effectiveAttack(game, m), 0);
  const burnDamage = attackers.reduce((sum, m) => {
    const b = m.def.keywords.find((k) => k.startsWith('burn '));
    return sum + (b ? Number(b.split(' ')[1]) : 0);
  }, 0);
  if (!hasTaunt(game, 1 - me.index) && faceDamage + burnDamage >= foe.hp) {
    const first = attackers[0];
    return { attackerUid: first.uid, target: { kind: 'hero', player: 1 - me.index } };
  }

  // Otherwise the strongest attacker takes the best trade it can win:
  // a Taunt it can kill, or an enemy it can kill without dying.
  const sorted = attackers.slice().sort((a, b) => effectiveAttack(game, b) - effectiveAttack(game, a));
  for (const atk of sorted) {
    const power = effectiveAttack(game, atk);
    const taunts = foe.board.filter((m) => m.def.keywords.includes('taunt'));
    const prey = taunts.length > 0 ? taunts : foe.board;
    const killable = prey
      .filter((m) => m.health <= power)
      .sort((a, b) => effectiveAttack(game, b) - effectiveAttack(game, a))[0];
    if (killable) {
      return { attackerUid: atk.uid, target: { kind: 'minion', minion: killable } };
    }
    // No clean kill: hit the biggest threat if we survive the reply.
    const threat = prey.slice().sort((a, b) => effectiveAttack(game, b) - effectiveAttack(game, a))[0];
    if (threat && effectiveAttack(game, threat) < atk.health && !hasTaunt(game, 1 - me.index)) {
      return { attackerUid: atk.uid, target: { kind: 'minion', minion: threat } };
    }
  }

  // Nothing profitable on the board: go face, unless a Taunt blocks us.
  if (!hasTaunt(game, 1 - me.index)) {
    const first = sorted[0];
    return { attackerUid: first.uid, target: { kind: 'hero', player: 1 - me.index } };
  }
  // Taunt blocks face and we cannot kill it: chip the weakest Taunt.
  const weakestTaunt = foe.board
    .filter((m) => m.def.keywords.includes('taunt'))
    .sort((a, b) => a.health - b.health)[0];
  if (weakestTaunt) {
    return { attackerUid: sorted[0].uid, target: { kind: 'minion', minion: weakestTaunt } };
  }
  return null;
}

// Play one full AI turn. Returns the list of human-readable moves made,
// so the UI can animate them one at a time.
export function takeTurn(game, playerIndex) {
  const me = game.players[playerIndex];
  const moves = [];
  let guard = 0;
  while (game.phase === 'play' && game.active === playerIndex && guard++ < 60) {
    const pick = chooseCard(game, me);
    if (pick) {
      const target = chooseTarget(game, me, pick.card);
      const res = playCard(game, playerIndex, pick.handIndex, target);
      if (res.ok) {
        moves.push({ type: 'play', name: pick.card.def.name });
        continue;
      }
    }
    const atk = chooseAttack(game, me);
    if (atk) {
      const res = attack(game, playerIndex, atk.attackerUid, atk.target);
      if (res.ok) {
        const minion = me.board.find((m) => m.uid === atk.attackerUid);
        moves.push({
          type: 'attack',
          name: minion ? minion.def.name : 'minion',
          target: atk.target.kind === 'hero' ? 'hero' : atk.target.minion.def.name,
        });
        continue;
      }
    }
    break;
  }
  // Leftover mana becomes an Ember Spark at the biggest threat, or face.
  if (game.phase === 'play' && game.active === playerIndex && me.mana >= 2 && !me.heroPowerUsed) {
    const foe = game.players[1 - me.index];
    const threat = foe.board.slice().sort((a, b) => effectiveAttack(game, b) - effectiveAttack(game, a))[0];
    const target = threat && threat.health === 1
      ? { kind: 'minion', minion: threat }
      : { kind: 'hero', player: 1 - me.index };
    if (heroPower(game, playerIndex, target).ok) moves.push({ type: 'power', name: 'Ember Spark' });
  }
  if (game.phase === 'play' && game.active === playerIndex) endTurn(game);
  return moves;
}
