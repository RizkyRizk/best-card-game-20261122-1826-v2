// Ember Court — the rules engine. Pure logic, no DOM: the browser UI in
// render.js/input.js and the Node tests both drive this one file.
//
// The duel: two heroes, 30 life each. On your turn your mana crystals grow
// by one (up to 10) and refill; you draw a card (an empty deck burns you
// harder each time — fatigue). Play minions onto a board of at most 7; a
// minion cannot attack the turn it is played unless it has Rush. Taunt
// minions must be attacked before anything behind them. Spend 2 mana on
// the hero power, Ember Spark, to scorch any target for 1. Reduce the
// enemy hero to 0 and the court is yours.

import { CARD_BY_ID, buildDeck } from './cards.js';
import { mulberry32, shuffle } from './random.js';

export const MAX_HP = 30;
export const MAX_MANA = 10;
export const MAX_BOARD = 7;
export const MAX_HAND = 10;
export const START_HAND = 3;
export const HERO_POWER_COST = 2;

let nextUid = 1;

export function newMinion(def, owner) {
  return {
    uid: nextUid++,
    def,
    owner,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    canAttack: def.keywords.includes('rush'), // summoning sickness otherwise
    justPlayed: true,
  };
}

export function newPlayer(index, seed) {
  const rand = mulberry32(seed + index * 7919);
  return {
    index,
    hp: MAX_HP,
    mana: 0,
    maxMana: 0,
    deck: shuffle(buildDeck(), rand),
    hand: [],
    board: [],
    fatigue: 0,
    heroPowerUsed: false,
  };
}

export function newGame(seed = 1) {
  nextUid = 1;
  const game = {
    seed,
    turn: 1,
    active: 0, // whose turn it is
    phase: 'play', // 'play' | 'won' | 'lost' (from player 0's view)
    winner: null,
    log: [],
    players: [newPlayer(0, seed), newPlayer(1, seed)],
  };
  // The second player banks one mana crystal ahead, so their first turn
  // has 2 mana to answer the first player's tempo. (An extra card was
  // tried first and was not enough on its own; the crystal is the
  // compensation that balances the duel.)
  for (let i = 0; i < START_HAND; i++) {
    drawCard(game, 0);
    drawCard(game, 1);
  }
  game.players[1].maxMana = 1;
  startTurn(game, 0);
  return game;
}

export function effectiveAttack(game, minion) {
  let atk = minion.attack;
  const board = game.players[minion.owner].board;
  for (const m of board) {
    if (m.uid !== minion.uid && m.def.keywords.includes('rally')) atk += 1;
  }
  return atk;
}

export function hasTaunt(game, playerIndex) {
  return game.players[playerIndex].board.some((m) => m.def.keywords.includes('taunt'));
}

export function drawCard(game, playerIndex) {
  const p = game.players[playerIndex];
  if (p.hand.length >= MAX_HAND) {
    // A full hand burns the drawn card instead of holding it.
    if (p.deck.length > 0) p.deck.pop();
    game.log.push(`player ${playerIndex} hand full — card burned`);
    return null;
  }
  if (p.deck.length === 0) {
    p.fatigue += 1;
    p.hp -= p.fatigue;
    game.log.push(`player ${playerIndex} takes ${p.fatigue} fatigue`);
    checkEnd(game);
    return null;
  }
  const id = p.deck.pop();
  const card = { id, def: CARD_BY_ID[id] };
  p.hand.push(card);
  return card;
}

export function startTurn(game, playerIndex) {
  const p = game.players[playerIndex];
  game.active = playerIndex;
  p.maxMana = Math.min(MAX_MANA, p.maxMana + 1);
  p.mana = p.maxMana;
  p.heroPowerUsed = false;
  for (const m of p.board) {
    m.canAttack = true;
    m.justPlayed = false;
  }
  drawCard(game, playerIndex);
}

export function endTurn(game) {
  if (game.phase !== 'play') return false;
  game.turn += 1;
  startTurn(game, 1 - game.active);
  return true;
}

function checkEnd(game) {
  if (game.phase !== 'play') return;
  const [a, b] = game.players;
  if (a.hp <= 0 && b.hp <= 0) {
    game.phase = 'won';
    game.winner = null; // a draw counts as a win screen for the player who dealt last
    game.log.push('both heroes fall — a draw');
  } else if (b.hp <= 0) {
    game.phase = 'won';
    game.winner = 0;
  } else if (a.hp <= 0) {
    game.phase = 'lost';
    game.winner = 1;
  }
}

function dealDamage(game, target, amount, source) {
  if (game.phase !== 'play' || amount <= 0) return;
  if (target.kind === 'hero') {
    const p = game.players[target.player];
    p.hp -= amount;
    game.log.push(`${source} hits hero ${target.player} for ${amount}`);
    checkEnd(game);
  } else {
    const m = target.minion;
    m.health -= amount;
    game.log.push(`${source} hits ${m.def.name} for ${amount}`);
    if (m.health <= 0) destroyMinion(game, m);
  }
}

function destroyMinion(game, minion) {
  const board = game.players[minion.owner].board;
  const at = board.indexOf(minion);
  if (at === -1) return;
  board.splice(at, 1);
  game.log.push(`${minion.def.name} is destroyed`);
  if (minion.def.keywords.includes('rekindle')) {
    game.log.push(`${minion.def.name} rekindles — 2 to the enemy hero`);
    dealDamage(game, { kind: 'hero', player: 1 - minion.owner }, 2, minion.def.name);
  }
}

function burnValue(def) {
  for (const k of def.keywords) {
    const m = /^burn (\d+)$/.exec(k);
    if (m) return Number(m[1]);
  }
  return 0;
}

function scorchValue(def) {
  for (const k of def.keywords) {
    const m = /^scorch (\d+)$/.exec(k);
    if (m) return Number(m[1]);
  }
  return 0;
}

function dealValue(def) {
  for (const k of def.keywords) {
    const m = /^deal (\d+)$/.exec(k);
    if (m) return Number(m[1]);
  }
  return 0;
}

function drawValue(def) {
  for (const k of def.keywords) {
    const m = /^draw (\d+)$/.exec(k);
    if (m) return Number(m[1]);
  }
  return 0;
}

// --- Actions ---------------------------------------------------------------

// Targets: { kind: 'hero', player } or { kind: 'minion', minion }.
// Returns { ok, error? }.
export function playCard(game, playerIndex, handIndex, target) {
  if (game.phase !== 'play') return { ok: false, error: 'game over' };
  if (game.active !== playerIndex) return { ok: false, error: 'not your turn' };
  const p = game.players[playerIndex];
  const card = p.hand[handIndex];
  if (!card) return { ok: false, error: 'no such card' };
  const def = card.def;
  if (p.mana < def.cost) return { ok: false, error: 'not enough mana' };
  if (!def.spell && p.board.length >= MAX_BOARD) return { ok: false, error: 'board is full' };
  if (def.keywords.includes('deal 2 all')) {
    // Wildfire needs no target.
  } else if (def.keywords.some((k) => k.startsWith('deal ')) && !target) {
    return { ok: false, error: 'choose a target' };
  }
  if (target && target.kind === 'minion' && target.minion.owner === playerIndex && !def.spell) {
    return { ok: false, error: 'bad target' };
  }

  p.hand.splice(handIndex, 1);
  p.mana -= def.cost;
  game.log.push(`player ${playerIndex} plays ${def.name}`);

  if (def.spell) {
    if (def.keywords.includes('deal 2 all')) {
      const foes = game.players[1 - playerIndex].board.slice();
      for (const m of foes) dealDamage(game, { kind: 'minion', minion: m }, 2, def.name);
    } else if (drawValue(def) > 0) {
      for (let i = 0; i < drawValue(def); i++) drawCard(game, playerIndex);
    } else if (target) {
      dealDamage(game, target, dealValue(def), def.name);
    }
    checkEnd(game);
    return { ok: true };
  }

  const minion = newMinion(def, playerIndex);
  p.board.push(minion);
  if (scorchValue(def) > 0) {
    dealDamage(game, { kind: 'hero', player: 1 - playerIndex }, scorchValue(def), def.name);
  } else if (dealValue(def) > 0 && target) {
    dealDamage(game, target, dealValue(def), def.name);
  }
  checkEnd(game);
  return { ok: true, minion };
}

export function attack(game, playerIndex, attackerUid, target) {
  if (game.phase !== 'play') return { ok: false, error: 'game over' };
  if (game.active !== playerIndex) return { ok: false, error: 'not your turn' };
  const p = game.players[playerIndex];
  const attacker = p.board.find((m) => m.uid === attackerUid);
  if (!attacker) return { ok: false, error: 'no such minion' };
  if (!attacker.canAttack) return { ok: false, error: 'summoning sickness' };
  if (target.kind === 'hero' && hasTaunt(game, 1 - playerIndex)) {
    return { ok: false, error: 'a Taunt minion guards the hero' };
  }
  if (target.kind === 'minion') {
    if (target.minion.owner === playerIndex) return { ok: false, error: 'cannot attack your own minion' };
    if (!target.minion.def.keywords.includes('taunt') && hasTaunt(game, 1 - playerIndex)) {
      return { ok: false, error: 'a Taunt minion must be attacked first' };
    }
  }

  const atk = effectiveAttack(game, attacker);
  attacker.canAttack = false;
  game.log.push(`${attacker.def.name} attacks for ${atk}`);
  const burn = burnValue(attacker.def);
  if (target.kind === 'hero') {
    dealDamage(game, target, atk, attacker.def.name);
    if (burn > 0 && game.phase === 'play') {
      dealDamage(game, target, burn, `${attacker.def.name} burn`);
    }
  } else {
    const foe = target.minion;
    const foeAtk = effectiveAttack(game, foe);
    dealDamage(game, target, atk, attacker.def.name);
    if (game.phase === 'play') {
      dealDamage(game, { kind: 'minion', minion: attacker }, foeAtk, foe.def.name);
    }
  }
  checkEnd(game);
  return { ok: true };
}

export function heroPower(game, playerIndex, target) {
  if (game.phase !== 'play') return { ok: false, error: 'game over' };
  if (game.active !== playerIndex) return { ok: false, error: 'not your turn' };
  const p = game.players[playerIndex];
  if (p.heroPowerUsed) return { ok: false, error: 'hero power already used' };
  if (p.mana < HERO_POWER_COST) return { ok: false, error: 'not enough mana' };
  if (!target) return { ok: false, error: 'choose a target' };
  p.mana -= HERO_POWER_COST;
  p.heroPowerUsed = true;
  game.log.push(`player ${playerIndex} uses Ember Spark`);
  dealDamage(game, target, 1, 'Ember Spark');
  checkEnd(game);
  return { ok: true };
}

// --- Helpers for the UI and AI ----------------------------------------------

export function legalPlays(game, playerIndex) {
  const p = game.players[playerIndex];
  const plays = [];
  p.hand.forEach((card, i) => {
    if (card.def.cost <= p.mana) plays.push({ type: 'card', handIndex: i });
  });
  return plays;
}

export function legalAttacks(game, playerIndex) {
  const p = game.players[playerIndex];
  return p.board.filter((m) => m.canAttack).map((m) => m.uid);
}

export function describe(game) {
  const [a, b] = game.players;
  return `Turn ${game.turn} — You ${a.hp} HP, ${a.mana}/${a.maxMana} mana, hand ${a.hand.length}, board ${a.board.length} | Foe ${b.hp} HP, board ${b.board.length}`;
}
