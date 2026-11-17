// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the real rules
// forward from a fresh run, steered by an autopilot, so the frame is what a real game looks
// like and the same seed always gives the same frame. The play and upgrade scenes use a
// competent pilot who takes his level-up gifts; the end scene's pilot is tired — slow feet,
// wandering aim, no gifts taken — and the night takes the grove, as it does a careless player.

import { FIELD, STEP, TREE } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const GIFT_ORDER = ['twin', 'pierce', 'might', 'swift', 'heartwood', 'vital', 'magnet', 'grace', 'longdash'];

function nearestEnemy(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** A warden at the keys: guard a ring around the Tree, shoot the closest threat, dash out of a swarm. */
function pilotIntent(state, tired, stepCount, range = 620) {
  const p = state.player;
  const target = nearestEnemy(state, p.x, p.y) || nearestEnemy(state, TREE.x, TREE.y);
  let moveX = 0;
  let moveY = 0;
  // Hold a guard post between the Tree and whichever side the gloom presses from.
  const anchor = target
    ? { x: TREE.x + (target.x - TREE.x) * 0.45, y: TREE.y + (target.y - TREE.y) * 0.45 }
    : { x: TREE.x, y: TREE.y + 130 };
  const dx = anchor.x - p.x;
  const dy = anchor.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 26) {
    moveX = dx / d;
    moveY = dy / d;
  }
  let aimX = TREE.x;
  let aimY = 0;
  let firing = false;
  let dash = false;
  if (target) {
    // Aim where the creature is heading, not where it is.
    const tx = target.kind === 'stinger' ? p.x : TREE.x;
    const ty = target.kind === 'stinger' ? p.y : TREE.y;
    const ta = Math.atan2(ty - target.y, tx - target.x);
    aimX = target.x + Math.cos(ta) * target.speed * 0.45;
    aimY = target.y + Math.sin(ta) * target.speed * 0.45;
    firing = Math.hypot(target.x - p.x, target.y - p.y) < range;
    const closeThreat = state.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 74);
    dash = closeThreat && p.dashCd <= 0;
    if (dash) {
      moveX = p.x - TREE.x;
      moveY = p.y - TREE.y;
      const len = Math.hypot(moveX, moveY) || 1;
      moveX /= len;
      moveY /= len;
    }
  }
  if (tired) {
    // A tired warden: half-speed feet, an aim that wanders, and he never thinks to dash.
    aimX += Math.sin(stepCount * 0.011) * 90;
    aimY += Math.cos(stepCount * 0.009) * 60;
    moveX *= 0.45;
    moveY *= 0.45;
    dash = false;
  }
  return { moveX, moveY, aimX, aimY, firing, dash };
}

function takeGifts(world) {
  const state = world.state;
  while (state.pendingLevels > 0 && state.choices.length > 0) {
    const pick = GIFT_ORDER.map((id) => state.choices.find((c) => c.id === id)).find(Boolean) || state.choices[0];
    world.applyUpgrade(pick.id);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the score to show
 * as the best. Any name other than play, upgrade or end is the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    world.reset();
    const idle = { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 0, firing: false, dash: false };
    for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, idle);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  world.startRun();
  if (name === 'upgrade') {
    for (let i = 0; i < 150 / STEP; i += 1) {
      world.step(STEP, pilotIntent(state, false, i));
      if (state.pendingLevels > 0 && state.choices.length > 0) break;
      if (state.phase !== 'playing') break;
    }
    return { screen: SCREEN_UPGRADE, best: state.score };
  }

  if (name === 'play') {
    // A close-range pilot for this scene: he lets the gloom gather into a ring around the
    // Tree before it burns, so the frame shows the fight at its thickest. The late waves
    // are where the field truly crowds, so the scene plays through to them.
    for (let i = 0; i < 320 / STEP; i += 1) {
      world.step(STEP, pilotIntent(state, false, i, 380));
      takeGifts(world);
      if (state.phase !== 'playing') break;
      // Stop on a busy frame: a thick swarm, or a brute on the field with company.
      const bruteOut = state.enemies.some((e) => e.kind === 'brute');
      if (state.wavePhase === 'wave' && ((state.wave >= 7 && state.enemies.length >= 10) || (bruteOut && state.wave >= 5 && state.enemies.length >= 6))) break;
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }

  // end: the pilot fights well for the first stretch, then tires — no gifts taken, aim
  // wandering, feet slowing — and the deepening night takes the grove, as it does a player
  // who stops growing. The run is real throughout; only the pilot's care fades.
  const TIRE_AT = 75 / STEP;
  for (let i = 0; i < 600 / STEP; i += 1) {
    world.step(STEP, pilotIntent(state, i >= TIRE_AT, i));
    if (state.phase !== 'playing') break;
  }
  return { screen: state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
