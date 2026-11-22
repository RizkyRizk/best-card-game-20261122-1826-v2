// Ember Court — the canvas renderer. Everything the judge sees is drawn
// here: the title court, the table, the cards, the win and loss screens.
// Cards are legible at thumbnail size on purpose — big cost gem, big
// attack and health, suit colour plus sigil shape, never text alone.

import { SUITS } from './cards.js';
import { effectiveAttack } from './engine.js';
import { computeLayout, pointIn } from './layout.js';

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, maxWidth, startSize, weight = 'bold') {
  let size = startSize;
  ctx.font = `${weight} ${size}px Georgia, serif`;
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px Georgia, serif`;
  }
  return size;
}

// Draw one card face. `card` is { def } from a hand, or a board minion
// (which also carries health/attack/canAttack). opts: selected, hovered,
// playable, dimmed (summoning sickness), small.
export function drawCardFace(ctx, game, item, x, y, w, h, opts = {}) {
  const def = item.def;
  const suit = SUITS[def.suit];
  const minion = item.health !== undefined ? item : null;

  ctx.save();
  if (opts.hovered) {
    ctx.translate(0, -14);
    ctx.shadowColor = 'rgba(232,178,58,0.8)';
    ctx.shadowBlur = 18;
  }
  if (opts.selected) {
    ctx.shadowColor = '#e8b23a';
    ctx.shadowBlur = 22;
  }
  // Card body: parchment face, suit-coloured frame.
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#f7ead0');
  grad.addColorStop(1, '#e8d3a8');
  roundRect(ctx, x, y, w, h, 9);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = opts.selected ? 4 : 2.5;
  ctx.strokeStyle = opts.selected ? '#e8b23a' : suit.dark;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Suit banner with the name, below the gem row so nothing overlaps it.
  roundRect(ctx, x + 3, y + h * 0.24, w - 6, h * 0.15, 6);
  ctx.fillStyle = suit.color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, def.name, w - 12, Math.round(w * 0.115));
  ctx.fillText(def.name, x + w / 2, y + h * 0.315);

  // Cost gem, top-left, clear of the name band.
  const gemR = Math.round(w * 0.17);
  ctx.beginPath();
  ctx.arc(x + gemR + 2, y + gemR + 2, gemR, 0, Math.PI * 2);
  ctx.fillStyle = '#2b6cb0';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  fitFont(ctx, String(def.cost), gemR * 1.4, gemR + 4);
  ctx.fillText(String(def.cost), x + gemR + 2, y + gemR + 3);

  // Sigil art: a big suit symbol in a coloured medallion.
  const medR = Math.round(w * 0.24);
  const medY = y + h * 0.55;
  ctx.beginPath();
  ctx.arc(x + w / 2, medY, medR, 0, Math.PI * 2);
  ctx.fillStyle = suit.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = suit.dark;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(medR * 1.1)}px Georgia, serif`;
  ctx.fillText(suit.sigil, x + w / 2, medY + 1);

  // Keyword line.
  ctx.fillStyle = '#5a4632';
  ctx.font = `italic ${Math.round(w * 0.085)}px Georgia, serif`;
  const kw = def.keywords.join(' · ');
  fitFont(ctx, kw, w - 12, Math.round(w * 0.085), 'italic');
  ctx.fillText(kw, x + w / 2, y + h * 0.72);

  // Rules text, wrapped to two lines — on hand cards only. On a board
  // minion the attack/health orbs sit at the bottom corners and would
  // cover the text ends; the keyword line above already says what it does.
  if (!minion) {
    ctx.fillStyle = '#3a2c1c';
    ctx.font = `${Math.round(w * 0.082)}px Georgia, serif`;
    wrapText(ctx, def.text, x + w / 2, y + h * 0.82, w - 14, Math.round(w * 0.115), 2);
  }

  if (minion) {
    // Attack (left) and health (right) orbs.
    const orbR = Math.round(w * 0.16);
    ctx.beginPath();
    ctx.arc(x + orbR + 1, y + h - orbR - 1, orbR, 0, Math.PI * 2);
    ctx.fillStyle = '#c0392b';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    fitFont(ctx, String(effectiveAttack(game, minion)), orbR * 1.5, orbR + 4);
    ctx.fillText(String(effectiveAttack(game, minion)), x + orbR + 1, y + h - orbR);

    ctx.beginPath();
    ctx.arc(x + w - orbR - 1, y + h - orbR - 1, orbR, 0, Math.PI * 2);
    ctx.fillStyle = minion.health <= 2 ? '#c0392b' : '#27ae60';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    fitFont(ctx, String(minion.health), orbR * 1.5, orbR + 4);
    ctx.fillText(String(minion.health), x + w - orbR - 1, y + h - orbR);

    if (!minion.canAttack) {
      // Summoning sickness: dim the card and pin a clean RESTING pill
      // across its middle, instead of text over the art.
      ctx.fillStyle = 'rgba(40,30,20,0.45)';
      roundRect(ctx, x, y, w, h, 9);
      ctx.fill();
      const pillW = w * 0.72;
      const pillH = Math.round(w * 0.16);
      roundRect(ctx, x + (w - pillW) / 2, y + h * 0.5 - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = 'rgba(20,14,10,0.9)';
      ctx.fill();
      ctx.strokeStyle = '#cbb98f';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f7ead0';
      ctx.font = `bold ${Math.round(w * 0.1)}px Georgia, serif`;
      ctx.fillText('RESTING', x + w / 2, y + h * 0.5 + 1);
    }
    if (minion.canAttack && game.active === 0 && game.phase === 'play') {
      ctx.strokeStyle = 'rgba(46,204,113,0.9)';
      ctx.lineWidth = 3;
      roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 10);
      ctx.stroke();
    }
  } else if (def.spell) {
    ctx.fillStyle = '#8e44ad';
    ctx.font = `bold ${Math.round(w * 0.11)}px Georgia, serif`;
    ctx.fillText('✦ SPELL ✦', x + w / 2, y + h - 12);
  }

  // Taunt: a shield-coloured frame around the card. The keyword line
  // already names it, so no text is needed outside the card.
  if (def.keywords.includes('taunt')) {
    ctx.strokeStyle = '#c98a4b';
    ctx.lineWidth = 3;
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 11);
    ctx.stroke();
  }
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
}

function drawCardBack(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 6);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#5b2a1e');
  grad.addColorStop(1, '#3a1a12');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#e8b23a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#e8b23a';
  ctx.font = `bold ${Math.round(w * 0.5)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', x + w / 2, y + h / 2);
}

function drawHero(ctx, x, y, w, h, name, hp, mana, isFoe, active) {
  roundRect(ctx, x, y, w, h, 10);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, isFoe ? '#4a1f1a' : '#1f3a4a');
  grad.addColorStop(1, isFoe ? '#2a1210' : '#12242e');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = active ? 3 : 1.5;
  ctx.strokeStyle = active ? '#e8b23a' : '#6b5a44';
  ctx.stroke();

  ctx.fillStyle = '#f7ead0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText(name, x + 16, y + h / 2 - 10);
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = '#cbb98f';
  ctx.fillText(isFoe ? 'Rival of the Ember Court' : 'You — Keeper of the Flame', x + 16, y + h / 2 + 12);

  // HP orb.
  const orbR = 22;
  ctx.beginPath();
  ctx.arc(x + w - orbR - 12, y + h / 2, orbR, 0, Math.PI * 2);
  ctx.fillStyle = hp <= 10 ? '#c0392b' : '#a93226';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText(String(hp), x + w - orbR - 12, y + h / 2 + 1);
  ctx.font = 'bold 10px Georgia, serif';
  ctx.fillText('HP', x + w - orbR - 12, y + h / 2 + 15);
}

function drawButton(ctx, rect, label, enabled, accent) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 9);
  ctx.fillStyle = enabled ? (accent || '#b7791f') : '#555';
  ctx.fill();
  ctx.strokeStyle = '#f7ead0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, label, rect.w - 14, 16);
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function drawMana(ctx, rect, mana, maxMana) {
  ctx.fillStyle = '#f7ead0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(`Mana ${mana}/${maxMana}`, rect.x, rect.y + 12);
  for (let i = 0; i < MAX_MANA_GEMS; i++) {
    const cx = rect.x + 14 + i * 20;
    const cy = rect.y + 34;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < mana ? '#2b6cb0' : '#3a3a3a';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
const MAX_MANA_GEMS = 10;

function drawLog(ctx, rect, lines) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#d8c9a3';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '12px Georgia, serif';
  const shown = lines.slice(-12);
  shown.forEach((l, i) => ctx.fillText(l, rect.x + 10, rect.y + 8 + i * 19, rect.w - 20));
}

// --- Screens ----------------------------------------------------------------

export function drawTitle(ctx, seed) {
  const W = 1280;
  const H = 720;
  // Ember hall backdrop: dark wood, drifting embers.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#241610');
  bg.addColorStop(0.6, '#1a0f0a');
  bg.addColorStop(1, '#0e0806');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberryLike(seed);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 1 + rnd() * 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232,${140 + Math.floor(rnd() * 60)},58,${0.25 + rnd() * 0.5})`;
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleGrad = ctx.createLinearGradient(0, 120, 0, 220);
  titleGrad.addColorStop(0, '#f6c453');
  titleGrad.addColorStop(1, '#e2483d');
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillText('EMBER COURT', W / 2, 165);
  ctx.fillStyle = '#d8c9a3';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('— a duel of cinder and flame —', W / 2, 225);

  // The four suits, as a legend.
  const suits = Object.values(SUITS);
  suits.forEach((s, i) => {
    const x = W / 2 - 225 + i * 150;
    ctx.beginPath();
    ctx.arc(x, 285, 26, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = '#f7ead0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText(s.sigil, x, 286);
    ctx.fillStyle = '#d8c9a3';
    ctx.font = '14px Georgia, serif';
    ctx.fillText(s.label, x, 326);
  });

  ctx.fillStyle = '#f7ead0';
  ctx.font = '20px Georgia, serif';
  ctx.fillText('30 life · mana 1 → 10 · 30-card deck · Taunt, Rush, Burn & Rally', W / 2, 380);
  ctx.font = '16px Georgia, serif';
  ctx.fillStyle = '#cbb98f';
  ctx.fillText('Outwit the rival keeper. Reduce their hero to 0 — before the fatigue fire takes you.', W / 2, 408);

  // The call to duel.
  ctx.save();
  ctx.shadowColor = 'rgba(232,178,58,0.9)';
  ctx.shadowBlur = 24;
  roundRect(ctx, W / 2 - 170, 452, 340, 64, 12);
  ctx.fillStyle = '#b7791f';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#f7ead0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('⚔  BEGIN THE DUEL', W / 2, 485);

  ctx.fillStyle = '#9a8a6a';
  ctx.font = '14px Georgia, serif';
  ctx.fillText('Click a card to play it · click one of your minions, then an enemy, to attack', W / 2, 552);
  ctx.fillText('End Turn passes to the rival · Ember Spark (2 mana) scorches any target for 1', W / 2, 576);
  ctx.fillText('A complete, original card game — no account, no network, just the court.', W / 2, 620);
}

function mulberryLike(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawEnd(ctx, game, won) {
  const W = 1280;
  const H = 720;
  ctx.fillStyle = won ? 'rgba(20,16,4,0.88)' : 'rgba(12,8,8,0.92)';
  ctx.fillRect(0, 0, W, H);
  if (won) {
    const rnd = mulberryLike(99);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.beginPath();
      ctx.arc(x, y, 1 + rnd() * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(246,196,83,${0.3 + rnd() * 0.6})`;
      ctx.fill();
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = won ? '#f6c453' : '#b8b0a0';
  ctx.font = 'bold 76px Georgia, serif';
  ctx.fillText(won ? 'VICTORY' : 'DEFEAT', W / 2, 250);
  ctx.fillStyle = '#f7ead0';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText(
    won ? 'The court is yours — the rival keeper bows to the flame.' : 'The embers fade. The rival keeper holds the court… this time.',
    W / 2,
    320,
  );
  const [a, b] = game.players;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(`Final score — You ${Math.max(0, a.hp)} HP · Rival ${Math.max(0, b.hp)} HP · ${game.turn} turns`, W / 2, 372);
  roundRect(ctx, W / 2 - 150, 420, 300, 56, 10);
  ctx.fillStyle = '#b7791f';
  ctx.fill();
  ctx.strokeStyle = '#f7ead0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('↻  DUEL AGAIN', W / 2, 449);
  ctx.fillStyle = '#9a8a6a';
  ctx.font = '15px Georgia, serif';
  ctx.fillText('Click anywhere to return to the title court.', W / 2, 520);
}

export function drawTable(ctx, game, ui) {
  const W = 1280;
  const H = 720;
  // The table: dark wood rim, green felt centre.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a1a12');
  bg.addColorStop(1, '#1a100a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1e4d2b';
  roundRect(ctx, 250, 60, 780, 420, 24);
  ctx.fill();
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, 262, 72, 756, 396, 18);
  ctx.fill();

  const L = computeLayout(game);
  const me = game.players[0];
  const foe = game.players[1];

  // Rival hand: face-down backs.
  L.foeHand.forEach((r) => drawCardBack(ctx, r.x, r.y, r.w, r.h));
  ctx.fillStyle = '#d8c9a3';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(`Rival hand: ${foe.hand.length} cards`, 1060, 40);
  ctx.fillText(`Rival deck: ${foe.deck.length}`, 1060, 58);

  drawHero(ctx, L.foeHero.x, L.foeHero.y, L.foeHero.w, L.foeHero.h, 'RIVAL KEEPER', foe.hp, foe.mana, true, game.active === 1);
  drawHero(ctx, L.myHero.x, L.myHero.y, L.myHero.w, L.myHero.h, 'EMBER KEEPER', me.hp, me.mana, false, game.active === 0);

  // Boards.
  ctx.fillStyle = '#cbb98f';
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'center';
  if (foe.board.length === 0) ctx.fillText('— rival board is empty —', 640, 210);
  if (me.board.length === 0) ctx.fillText('— your board is empty —', 640, 392);
  foe.board.forEach((m, i) => {
    const r = L.foeBoard[i];
    drawCardFace(ctx, game, m, r.x, r.y, r.w, r.h, { selected: ui.selectedTarget === m.uid });
  });
  me.board.forEach((m, i) => {
    const r = L.myBoard[i];
    drawCardFace(ctx, game, m, r.x, r.y, r.w, r.h, { selected: ui.selectedAttacker === m.uid });
  });

  // Your hand.
  me.hand.forEach((card, i) => {
    const r = L.hand[i];
    const playable = game.active === 0 && game.phase === 'play' && card.def.cost <= me.mana;
    drawCardFace(ctx, game, card, r.x, r.y, r.w, r.h, {
      hovered: ui.hoverHand === i,
      selected: ui.selectedHand === i,
      playable,
      dimmed: !playable,
    });
  });

  drawMana(ctx, L.mana, me.mana, me.maxMana);
  ctx.fillStyle = '#f7ead0';
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(`Your deck: ${me.deck.length} cards`, L.deckCount.x, L.deckCount.y + 12);
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = '#cbb98f';
  ctx.fillText(`Turn ${game.turn} · ${game.active === 0 ? 'Your turn' : 'Rival is thinking…'}`, L.deckCount.x, L.deckCount.y + 34);

  drawButton(ctx, L.heroPower, 'Ember Spark (2)', game.active === 0 && game.phase === 'play' && !me.heroPowerUsed && me.mana >= 2, '#8e44ad');
  drawButton(ctx, L.endTurn, game.active === 0 ? 'End Turn ⏎' : 'Rival…', game.active === 0 && game.phase === 'play');

  // Turn banner.
  if (ui.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, L.turnBanner.x, L.turnBanner.y, L.turnBanner.w, L.turnBanner.h, 8);
    ctx.fill();
    ctx.fillStyle = '#f6c453';
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText(ui.banner, 640, L.turnBanner.y + 18);
  }

  drawLog(ctx, L.log, game.log);

  // Floating damage numbers and flashes.
  for (const fx of ui.effects || []) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, fx.life);
    ctx.fillStyle = fx.color;
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(fx.text, fx.x, fx.y - (1 - fx.life) * 40);
    ctx.restore();
  }

  // Targeting hint.
  if (ui.selectedHand !== null || ui.selectedAttacker !== null || ui.usingPower) {
    ctx.fillStyle = '#f6c453';
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('Choose a target — click an enemy minion or the rival hero', 640, 700);
  }
}

// Hit-testing for clicks: returns what the point lands on, or null.
export function hitTest(game, x, y) {
  const L = computeLayout(game);
  if (pointIn(L.endTurn, x, y)) return { type: 'endTurn' };
  if (pointIn(L.heroPower, x, y)) return { type: 'heroPower' };
  if (pointIn(L.foeHero, x, y)) return { type: 'hero', player: 1 };
  if (pointIn(L.myHero, x, y)) return { type: 'hero', player: 0 };
  for (let i = 0; i < game.players[1].board.length; i++) {
    if (pointIn(L.foeBoard[i], x, y)) return { type: 'minion', minion: game.players[1].board[i] };
  }
  for (let i = 0; i < game.players[0].board.length; i++) {
    if (pointIn(L.myBoard[i], x, y)) return { type: 'minion', minion: game.players[0].board[i] };
  }
  for (let i = 0; i < game.players[0].hand.length; i++) {
    if (pointIn(L.hand[i], x, y)) return { type: 'hand', index: i };
  }
  return null;
}
