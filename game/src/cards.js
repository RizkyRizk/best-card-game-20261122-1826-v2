// Ember Court — the card set.
// Four suits of the court, told apart by colour and sigil:
//   🔥 Flame (red) — fast, aggressive, Rush and burn.
//   🪨 Cinder (brown) — tough, Taunt walls that hold the line.
//   🌿 Ashen (green) — trickery, card flow and cunning trades.
//   ✨ Ember (gold) — big finishers and board-wide fire.
//
// Every card is original: names, art sigils and text are ours, and no card
// copies a commercial game's. A card def is plain data; the engine in
// engine.js interprets the keywords and hooks below.
//
// Keywords:
//   taunt   — enemies must attack this minion before any other target.
//   rush    — may attack the turn it is played.
//   burn n  — when this minion attacks, it also scorches the enemy hero for n.
//   rally   — while this minion lives, your other minions get +1 attack.
//   rekindle — when this minion is destroyed, it deals 2 damage to the enemy hero.
//   draw n  — on play, draw n cards.
//   scorch n — on play, automatically scorches the enemy hero for n.
//   deal n  — a spell that deals n damage (to a chosen target, or all enemies).

export const SUITS = {
  flame: { color: '#e2483d', dark: '#8f1f18', sigil: '▲', label: 'Flame' },
  cinder: { color: '#c98a4b', dark: '#7a4d1f', sigil: '◆', label: 'Cinder' },
  ashen: { color: '#5da85f', dark: '#2e5c31', sigil: '●', label: 'Ashen' },
  ember: { color: '#e8b23a', dark: '#8a6410', sigil: '✦', label: 'Ember' },
};

// id, name, suit, cost, attack, health (0/0 = spell), keywords, text.
export const CARD_DEFS = [
  { id: 'cinder-imp',   name: 'Cinder Imp',    suit: 'flame',  cost: 1, attack: 1, health: 1, keywords: ['rush'], text: 'Rush. A spark with somewhere to be.' },
  { id: 'ash-squire',   name: 'Ash Squire',    suit: 'cinder', cost: 1, attack: 1, health: 2, keywords: ['taunt'], text: 'Taunt. Small shield, stubborn heart.' },
  { id: 'kindling',     name: 'Kindling',      suit: 'ashen',  cost: 1, attack: 0, health: 0, keywords: ['draw 1'], spell: true, text: 'Draw a card. Every fire starts somewhere.' },
  { id: 'flame-wisp',   name: 'Flame Wisp',    suit: 'flame',  cost: 2, attack: 2, health: 1, keywords: ['rush'], text: 'Rush. It burns twice as bright, half as long.' },
  { id: 'ember-acolyte', name: 'Ember Acolyte', suit: 'ember',  cost: 2, attack: 2, health: 2, keywords: ['scorch 1'], text: 'On play: scorch the enemy hero for 1.' },
  { id: 'cinder-hound', name: 'Cinder Hound',  suit: 'flame',  cost: 3, attack: 3, health: 2, keywords: ['rush'], text: 'Rush. It smells smoke and runs toward it.' },
  { id: 'coal-golem',   name: 'Coal Golem',    suit: 'cinder', cost: 3, attack: 2, health: 5, keywords: ['taunt'], text: 'Taunt. The court wall, slow and certain.' },
  { id: 'pyre-dancer',  name: 'Pyre Dancer',   suit: 'flame',  cost: 3, attack: 3, health: 3, keywords: ['burn 1'], text: 'Burn 1: when it attacks, the enemy hero takes 1.' },
  { id: 'spark-mage',   name: 'Spark Mage',    suit: 'ashen',  cost: 4, attack: 3, health: 4, keywords: ['deal 2'], text: 'On play: deal 2 damage to a chosen enemy.' },
  { id: 'ashen-knight', name: 'Ashen Knight',  suit: 'cinder', cost: 4, attack: 4, health: 3, keywords: ['taunt'], text: 'Taunt. Oath-bound to stand in the way.' },
  { id: 'wildfire',     name: 'Wildfire',      suit: 'flame',  cost: 3, attack: 0, health: 0, keywords: ['deal 2 all'], spell: true, text: 'Deal 2 damage to all enemy minions.' },
  { id: 'flamecaller',  name: 'Flamecaller',   suit: 'ember',  cost: 5, attack: 4, health: 5, keywords: ['rally'], text: 'Rally: your other minions get +1 attack.' },
  { id: 'inferno-drake', name: 'Inferno Drake', suit: 'flame',  cost: 6, attack: 6, health: 5, keywords: ['rush'], text: 'Rush. The sky catches fire when it dives.' },
  { id: 'cinder-phoenix', name: 'Cinder Phoenix', suit: 'ember', cost: 6, attack: 5, health: 6, keywords: ['rekindle'], text: 'Rekindle: when destroyed, deal 2 to the enemy hero.' },
  { id: 'ember-titan',  name: 'Ember Titan',   suit: 'cinder', cost: 8, attack: 8, health: 8, keywords: ['taunt'], text: 'Taunt. The mountain itself, awake at last.' },
];

export const CARD_BY_ID = Object.fromEntries(CARD_DEFS.map((c) => [c.id, c]));

// A 30-card deck: two copies of every card in the 15-card set.
export function buildDeck() {
  const deck = [];
  for (const def of CARD_DEFS) deck.push(def.id, def.id);
  return deck; // 30 cards
}

