// Ember Court — table layout. One function, computeLayout, turns a game
// state into every rectangle the renderer draws and the input handler
// clicks: hands, boards, heroes, mana, buttons. Both sides read it, so a
// click always lands where the card is drawn.
//
// The table is a fixed 1280x720 stage, scaled to fit the window:
//   top    — the rival's hand (card backs) and hero portrait
//   middle — the two boards, rival above, yours below
//   bottom — your hand, mana crystals, hero power and End Turn

export const STAGE_W = 1280;
export const STAGE_H = 720;

export function cardRects(count, cardW, cardH, centerX, topY, maxSpan) {
  const rects = [];
  if (count === 0) return rects;
  const span = Math.min(maxSpan, count * cardW + (count - 1) * 10);
  const step = count > 1 ? (span - cardW) / (count - 1) : 0;
  const startX = centerX - span / 2;
  for (let i = 0; i < count; i++) {
    rects.push({ x: startX + i * step, y: topY, w: cardW, h: cardH, index: i });
  }
  return rects;
}

export function computeLayout(game) {
  const cx = STAGE_W / 2;
  const me = game.players[0];
  const foe = game.players[1];

  const hand = cardRects(me.hand.length, 104, 146, cx, 556, 980);
  const foeHand = cardRects(foe.hand.length, 44, 62, cx, 6, 420);
  const foeBoard = cardRects(foe.board.length, 96, 128, cx, 148, 840);
  const myBoard = cardRects(me.board.length, 96, 128, cx, 330, 840);

  return {
    foeHero: { x: cx - 190, y: 78, w: 380, h: 56 },
    myHero: { x: cx - 190, y: 486, w: 380, h: 56 },
    hand,
    foeHand,
    foeBoard,
    myBoard,
    endTurn: { x: 1110, y: 600, w: 150, h: 52 },
    heroPower: { x: 1110, y: 536, w: 150, h: 52 },
    mana: { x: 16, y: 600, w: 220, h: 52 },
    deckCount: { x: 16, y: 536, w: 220, h: 52 },
    log: { x: 16, y: 84, w: 230, h: 260 },
    turnBanner: { x: cx - 140, y: 286, w: 280, h: 34 },
  };
}

export function pointIn(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
